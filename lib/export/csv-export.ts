/**
 * CSV Export Library
 * Functions for exporting various report types to CSV format
 */

import { ResourceCapacityAnalysis } from '@/lib/analysis/types';
import type { MySqlAssignment, MySqlEmployee, MySqlCampaign } from '@/lib/types/mysql';

// ============================================================================
// CSV Generation Utilities
// ============================================================================

/**
 * Escape a value for CSV format
 * Handles commas, quotes, and newlines
 */
function escapeCsvValue(value: string | number | null | undefined | Date): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = typeof value === 'object' && 'toLocaleDateString' in value
    ? (value as Date).toLocaleDateString('en-CA') // YYYY-MM-DD format
    : String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert an array of objects to CSV string
 */
function arrayToCsv<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; header: string }[]
): string {
  if (data.length === 0) {
    // Return header row only
    return columns.map(c => escapeCsvValue(c.header)).join(',') + '\n';
  }

  const header = columns.map(c => escapeCsvValue(c.header)).join(',');
  const rows = data.map(item =>
    columns.map(c => escapeCsvValue(item[c.key])).join(',')
  );

  return [header, ...rows].join('\n');
}

// ============================================================================
// Assignments Export
// ============================================================================

export interface AssignmentExportData {
  employeeName: string;
  employeeId: string;
  department: string;
  position: string;
  projectName: string;
  projectNumber: string | null;
  brandName: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  allocationPercentage: number | null;
  category: string | null;
  status: string;
  billable: boolean | string;
  isTimeOff: boolean | string;
  note: string | null;
}

/**
 * Export assignments to CSV format
 */
export function exportAssignmentsToCSV(data: AssignmentExportData[]): string {
  const columns = [
    { key: 'employeeName', header: 'Employee Name' },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'department', header: 'Department' },
    { key: 'position', header: 'Position' },
    { key: 'projectName', header: 'Project' },
    { key: 'projectNumber', header: 'Project Number' },
    { key: 'brandName', header: 'Brand' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'hoursPerDay', header: 'Hours/Day' },
    { key: 'allocationPercentage', header: 'Allocation %' },
    { key: 'category', header: 'Category' },
    { key: 'status', header: 'Status' },
    { key: 'billable', header: 'Billable' },
    { key: 'isTimeOff', header: 'Time Off' },
    { key: 'note', header: 'Notes' },
  ];

  return arrayToCsv(data, columns);
}

// ============================================================================
// Utilization Export
// ============================================================================

export interface UtilizationExportData {
  employeeName: string;
  employeeId: string;
  department: string;
  position: string;
  period: string;
  totalCapacity: number;
  assignedHours: number;
  utilizationPercent: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationStatus: 'Overallocated' | 'Underutilized' | 'Optimal';
  overallocatedDays: number;
  underutilizedDays: number;
}

/**
 * Export utilization report to CSV format
 */
export function exportUtilizationToCSV(data: UtilizationExportData[]): string {
  const columns = [
    { key: 'employeeName', header: 'Employee Name' },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'department', header: 'Department' },
    { key: 'position', header: 'Position' },
    { key: 'period', header: 'Period' },
    { key: 'totalCapacity', header: 'Total Capacity (Hours)' },
    { key: 'assignedHours', header: 'Assigned Hours' },
    { key: 'utilizationPercent', header: 'Utilization %' },
    { key: 'billableHours', header: 'Billable Hours' },
    { key: 'nonBillableHours', header: 'Non-Billable Hours' },
    { key: 'utilizationStatus', header: 'Utilization Status' },
    { key: 'overallocatedDays', header: 'Overallocated Days' },
    { key: 'underutilizedDays', header: 'Underutilized Days' },
  ];

  return arrayToCsv(data, columns);
}

/**
 * Convert ResourceCapacityAnalysis to utilization export format
 */
