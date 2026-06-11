/**
 * Export Conflicts API Route
 * GET /api/export/conflicts
 *
 * Export conflict analysis to CSV format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportAccessFilter, getExportMetadata } from '@/lib/export/permissions';
import {
  exportConflictsToCSV,
  conflictToExportFormat,
  generateExportFilename,
} from '@/lib/export/csv-export';
import type { Conflict } from '@/lib/analysis/types';
import {
  fetchAssignmentsWithDetails,
  hasFullAccess,
  getCurrentEmployeeUUID,
} from '@/lib/export/data-fetcher';

/**
 * Detect conflicts in assignments
 * Starts with assignments and builds employee data from them
 */
function detectConflictsFromAssignments(
  assignments: Array<{
    uuid: string;
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
    is_time_off: boolean;
  }>,
  startDate: string,
  endDate: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Build map of assignments per employee with employee details
  const employeeAssignments = new Map<string, {
    employee: {
      uuid: string;
      full_name: string;
      department_name: string;
    };
    assignments: typeof assignments;
  }>();

  for (const assignment of assignments) {
    const existing = employeeAssignments.get(assignment.employee_uuid);
    if (!existing) {
      employeeAssignments.set(assignment.employee_uuid, {
        employee: {
          uuid: assignment.employee_uuid,
          full_name: assignment.employee?.full_name || 'Unknown Employee',
          department_name: assignment.employee?.department_name || '',
        },
        assignments: [assignment],
      });
    } else {
      existing.assignments.push(assignment);
    }
  }

  // Check each day for each employee
  for (const [empUuid, { employee, assignments }] of employeeAssignments) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Get assignments active on this day
      const activeAssignments = assignments.filter(a => {
        const assignStart = new Date(a.start_date);
        const assignEnd = new Date(a.end_date);
        return d >= assignStart && d <= assignEnd;
      });

      if (activeAssignments.length === 0) continue;

      // Calculate total hours for this day
      let totalHours = 0;
      let billableHours = 0;

      for (const assignment of activeAssignments) {
        totalHours += assignment.hours_per_day;
        if (assignment.is_billable) {
          billableHours += assignment.hours_per_day;
        }
      }

      // Detect overallocation
      if (totalHours > 8) {
        conflicts.push({
          id: `conflict-${empUuid}-${dateStr}-overallocation`,
          type: 'overallocation',
          severity: totalHours > 10 ? 'critical' : 'warning',
          resourceId: empUuid,
          resourceName: employee.full_name,
          department: employee.department_name,
          date: dateStr,
          description: `Assigned ${totalHours.toFixed(1)} hours (exceeds 8-hour capacity)`,
          affectedAssignments: activeAssignments.map(a => a.uuid),
          suggestedResolution: 'Reduce assignments or redistribute workload to available resources',
        });
      }

      // Detect low billable ratio
      if (totalHours >= 6 && billableHours / totalHours < 0.5) {
        conflicts.push({
          id: `conflict-${empUuid}-${dateStr}-billable`,
          type: 'billable_target',
          severity: 'warning',
          resourceId: empUuid,
          resourceName: employee.full_name,
          department: employee.department_name,
          date: dateStr,
          description: `Only ${((billableHours / totalHours) * 100).toFixed(0)}% billable (${billableHours.toFixed(1)}h of ${totalHours.toFixed(1)}h)`,
          affectedAssignments: activeAssignments.map(a => a.uuid),
          suggestedResolution: 'Increase billable project assignments or review non-billable work',
        });
      }

    }
  }

  return conflicts;
}

/**
 * GET /api/export/conflicts
 * Export conflicts report to CSV
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
    const employeeIds = searchParams.get('employeeIds');
    const severity = searchParams.get('severity');
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported for conflicts export' },
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

    // Fetch assignments with details first (this includes employee data)
    // Skip campaigns fetching for conflicts since we don't need project data
    const assignments = await fetchAssignmentsWithDetails({
      start_date: startDate,
      end_date: endDate,
      employee_uuid: effectiveEmployeeUUID,
      skipCampaigns: true, // Skip fetching campaigns for faster conflicts export
    }, request);

    console.log('[Export Conflicts] Fetched assignments:', assignments.length);

    // Filter by employee IDs if specified
    let filteredAssignments = assignments;
    if (employeeIds) {
      const employeeIdArray = employeeIds.split(',');
      filteredAssignments = assignments.filter(a =>
        employeeIdArray.includes(a.employee_uuid)
      );
    }

    console.log('[Export Conflicts] Filtered assignments:', filteredAssignments.length);

    if (filteredAssignments.length === 0) {
      // Return empty CSV with headers instead of 404
      console.log('[Export Conflicts] No assignments found, returning empty CSV');
      const emptyCsv = 'Resource Name,Resource ID,Department,Conflict Type,Severity,Date,Description,Affected Assignments,Suggested Resolution\n';
      return new NextResponse(emptyCsv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${generateExportFilename('conflicts', 'csv', { start: startDate, end: endDate })}"`,
        },
      });
    }

    // Detect conflicts from assignments
    let conflicts = detectConflictsFromAssignments(filteredAssignments, startDate, endDate);

    console.log('[Export Conflicts] Detected conflicts:', conflicts.length);

    // Apply severity filter if specified
    if (severity) {
      conflicts = conflicts.filter(c => c.severity === severity);
    }

    if (conflicts.length === 0) {
      // Return empty CSV with headers instead of 404
      console.log('[Export Conflicts] No conflicts found, returning empty CSV');
      const emptyCsv = 'Resource Name,Resource ID,Department,Conflict Type,Severity,Date,Description,Affected Assignments,Suggested Resolution\n';
      return new NextResponse(emptyCsv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${generateExportFilename('conflicts', 'csv', { start: startDate, end: endDate })}"`,
        },
      });
    }

    // Convert to export format
    const exportData = conflictToExportFormat(conflicts);

    // Generate CSV
    const csvContent = exportConflictsToCSV(exportData);

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename
    const filename = generateExportFilename('conflicts', 'csv', { start: startDate, end: endDate });

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
    console.error('[API /export/conflicts] Export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export conflicts' },
      { status: 500 }
    );
  }
}
