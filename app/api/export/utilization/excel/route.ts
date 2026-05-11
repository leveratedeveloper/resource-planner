/**
 * Export Utilization Excel API Route
 * GET /api/export/utilization/excel
 *
 * Export employee utilization report to Excel format with multiple sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportAccessFilter, getExportMetadata } from '@/lib/export/permissions';
import { exportUtilizationToExcel, generateExcelFilename } from '@/lib/export/excel-export';
import { ResourceCapacityAnalysis } from '@/lib/analysis/types';
import {
  fetchAssignmentsWithDetails,
  hasFullAccess,
  getCurrentEmployeeUUID,
} from '@/lib/export/data-fetcher';

/**
 * Calculate utilization for employees based on their assignments
 * Starts with assignments and builds employee data from them
 */
function calculateUtilizationFromAssignments(
  assignments: Array<{
    employee_uuid: string;
    employee?: {
      uuid: string;
      full_name: string;
      position: string;
      department_name: string;
      dept_id: number;
    };
    start_date: string;
    end_date: string;
    hours_per_day: number;
    is_billable: boolean;
  }>,
  startDate: string,
  endDate: string
): ResourceCapacityAnalysis[] {
  // Group assignments by employee
  const employeeMap = new Map<string, {
    uuid: string;
    full_name: string;
    position: string;
    department_name: string;
    assignments: typeof assignments;
  }>();

  for (const assignment of assignments) {
    if (!employeeMap.has(assignment.employee_uuid)) {
      const deptName = assignment.employee?.department_name || '';
      console.log('[Utilization Excel Export] Employee:', assignment.employee_uuid, 'name:', assignment.employee?.full_name, 'dept:', deptName, 'position:', assignment.employee?.position);

      employeeMap.set(assignment.employee_uuid, {
        uuid: assignment.employee_uuid,
        full_name: assignment.employee?.full_name || 'Unknown Employee',
        position: assignment.employee?.position || '',
        department_name: deptName,
        assignments: [],
      });
    }
    employeeMap.get(assignment.employee_uuid)!.assignments.push(assignment);
  }

  const results: ResourceCapacityAnalysis[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const [empUuid, employeeData] of employeeMap) {
    const employeeAssignments = employeeData.assignments;

    // Calculate daily utilization
    const dailyUtilization: ResourceCapacityAnalysis['dailyUtilization'] = [];
    let totalAssignedHours = 0;
    let totalBillableHours = 0;
    let overallocatedDays = 0;
    let underutilizedDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const hoursAvailable = 8; // Standard 8-hour day

      // Calculate assigned hours for this day
      let hoursAllocated = 0;
      let billableHours = 0;

      for (const assignment of employeeAssignments) {
        const assignStart = new Date(assignment.start_date);
        const assignEnd = new Date(assignment.end_date);

        if (d >= assignStart && d <= assignEnd) {
          hoursAllocated += assignment.hours_per_day || 0;
          if (assignment.is_billable) {
            billableHours += assignment.hours_per_day || 0;
          }
        }
      }

      const utilizationPercent = (hoursAllocated / hoursAvailable) * 100;

      dailyUtilization.push({
        date: dateStr,
        hoursAllocated,
        hoursAvailable,
        utilizationPercent,
        isOverallocated: utilizationPercent > 100,
        isUnderutilized: utilizationPercent < 60,
        hasTimeOff: false,
        assignments: employeeAssignments
          .filter(a => {
            const assignStart = new Date(a.start_date);
            const assignEnd = new Date(a.end_date);
            return d >= assignStart && d <= assignEnd;
          })
          .map((a, i) => `${empUuid}-${dateStr}-${i}`),
      });

      totalAssignedHours += hoursAllocated;
      totalBillableHours += billableHours;

      if (utilizationPercent > 100) overallocatedDays++;
      if (utilizationPercent < 60) underutilizedDays++;
    }

    const averageUtilization = dailyUtilization.length > 0
      ? dailyUtilization.reduce((sum, day) => sum + day.utilizationPercent, 0) / dailyUtilization.length
      : 0;

    const peakUtilization = dailyUtilization.length > 0
      ? Math.max(...dailyUtilization.map(d => d.utilizationPercent))
      : 0;

    const billablePercent = totalAssignedHours > 0
      ? (totalBillableHours / totalAssignedHours) * 100
      : 0;

    const status: 'overallocated' | 'optimal' | 'underutilized' =
      averageUtilization > 100 ? 'overallocated' :
      averageUtilization < 60 ? 'underutilized' : 'optimal';

    results.push({
      resourceId: empUuid,
      resourceName: employeeData.full_name,
      department: employeeData.department_name,
      role: employeeData.position,
      weeklyCapacity: 40, // Standard 40-hour week
      dailyUtilization,
      averageUtilization,
      peakUtilization,
      overallocatedDays,
      underutilizedDays,
      billablePercent,
      status,
    });
  }

  return results;
}

