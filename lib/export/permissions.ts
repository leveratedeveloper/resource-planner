/**
 * Export Permissions
 * Access control for export functionality based on user access level
 */

import { getSession } from '@/lib/auth/session';
import type { SessionData } from '@/lib/auth/session';

/**
 * Export filter based on access level
 */
export interface ExportAccessFilter {
  canExportAll: boolean;
  employeeId?: number;
  employeeUuid?: string;
  deptId?: number;
}

/**
 * Get export access filter based on session
 * Full access users can export all data
 * Restricted users can only export their own data
 */
export async function getExportAccessFilter(): Promise<ExportAccessFilter> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized: No session found');
  }

  // Full access users can export everything
  if (session.access.can_view_all) {
    return {
      canExportAll: true,
    };
  }

  // Restricted users can only export their own data
  return {
    canExportAll: false,
    employeeId: session.employee.id,
    employeeUuid: session.employee.uuid,
    deptId: session.employee.dept_id,
  };
}

/**
 * Check if user can export a specific employee's data
 */
export async function canExportEmployeeData(employeeUuid: string): Promise<boolean> {
  try {
    const filter = await getExportAccessFilter();

    if (filter.canExportAll) {
      return true;
    }

    return filter.employeeUuid === employeeUuid;
  } catch {
    return false;
  }
}

/**
 * Apply access filter to a list of employee UUIDs
 */
export async function filterAccessibleEmployees(employeeUuids: string[]): Promise<string[]> {
  const filter = await getExportAccessFilter();

  if (filter.canExportAll) {
    return employeeUuids;
  }

  return employeeUuids.filter(uuid => uuid === filter.employeeUuid);
}

/**
 * Get export metadata for response
 */
export interface ExportMetadata {
  exportedBy: string;
  exportedAt: string;
  accessLevel: string;
  isFullExport: boolean;
  filteredEmployee?: string;
}

export async function getExportMetadata(): Promise<ExportMetadata> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized: No session found');
  }

  return {
    exportedBy: session.employee.full_name,
    exportedAt: new Date().toISOString(),
    accessLevel: session.access.level,
    isFullExport: session.access.can_view_all,
    filteredEmployee: session.access.can_view_own_only ? session.employee.full_name : undefined,
  };
}
