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