export function capacityAnalysisToUtilizationExport(
  analysis: ResourceCapacityAnalysis[],
  period: string
): UtilizationExportData[] {
  return analysis.map(a => {
    // Calculate total hours from daily utilization
    const totalCapacity = a.dailyUtilization.reduce((sum, day) => sum + day.hoursAvailable, 0);
    const assignedHours = a.dailyUtilization.reduce((sum, day) => sum + day.hoursAllocated, 0);

    // Calculate billable vs non-billable
    const billableHours = a.dailyUtilization.reduce((sum, day) => {
      const billableForDay = day.assignments.reduce((billableSum, assignId) => {
        // Note: We'd need the actual assignment data to determine billable status
        // For now, estimate based on utilization
        return billableSum + (day.hoursAllocated * a.billablePercent / 100);
      }, 0);
      return sum + billableForDay;
    }, 0);

    return {
      employeeName: a.resourceName,
      employeeId: a.resourceId,
      department: a.department,
      position: a.role,
      period,
      totalCapacity: Math.round(totalCapacity),
      assignedHours: Math.round(assignedHours),
      utilizationPercent: Math.round(a.averageUtilization),
      billableHours: Math.round(billableHours),
      nonBillableHours: Math.round(assignedHours - billableHours),
      utilizationStatus: a.status === 'overallocated' ? 'Overallocated' :
                       a.status === 'underutilized' ? 'Underutilized' : 'Optimal',
      overallocatedDays: a.overallocatedDays,
      underutilizedDays: a.underutilizedDays,
    };
  });
}

// ============================================================================
// Projects Export
// ============================================================================

export interface ProjectExportData {
  projectName: string;
  projectNumber: string | null;
  projectUuid: string;
  brandName: string;
  status: string;
  budget: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  allocatedResources: number;
  totalAssignedHours: number;
  ioNumber: string | null;
}

/**
 * Export project status to CSV format
 */
export function exportProjectsToCSV(data: ProjectExportData[]): string {
  const columns = [
    { key: 'projectName', header: 'Project Name' },
    { key: 'projectNumber', header: 'Project Number' },
    { key: 'projectUuid', header: 'Project ID' },
    { key: 'brandName', header: 'Brand' },
    { key: 'status', header: 'Status' },
    { key: 'budget', header: 'Budget' },
    { key: 'currency', header: 'Currency' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'allocatedResources', header: 'Allocated Resources' },
    { key: 'totalAssignedHours', header: 'Total Assigned Hours' },
    { key: 'ioNumber', header: 'IO Number' },
  ];

  return arrayToCsv(data, columns);
}

// ============================================================================
// Conflicts Export
// ============================================================================

export interface ConflictExportData {
  resourceName: string;
  resourceId: string;
  department: string;
  conflictType: string;
  severity: string;
  date: string;
  description: string;
  affectedAssignments: number;
  suggestedResolution: string | undefined;
}

/**
 * Export conflicts report to CSV format
 */
export function exportConflictsToCSV(data: ConflictExportData[]): string {
  const columns = [
    { key: 'resourceName', header: 'Resource Name' },
    { key: 'resourceId', header: 'Resource ID' },
    { key: 'department', header: 'Department' },
    { key: 'conflictType', header: 'Conflict Type' },
    { key: 'severity', header: 'Severity' },
    { key: 'date', header: 'Date' },
    { key: 'description', header: 'Description' },
    { key: 'affectedAssignments', header: 'Affected Assignments' },
    { key: 'suggestedResolution', header: 'Suggested Resolution' },
  ];

  return arrayToCsv(data, columns);
}

/**
 * Convert Conflict type to export format
 */
export function conflictToExportFormat(
  conflicts: Array<{
    id: string;
    type: string;
    severity: string;
    resourceId: string;
    resourceName: string;
    department?: string;
    date: string;
    description: string;
    affectedAssignments: string[];
    suggestedResolution?: string;
  }>
): ConflictExportData[] {
  return conflicts.map(c => ({
    resourceName: c.resourceName,
    resourceId: c.resourceId,
    department: c.department || '',
    conflictType: c.type,
    severity: c.severity,
    date: c.date,
    description: c.description,
    affectedAssignments: c.affectedAssignments.length,
    suggestedResolution: c.suggestedResolution,
  }));
}

// ============================================================================
// File Download Utility
// ============================================================================

/**
 * Generate a filename for the export
 */
export function generateExportFilename(reportType: string, format: string, dateRange?: { start: string; end: string }): string {
  const date = new Date().toISOString().split('T')[0];

  if (dateRange) {
    return `${reportType}-${dateRange.start}-to-${dateRange.end}.${format}`;
  }

  return `${reportType}-${date}.${format}`;
}

/**
 * Trigger browser download for CSV content
 */
export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
