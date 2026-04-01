/**
 * Excel Export Library
 * Functions for exporting reports to Excel format with multiple sheets and formatting
 */

import ExcelJS from 'exceljs';
import { ResourceCapacityAnalysis } from '@/lib/analysis/types';
import type { UtilizationExportData, ProjectExportData } from './csv-export';

// ============================================================================
// Excel Styling Constants
// ============================================================================

const HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: {
    type: 'pattern' as const,
    pattern: 'solid' as any,
    fgColor: { argb: 'FF4472C4' },
  },
  border: {
    top: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    left: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    right: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
  },
  alignment: { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true },
};

const SUBHEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: {
    type: 'pattern' as const,
    pattern: 'solid' as any,
    fgColor: { argb: 'FF5B9BD5' },
  },
  border: {
    top: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    left: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    right: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
  },
  alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
};

const CELL_STYLE = {
  border: {
    top: { style: 'thin' as const, color: { argb: 'FFE0E0E0' } },
    left: { style: 'thin' as const, color: { argb: 'FFE0E0E0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE0E0E0' } },
    right: { style: 'thin' as const, color: { argb: 'FFE0E0E0' } },
  },
  alignment: { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: false },
};

const NUMBER_CELL_STYLE = {
  ...CELL_STYLE,
  alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
  numFmt: '#,##0.00',
};

const PERCENT_CELL_STYLE = {
  ...CELL_STYLE,
  alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
  numFmt: '0.0"%"',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Apply header styling to a row
 */
function applyHeaderStyle(row: ExcelJS.Row, style: Partial<ExcelJS.Style>): void {
  row.eachCell((cell) => {
    cell.style = style;
  });
}

/**
 * Set column widths for a worksheet
 */
function setColumnWidths(worksheet: ExcelJS.Worksheet, widths: number[]): void {
  worksheet.columns = widths.map(width => ({ width }));
}

/**
 * Apply cell styling to a range
 */
function applyCellStyle(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
  style: Partial<ExcelJS.Style>
): void {
  for (let col = 1; col <= columnCount; col++) {
    const cell = worksheet.getCell(rowNumber, col);
    cell.style = style;
  }
}

// ============================================================================
// Utilization Report Excel Export
// ============================================================================

export interface UtilizationExcelExportOptions {
  analysisData: ResourceCapacityAnalysis[];
  period: string;
  dateRange?: { start: string; end: string };
  includeSummary: boolean;
  includeDetails: boolean;
  includeTrends: boolean;
  includeAtRisk: boolean;
}

/**
 * Export utilization report to Excel with multiple sheets
 */
export async function exportUtilizationToExcel(
  options: UtilizationExcelExportOptions
): Promise<Buffer> {
  const { analysisData, period, dateRange, includeSummary, includeDetails, includeTrends, includeAtRisk } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Resource Planner';
  workbook.created = new Date();

  // Sheet 1: Summary
  if (includeSummary) {
    createSummarySheet(workbook, analysisData, period, dateRange);
  }

  // Sheet 2: Employee Detail
  if (includeDetails) {
    createDetailSheet(workbook, analysisData, period);
  }

  // Sheet 3: At Risk Resources
  if (includeAtRisk) {
    createAtRiskSheet(workbook, analysisData);
  }

  // Sheet 4: Trend Analysis
  if (includeTrends) {
    createTrendSheet(workbook, analysisData);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Create Summary Sheet
 */
function createSummarySheet(
  workbook: ExcelJS.Workbook,
  data: ResourceCapacityAnalysis[],
  period: string,
  dateRange?: { start: string; end: string }
): void {
  const worksheet = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }] });

  let currentRow = 1;

  // Report Title
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Resource Utilization Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' as const };

  currentRow++;

  // Report Metadata
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const metaCell = worksheet.getCell(`A${currentRow}`);
  metaCell.value = `Period: ${period}${dateRange ? ` | ${dateRange.start} to ${dateRange.end}` : ''}`;
  metaCell.alignment = { horizontal: 'center' as const };
  metaCell.font = { italic: true };

  currentRow++;

  // Overall Statistics
  const totalResources = data.length;
  const overallocatedCount = data.filter(d => d.status === 'overallocated').length;
  const underutilizedCount = data.filter(d => d.status === 'underutilized').length;
  const optimalCount = data.filter(d => d.status === 'optimal').length;
  const avgUtilization = data.reduce((sum, d) => sum + d.averageUtilization, 0) / (totalResources || 1);

  worksheet.addRow(['Total Resources', totalResources]);
  worksheet.addRow(['Overallocated', overallocatedCount]);
  worksheet.addRow(['Underutilized', underutilizedCount]);
  worksheet.addRow(['Optimal Utilization', optimalCount]);
  worksheet.addRow(['Average Utilization', `${avgUtilization.toFixed(1)}%`]);

  currentRow += 5;

  // Department Breakdown
  worksheet.getCell(`A${currentRow}`).value = 'Department Breakdown';
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  currentRow++;

  const deptMap = new Map<string, { count: number; avgUtil: number; overallocated: number }>();
  data.forEach(d => {
    const existing = deptMap.get(d.department) || { count: 0, avgUtil: 0, overallocated: 0 };
    existing.count++;
    existing.avgUtil += d.averageUtilization;
    if (d.status === 'overallocated') existing.overallocated++;
    deptMap.set(d.department, existing);
  });

  // Department header
  const deptHeaderRow = worksheet.addRow(['Department', 'Resources', 'Avg Utilization', 'Overallocated', 'Utilization Status']);
  applyHeaderStyle(deptHeaderRow, SUBHEADER_STYLE);

  // Department data
  deptMap.forEach((stats, dept) => {
    const avgUtil = stats.avgUtil / stats.count;
    const status = avgUtil > 100 ? 'Overallocated' : avgUtil < 60 ? 'Underutilized' : 'Optimal';

    const row = worksheet.addRow([
      dept,
      stats.count,
      `${avgUtil.toFixed(1)}%`,
      stats.overallocated,
      status,
    ]);

    applyCellStyle(worksheet, row.number, 5, CELL_STYLE);
  });

  // Column widths
  setColumnWidths(worksheet, [20, 15, 15, 15, 15]);
}

