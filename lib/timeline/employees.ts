import type { Employee } from "@/lib/query/hooks/useEmployees";

type EmployeePage = {
  data: Employee[];
};

export function getLoadedTimelineEmployees(pages?: EmployeePage[]): Employee[] {
  if (!pages?.length) {
    return [];
  }

  return pages.flatMap((page) => page.data);
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