/**
 * GET /api/export/utilization/excel
 * Export utilization report to Excel
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentIds = searchParams.get('departmentIds');
    const employeeIds = searchParams.get('employeeIds');
    const period = searchParams.get('period') || 'Custom Range';
    const includeSummary = searchParams.get('includeSummary') !== 'false';
    const includeDetails = searchParams.get('includeDetails') !== 'false';
    const includeTrends = searchParams.get('includeTrends') !== 'false';
    const includeAtRisk = searchParams.get('includeAtRisk') !== 'false';

    // Validate date range
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Check access level
    const canExportAll = await hasFullAccess();
    let effectiveEmployeeUUID: string | undefined;

    if (!canExportAll) {
      effectiveEmployeeUUID = await getCurrentEmployeeUUID() || undefined;
    }

    // Fetch assignments with details first (this includes employee data)
    const assignments = await fetchAssignmentsWithDetails({
      start_date: startDate,
      end_date: endDate,
      employee_uuid: effectiveEmployeeUUID,
    }, request);

    console.log('[Export Utilization Excel] Fetched assignments:', assignments.length);

    // Filter by department if specified
    let filteredAssignments = assignments;
    if (departmentIds) {
      const deptIdArray = departmentIds.split(',').map(id => parseInt(id, 10));
      filteredAssignments = assignments.filter(a =>
        a.employee && deptIdArray.includes(parseInt(a.employee.dept_id?.toString() || '0', 10))
      );
    }

    // Filter by employee IDs if specified
    if (employeeIds) {
      const employeeIdArray = employeeIds.split(',');
      filteredAssignments = filteredAssignments.filter(a =>
        employeeIdArray.includes(a.employee_uuid)
      );
    }

    console.log('[Export Utilization Excel] Filtered assignments:', filteredAssignments.length);

    if (filteredAssignments.length === 0) {
      // Return empty Excel with just headers
      console.log('[Export Utilization Excel] No data found, returning empty Excel');
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Summary');
      worksheet.addRow(['No utilization data found for the specified criteria']);
      worksheet.addRow(['Try adjusting the date range or filters.']);
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(Buffer.from(buffer)), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${generateExcelFilename('utilization-report', { start: startDate, end: endDate })}"`,
        },
      });
    }

    // Calculate utilization from assignments
    const capacityAnalysis = calculateUtilizationFromAssignments(
      filteredAssignments,
      startDate,
      endDate
    );

    console.log('[Export Utilization Excel] Capacity analysis results:', capacityAnalysis.length);

    // Generate Excel
    const buffer = await exportUtilizationToExcel({
      analysisData: capacityAnalysis,
      period,
      dateRange: { start: startDate, end: endDate },
      includeSummary,
      includeDetails,
      includeTrends,
      includeAtRisk,
    });

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename
    const filename = generateExcelFilename('utilization-report', { start: startDate, end: endDate });

    // Return Excel file
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Metadata': JSON.stringify(metadata),
      },
    });
  } catch (error) {
    console.error('[API /export/utilization/excel] Export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export utilization to Excel' },
      { status: 500 }
    );
  }
}
