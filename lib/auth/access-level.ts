/**
 * Determine access level based on employee department and position
 *
 * RBAC Rules:
 * - Brand Management (any position) -> Full access
 * - Business Consulting (any position) -> Full access
 * - Performance Marketing (any position) -> Full access
 * - Creative + Project Manager -> Full access
 * - Creative (other positions) -> Restricted access
 * - All other departments -> Restricted access
 *
 * @param employee - Employee object containing department_name and position
 * @returns 'full' or 'restricted'
 */
export function determineAccessLevel(employee: any): 'full' | 'restricted' {
  const dept = employee.department_name?.trim().toLowerCase();
  const position = employee.position?.trim();

  // Full access departments (case-insensitive, trimmed)
  if (dept === 'brand management' || dept === 'business consulting' || dept === 'performance marketing') {
    console.log('[Access Level] Full access granted for department:', employee.department_name);
    return 'full';
  }

  // Creative - only Project Manager gets full access
  if (dept === 'creative' && position === 'Project Manager') {
    return 'full';
  }

  console.log('[Access Level] Restricted access for department:', employee.department_name, 'position:', employee.position);
  return 'restricted';
}

/**
 * Check if user can view all data
 */
export function canViewAll(accessLevel: string): boolean {
  return accessLevel === 'full';
}

/**
 * Check if user can only view their own data
 */
export function canViewOwnOnly(accessLevel: string): boolean {
  return accessLevel === 'restricted';
}

/**
 * Get a filter for queries based on access level
 *
 * @param accessLevel - The user's access level
 * @param employeeId - The user's employee ID (for restricted access)
 * @returns Object with filter conditions
 */
export function getAccessFilter(accessLevel: string, employeeId?: number) {
  if (accessLevel === 'full') {
    return {}; // No filtering for full access
  }

  if (employeeId) {
    return { employee_id: employeeId };
  }

  return {};
}
