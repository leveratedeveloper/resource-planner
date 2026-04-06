/**
 * Export Assignments Excel API Route
 * GET /api/export/assignments/excel
 *
 * Export assignments to Excel format with multiple sheets
 * Optimized with streaming response for faster download start
 */

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportMetadata } from '@/lib/export/permissions';
import { exportAssignmentsToExcel, generateExcelFilename } from '@/lib/export/excel-export';
import {
  fetchAssignmentsWithDetails,
  hasFullAccess,
  getCurrentEmployeeUUID,
} from '@/lib/export/data-fetcher';

/**
 * GET /api/export/assignments/excel
 * Export assignments to Excel with streaming response
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectIds = searchParams.get('projectIds');
    const groupByBrand = searchParams.get('groupByBrand') !== 'false';
    const groupByDepartment = searchParams.get('groupByDepartment') === 'true';
    const includeSummary = searchParams.get('includeSummary') !== 'false';

    // Check access level
    const canExportAll = await hasFullAccess();
    let effectiveEmployeeUUID: string | undefined;

    if (!canExportAll) {
      effectiveEmployeeUUID = await getCurrentEmployeeUUID() || undefined;
    }

    // Fetch assignments with details
    console.log('[Export Assignments Excel] Starting fetch...');
    const assignments = await fetchAssignmentsWithDetails({
      employee_uuid: effectiveEmployeeUUID,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }, request);

    console.log('[Export Assignments Excel] Fetched assignments:', assignments.length);

    // Filter by projects if specified
    let filteredAssignments = assignments;
    if (projectIds) {
      const projectIdArray = projectIds.split(',');
      filteredAssignments = assignments.filter(a =>
        a.project_uuid && projectIdArray.includes(a.project_uuid)
      );
    }

    console.log('[Export Assignments Excel] Filtered assignments:', filteredAssignments.length);

    if (filteredAssignments.length === 0) {
      // Return empty Excel with message
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Summary');
      worksheet.addRow(['No assignments found for the specified criteria']);
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = generateExcelFilename('assignments-report');
      return new Response(new Uint8Array(Buffer.from(buffer)), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Transform to export format
    const exportData = filteredAssignments.map(assignment => {
      const dept = assignment.employee?.department_name || '';
      if (assignment.employee) {
        console.log('[Export Excel] Employee:', assignment.employee.full_name, 'dept_id:', assignment.employee.dept_id, 'department_name:', dept);
      }
      return {
        employeeName: assignment.employee?.full_name || 'Unknown',
        employeeId: assignment.employee_uuid,
        department: dept,
        position: assignment.employee?.position || '',
        projectName: assignment.project?.campaign_name || 'Unassigned',
        projectNumber: assignment.project?.io_number || null,
        brandName: assignment.project?.brand_name || '',
        startDate: assignment.start_date,
        endDate: assignment.end_date,
        hoursPerDay: assignment.hours_per_day,
        allocationPercentage: assignment.allocation_percentage,
        category: assignment.category,
        status: assignment.status,
        billable: assignment.is_billable ? 'Yes' : 'No',
        isTimeOff: assignment.is_time_off ? 'Yes' : 'No',
        note: assignment.note || '',
      };
    });

    // Generate Excel
    console.log('[Export Assignments Excel] Generating Excel...');
    const buffer = await exportAssignmentsToExcel({
      assignments: exportData,
      groupByBrand,
      groupByDepartment,
      includeSummary,
    });

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename with date range if provided
    const filename = startDate && endDate
      ? generateExcelFilename('assignments-report', { start: startDate, end: endDate })
      : generateExcelFilename('assignments-report');

    // Return Excel file with streaming
    console.log('[Export Assignments Excel] Sending response...');
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Metadata': JSON.stringify(metadata),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[API /export/assignments/excel] Export failed:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to export assignments to Excel'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
