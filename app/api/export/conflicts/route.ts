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
  fetchAllEmployees,
  hasFullAccess,
  getCurrentEmployeeUUID,
} from '@/lib/export/data-fetcher';

/**
 * Detect conflicts in assignments
 */
function detectConflicts(
  assignments: Array<{
    uuid: string;
    employee_uuid: string;
    start_date: string;
    end_date: string;
    hours_per_day: number;
    is_billable: boolean;
    is_time_off: boolean;
  }>,
  employees: Array<{
    uuid: string;
    full_name: string;
    position: string;
    dept_id: number;
    department_name: string;
  }>,
  startDate: string,
  endDate: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Build map of assignments per employee
  const employeeAssignments = new Map<string, typeof assignments>();
  assignments.forEach(a => {
    const existing = employeeAssignments.get(a.employee_uuid) || [];
    existing.push(a);
    employeeAssignments.set(a.employee_uuid, existing);
  });

  // Check each day for each employee
  for (const employee of employees) {
    const empAssignments = employeeAssignments.get(employee.uuid) || [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Get assignments active on this day
      const activeAssignments = empAssignments.filter(a => {
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
          id: `conflict-${employee.uuid}-${dateStr}-overallocation`,
          type: 'overallocation',
          severity: totalHours > 10 ? 'critical' : 'warning',
          resourceId: employee.uuid,
          resourceName: employee.full_name,
          date: dateStr,
          description: `Assigned ${totalHours.toFixed(1)} hours (exceeds 8-hour capacity)`,
          affectedAssignments: activeAssignments.map(a => a.uuid),
          suggestedResolution: 'Reduce assignments or redistribute workload to available resources',
        });
      }

      // Detect low billable ratio
      if (totalHours >= 6 && billableHours / totalHours < 0.5) {
        conflicts.push({
          id: `conflict-${employee.uuid}-${dateStr}-billable`,
          type: 'billable_target',
          severity: 'warning',
          resourceId: employee.uuid,
          resourceName: employee.full_name,
          date: dateStr,
          description: `Only ${((billableHours / totalHours) * 100).toFixed(0)}% billable (${billableHours.toFixed(1)}h of ${totalHours.toFixed(1)}h)`,
          affectedAssignments: activeAssignments.map(a => a.uuid),
          suggestedResolution: 'Increase billable project assignments or review non-billable work',
        });
      }

      // Detect time-off conflicts
      const timeOffAssignments = activeAssignments.filter(a => a.is_time_off);
      const workAssignments = activeAssignments.filter(a => !a.is_time_off);

      if (timeOffAssignments.length > 0 && workAssignments.length > 0) {
        conflicts.push({
          id: `conflict-${employee.uuid}-${dateStr}-timeoff`,
          type: 'resource_unavailable',
          severity: 'critical',
          resourceId: employee.uuid,
          resourceName: employee.full_name,
          date: dateStr,
          description: `Has both time-off and work assignments on the same day`,
          affectedAssignments: activeAssignments.map(a => a.uuid),
          suggestedResolution: 'Reschedule work assignments or move time-off to different date',
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

    // Fetch employees
    let employees = await fetchAllEmployees(request);

    // Apply access filter for restricted users
    if (!canExportAll && effectiveEmployeeUUID) {
      employees = employees.filter(e => e.uuid === effectiveEmployeeUUID);
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

    // Detect conflicts
    let conflicts = detectConflicts(assignments, employees, startDate, endDate);

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

    // Convert to export format with department info
    const exportData = conflictToExportFormat(
      conflicts.map(c => ({
        ...c,
        department: employees.find(e => e.uuid === c.resourceId)?.department_name,
      }))
    );

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
