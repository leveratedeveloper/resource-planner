type DepartmentScoped = {
  departmentId?: string | null;
};

type EmployeeScoped = {
  employeeId: string;
};

type WorkStartScoped = {
  workStartDate?: string | null;
};

type DateRangeScoped = {
  startDate: string;
  endDate: string;
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

export function filterEmployeesActiveDuringRange<T extends WorkStartScoped>(
  employees: readonly T[],
  range: DateRangeScoped
) {
  return employees.filter((employee) => {
    if (!employee.workStartDate) return true;
    return employee.workStartDate <= range.endDate;
  });
}
