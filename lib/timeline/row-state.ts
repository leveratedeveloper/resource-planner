export function hasEmployeeFlag(
  employeeIds: Set<string>,
  employeeId: string
): boolean {
  return employeeIds.has(employeeId);
}

export function setEmployeeFlag(
  employeeIds: Set<string>,
  employeeId: string,
  value: boolean
): Set<string> {
  const next = new Set(employeeIds);

  if (value) {
    next.add(employeeId);
  } else {
    next.delete(employeeId);
  }

  return next;
}

export function getEmployeeFilterSelection(
  selectionsByEmployee: Map<string, Set<string>>,
  employeeId: string
): Set<string> | undefined {
  return selectionsByEmployee.get(employeeId);
}

export function setEmployeeFilterSelection(
  selectionsByEmployee: Map<string, Set<string>>,
  employeeId: string,
  selection: Set<string>
): Map<string, Set<string>> {
  const next = new Map(selectionsByEmployee);
  next.set(employeeId, new Set(selection));
  return next;
}
