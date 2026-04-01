/**
 * Export Utilization API Route
 * GET /api/export/utilization
 *
 * Export employee utilization report to CSV format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportAccessFilter, getExportMetadata } from '@/lib/export/permissions';
import {
  exportUtilizationToCSV,
  generateExportFilename,
  capacityAnalysisToUtilizationExport,
} from '@/lib/export/csv-export';
import { ResourceCapacityAnalysis } from '@/lib/analysis/types';
import {
  fetchAssignmentsWithDetails,
  fetchAllEmployees,
  hasFullAccess,
  getCurrentEmployeeUUID,
} from '@/lib/export/data-fetcher';

/**
 * Calculate utilization for employees
 */
function calculateUtilization(
  employees: Array<{
    uuid: string;
    full_name: string;
    position: string;
    dept_id: number;
    department_name: string;
  }>,
  assignments: Array<{
    employee_uuid: string;
    start_date: string;
    end_date: string;
    hours_per_day: number;
    is_billable: boolean;
  }>,
  startDate: string,
  endDate: string
): ResourceCapacityAnalysis[] {
  const results: ResourceCapacityAnalysis[] = [];

  // Parse date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const employee of employees) {
    // Get assignments for this employee within date range
    const employeeAssignments = assignments.filter(a => {
      if (a.employee_uuid !== employee.uuid) return false;

      const assignStart = new Date(a.start_date);
      const assignEnd = new Date(a.end_date);

      return assignStart <= end && assignEnd >= start;
    });

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
          .map((a, i) => `${employee.uuid}-${dateStr}-${i}`),
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
      resourceId: employee.uuid,
      resourceName: employee.full_name,
      department: employee.department_name,
      role: employee.position,
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
 * GET /api/export/utilization
 * Export utilization report to CSV
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
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Use /api/export/utilization/excel for Excel format' },
        { status: 400 }
      );
    }

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

    // Fetch employees
    let employees = await fetchAllEmployees(request);

    // Apply access filter for restricted users
    if (!canExportAll && effectiveEmployeeUUID) {
      employees = employees.filter(e => e.uuid === effectiveEmployeeUUID);
    }

    // Apply department filter if specified
    if (departmentIds) {
      const deptIdArray = departmentIds.split(',').map(id => parseInt(id, 10));
      employees = employees.filter(e => deptIdArray.includes(e.dept_id));
    }

    // Apply employee filter if specified
    if (employeeIds) {
      const employeeIdArray = employeeIds.split(',');
      employees = employees.filter(e => employeeIdArray.includes(e.uuid));
    }

    // Fetch assignments
    const assignments = await fetchAssignmentsWithDetails({
      start_date: startDate,
      end_date: endDate,
      employee_uuid: effectiveEmployeeUUID,
    }, request);

    // Calculate utilization
    const capacityAnalysis = calculateUtilization(
      employees,
      assignments,
      startDate,
      endDate
    );

    if (capacityAnalysis.length === 0) {
      // Return empty CSV with headers instead of 404
      console.log('[Export Utilization] No data found, returning empty CSV');
      const emptyCsv = 'Employee Name,Employee ID,Department,Position,Period,Total Capacity (Hours),Assigned Hours,Utilization %,Billable Hours,Non-Billable Hours,Utilization Status,Overallocated Days,Underutilized Days\n';
      return new NextResponse(emptyCsv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${generateExportFilename('utilization', 'csv', { start: startDate, end: endDate })}"`,
        },
      });
    }

    // Convert to export format
    const exportData = capacityAnalysisToUtilizationExport(capacityAnalysis, period);

    // Generate CSV
    const csvContent = exportUtilizationToCSV(exportData);

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename
    const filename = generateExportFilename('utilization', 'csv', { start: startDate, end: endDate });

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Metadata': JSON.stringify(metadata),
      },
    });
  } catch (error) {
    console.error('[API /export/utilization] Export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export utilization' },
      { status: 500 }
    );
  }
}