/**
 * Create Employee Detail Sheet
 */
function createDetailSheet(
  workbook: ExcelJS.Workbook,
  data: ResourceCapacityAnalysis[],
  period: string
): void {
  const worksheet = workbook.addWorksheet('Employee Detail', { views: [{ state: 'frozen', ySplit: 1 }] });

  // Header
  const headerRow = worksheet.addRow([
    'Employee Name',
    'Employee ID',
    'Department',
    'Position',
    'Weekly Capacity',
    'Avg Utilization',
    'Peak Utilization',
    'Billable %',
    'Status',
    'Overallocated Days',
    'Underutilized Days',
    'Total Assigned Hours',
  ]);

  applyHeaderStyle(headerRow, HEADER_STYLE);

  // Data rows
  data.forEach(item => {
    const totalAssigned = item.dailyUtilization.reduce((sum, day) => sum + day.hoursAllocated, 0);

    const row = worksheet.addRow([
      item.resourceName,
      item.resourceId,
      item.department,
      item.role,
      item.weeklyCapacity,
      `${item.averageUtilization.toFixed(1)}%`,
      `${item.peakUtilization.toFixed(1)}%`,
      `${item.billablePercent.toFixed(1)}%`,
      item.status === 'overallocated' ? 'Overallocated' :
      item.status === 'underutilized' ? 'Underutilized' : 'Optimal',
      item.overallocatedDays,
      item.underutilizedDays,
      Math.round(totalAssigned),
    ]);

    applyCellStyle(worksheet, row.number, 12, CELL_STYLE);
  });

  // Conditional formatting for utilization
  data.forEach((item, index) => {
    const rowNum = index + 2; // +1 for header, +1 for 1-based index
    const utilCell = worksheet.getCell(rowNum, 6); // Avg Utilization column
    const statusCell = worksheet.getCell(rowNum, 9); // Status column

    if (item.status === 'overallocated') {
      utilCell.fill = { type: 'pattern', pattern: 'solid' as any, fgColor: { argb: 'FFFFC7CE' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid' as any, fgColor: { argb: 'FFFFC7CE' } };
    } else if (item.status === 'underutilized') {
      utilCell.fill = { type: 'pattern', pattern: 'solid' as any, fgColor: { argb: 'FFFFE699' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid' as any, fgColor: { argb: 'FFFFE699' } };
    }
  });

  // Column widths
  setColumnWidths(worksheet, [25, 15, 20, 20, 12, 12, 12, 12, 12, 15, 15, 15]);
}

/**
 * Create At Risk Resources Sheet
 */
function createAtRiskSheet(workbook: ExcelJS.Workbook, data: ResourceCapacityAnalysis[]): void {
  const worksheet = workbook.addWorksheet('At Risk Resources', { views: [{ state: 'frozen', ySplit: 1 }] });

  // Filter at-risk resources
  const atRiskData = data.filter(d => d.status !== 'optimal');

  if (atRiskData.length === 0) {
    worksheet.addRow(['No resources at risk']);
    return;
  }

  // Header
  const headerRow = worksheet.addRow([
    'Employee Name',
    'Department',
    'Status',
    'Avg Utilization',
    'Issue Type',
    'Severity',
    'Affected Days',
    'Recommendation',
  ]);

  applyHeaderStyle(headerRow, HEADER_STYLE);

  // Data rows
  atRiskData.forEach(item => {
    const issueType = item.status === 'overallocated' ? 'Overallocation' : 'Underutilization';
    const severity = item.averageUtilization > 120 || item.averageUtilization < 40 ? 'High' : 'Medium';
    const recommendation = item.status === 'overallocated'
      ? 'Reduce assignments or add resources'
      : 'Assign more projects';

    const row = worksheet.addRow([
      item.resourceName,
      item.department,
      item.status === 'overallocated' ? 'Overallocated' : 'Underutilized',
      `${item.averageUtilization.toFixed(1)}%`,
      issueType,
      severity,
      item.status === 'overallocated' ? item.overallocatedDays : item.underutilizedDays,
      recommendation,
    ]);

    applyCellStyle(worksheet, row.number, 8, CELL_STYLE);
  });

  // Column widths
  setColumnWidths(worksheet, [25, 20, 12, 12, 12, 10, 12, 30]);
}

/**
 * Create Trend Analysis Sheet
 */
function createTrendSheet(workbook: ExcelJS.Workbook, data: ResourceCapacityAnalysis[]): void {
  const worksheet = workbook.addWorksheet('Trend Analysis');

  // Aggregate by week
  const weeklyData = new Map<string, { totalCapacity: number; totalAssigned: number; count: number }>();

  data.forEach(item => {
    item.dailyUtilization.forEach(day => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];

      const existing = weeklyData.get(weekKey) || { totalCapacity: 0, totalAssigned: 0, count: 0 };
      existing.totalCapacity += day.hoursAvailable;
      existing.totalAssigned += day.hoursAllocated;
      existing.count++;
      weeklyData.set(weekKey, existing);
    });
  });

  // Header
  const headerRow = worksheet.addRow([
    'Week Starting',
    'Avg Utilization %',
    'Total Capacity (Hours)',
    'Total Assigned (Hours)',
    'Trend',
  ]);

  applyHeaderStyle(headerRow, HEADER_STYLE);

  // Data rows sorted by week
  const sortedWeeks = Array.from(weeklyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let prevUtil = 0;

  sortedWeeks.forEach(([week, stats]) => {
    const avgUtil = (stats.totalAssigned / stats.totalCapacity) * 100;
    const trend = prevUtil > 0
      ? avgUtil > prevUtil + 5 ? 'Increasing' : avgUtil < prevUtil - 5 ? 'Decreasing' : 'Stable'
      : '-';

    const row = worksheet.addRow([
      week,
      `${avgUtil.toFixed(1)}%`,
      Math.round(stats.totalCapacity),
      Math.round(stats.totalAssigned),
      trend,
    ]);

    applyCellStyle(worksheet, row.number, 5, CELL_STYLE);
    prevUtil = avgUtil;
  });

  // Column widths
  setColumnWidths(worksheet, [15, 15, 20, 20, 12]);
}

// ============================================================================
// Project Report Excel Export
// ============================================================================

export interface ProjectExcelExportOptions {
  projects: ProjectExportData[];
  groupByBrand?: boolean;
  includeSummary: boolean;
}

/**
 * Export project report to Excel
 */
export async function exportProjectsToExcel(
  options: ProjectExcelExportOptions
): Promise<Buffer> {
  const { projects, groupByBrand, includeSummary } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Resource Planner';
  workbook.created = new Date();

  // Summary sheet
  if (includeSummary) {
    createProjectSummarySheet(workbook, projects);
  }

  // Per-brand sheets if requested
  if (groupByBrand) {
    const brandGroups = new Map<string, ProjectExportData[]>();
    projects.forEach(p => {
      const existing = brandGroups.get(p.brandName) || [];
      existing.push(p);
      brandGroups.set(p.brandName, existing);
    });

    brandGroups.forEach((brandProjects, brandName) => {
      createBrandSheet(workbook, brandName, brandProjects);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Create Project Summary Sheet
 */
function createProjectSummarySheet(
  workbook: ExcelJS.Workbook,
  projects: ProjectExportData[]
): void {
  const worksheet = workbook.addWorksheet('Project Summary', { views: [{ state: 'frozen', ySplit: 1 }] });

  // Header
  const headerRow = worksheet.addRow([
    'Project Name',
    'Project Number',
    'Project ID',
    'Brand',
    'Status',
    'Budget',
    'Currency',
    'Start Date',
    'End Date',
    'Allocated Resources',
    'Total Assigned Hours',
    'IO Number',
  ]);

  applyHeaderStyle(headerRow, HEADER_STYLE);

  // Data rows
  projects.forEach(project => {
    const row = worksheet.addRow([
      project.projectName,
      project.projectNumber || '',
      project.projectUuid,
      project.brandName,
      project.status,
      project.budget || 0,
      project.currency,
      project.startDate || '',
      project.endDate || '',
      project.allocatedResources,
      project.totalAssignedHours,
      project.ioNumber || '',
    ]);

    applyCellStyle(worksheet, row.number, 12, CELL_STYLE);

    // Format budget as currency
    if (project.budget) {
      const budgetCell = worksheet.getCell(row.number, 6);
      budgetCell.numFmt = '#,##0.00';
    }
  });

  // Column widths
  setColumnWidths(worksheet, [30, 15, 20, 20, 12, 15, 10, 12, 12, 15, 18, 15]);
}

/**
 * Create Brand-specific Sheet
 */
function createBrandSheet(
  workbook: ExcelJS.Workbook,
  brandName: string,
  projects: ProjectExportData[]
): void {
  // Sanitize sheet name (Excel limits to 31 chars and certain characters)
  const sheetName = brandName.replace(/[\\/?*[\]]/g, '_').substring(0, 31);

  const worksheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });

  // Header
  const headerRow = worksheet.addRow([
    'Project Name',
    'Project Number',
    'Status',
    'Budget',
    'Allocated Resources',
    'Total Assigned Hours',
  ]);

  applyHeaderStyle(headerRow, SUBHEADER_STYLE);

  // Data rows
  projects.forEach(project => {
    const row = worksheet.addRow([
      project.projectName,
      project.projectNumber || '',
      project.status,
      project.budget || 0,
      project.allocatedResources,
      project.totalAssignedHours,
    ]);

    applyCellStyle(worksheet, row.number, 6, CELL_STYLE);

    // Format budget as currency
    if (project.budget) {
      const budgetCell = worksheet.getCell(row.number, 4);
      budgetCell.numFmt = '#,##0.00';
    }
  });

  // Column widths
  setColumnWidths(worksheet, [30, 15, 12, 15, 15, 15]);
}

// ============================================================================
// File Download Utility
// ============================================================================

/**
 * Generate a filename for the Excel export
 */
export function generateExcelFilename(reportType: string, dateRange?: { start: string; end: string }): string {
  const date = new Date().toISOString().split('T')[0];

  if (dateRange) {
    return `${reportType}-${dateRange.start}-to-${dateRange.end}.xlsx`;
  }

  return `${reportType}-${date}.xlsx`;
}

/**
 * Trigger browser download for Excel content
 */
export function downloadExcelFile(buffer: Buffer, filename: string): void {
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
