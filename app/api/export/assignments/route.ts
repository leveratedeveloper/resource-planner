/**
 * Export Assignments API Route
 * GET /api/export/assignments
 *
 * Export assignments to CSV format with filtering support
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportAccessFilter, getExportMetadata } from '@/lib/export/permissions';
import {
  exportAssignmentsToCSV,
  generateExportFilename,
} from '@/lib/export/csv-export';
import {
  fetchAssignmentsWithDetails,
  hasFullAccess,
  getCurrentEmployeeUUID,
} from '@/lib/export/data-fetcher';

/**
 * GET /api/export/assignments
 * Export assignments to CSV
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
    const projectIds = searchParams.get('projectIds');
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported for assignments export' },
        { status: 400 }
      );
    }

    // Check access level
    const canExportAll = await hasFullAccess();
    let effectiveEmployeeUUID: string | undefined;

    if (!canExportAll) {
      effectiveEmployeeUUID = await getCurrentEmployeeUUID() || undefined;
    }

    // Fetch assignments with details
    const assignments = await fetchAssignmentsWithDetails({
      employee_uuid: effectiveEmployeeUUID,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }, request);

    // Filter by projects if specified
    let filteredAssignments = assignments;
    if (projectIds) {
      const projectIdArray = projectIds.split(',');
      filteredAssignments = assignments.filter(a =>
        a.project_uuid && projectIdArray.includes(a.project_uuid)
      );
    }

    // Transform to export format
    const exportData = filteredAssignments.map(assignment => ({
      employeeName: assignment.employee?.full_name || 'Unknown',
      employeeId: assignment.employee_uuid,
      department: assignment.employee?.department_name || '',
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
    }));

    if (exportData.length === 0) {
      return NextResponse.json(
        { error: 'No assignments found for the specified criteria' },
        { status: 404 }
      );
    }

    // Generate CSV
    const csvContent = exportAssignmentsToCSV(exportData);

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename
    const filename = generateExportFilename(
      'assignments',
      'csv',
      startDate && endDate ? { start: startDate, end: endDate } : undefined
    );

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
    console.error('[API /export/assignments] Export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export assignments' },
      { status: 500 }
    );
  }
}
