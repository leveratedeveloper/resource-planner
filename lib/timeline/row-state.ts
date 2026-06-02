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

type TimelineRowStateResetInput = {
  brandId: string | null;
  department: string | null;
  projectId: string | null;
  category: string | null;
  status: string | null;
  searchQuery?: string;
};

function filterValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : "all";
}

export function getTimelineRowStateResetKey({
  brandId,
  department,
  projectId,
  category,
  status,
  searchQuery,
}: TimelineRowStateResetInput): string {
  return [
    `brand=${filterValue(brandId)}`,
    `department=${filterValue(department)}`,
    `project=${filterValue(projectId)}`,
    `category=${filterValue(category)}`,
    `status=${filterValue(status)}`,
    `search=${filterValue(searchQuery)}`,
  ].join("|");
}
