type DepartmentScoped = {
  departmentId?: string | null;
};

type EmployeeScoped = {
  employeeId: string;
};

export function filterEmployeesByDepartment<T extends DepartmentScoped>(
  employees: readonly T[],
  departmentId: string | null
) {
  if (!departmentId) return [...employees];
  return employees.filter((employee) => employee.departmentId === departmentId);
}

export function filterAssignmentsByResourceIds<T extends EmployeeScoped>(
  assignments: readonly T[],
  resourceIds: ReadonlySet<string>
) {
  return assignments.filter((assignment) => resourceIds.has(assignment.employeeId));
}
