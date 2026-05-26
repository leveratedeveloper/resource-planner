import type { Employee } from "@/lib/query/hooks/useEmployees";

type EmployeePage = {
  data: Employee[];
};

type EmployeeNameRecord = {
  fullName?: string | null;
  full_name?: string | null;
};

export function getLoadedTimelineEmployees(pages?: EmployeePage[]): Employee[] {
  if (!pages?.length) {
    return [];
  }

  return pages.flatMap((page) => page.data);
}

export function sortTimelineEmployees(employees: Employee[]): Employee[] {
  return sortEmployeeRecordsByName(employees);
}

export function sortEmployeeRecordsByName<T extends EmployeeNameRecord>(employees: T[]): T[] {
  return [...employees].sort((a, b) => {
    const aName = a.fullName ?? a.full_name ?? "";
    const bName = b.fullName ?? b.full_name ?? "";
    return aName.localeCompare(bName, undefined, { sensitivity: "base" });
  });
}

export function shouldUseCompleteEmployeeList({
  brandId,
  department,
  searchQuery,
}: {
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
}): boolean {
  return !!brandId || !!department || !!searchQuery?.trim();
}
