import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Department } from "@/lib/query/hooks/useDepartments";
import type { Employee } from "@/lib/query/hooks/useEmployees";

export interface AggregatedAssignments {
  name: string;
  color: string;
  assignments: Assignment[];
}

export function getAssignmentDepartmentId(
  assignment: Assignment,
  employeeById: Map<string, Employee>
) {
  const employee = employeeById.get(assignment.employeeId);
  const departmentId =
    assignment.employee?.department?.id ??
    employee?.department?.id ??
    employee?.departmentId;

  return departmentId ? String(departmentId) : null;
}

export function groupAssignmentsByDepartment({
  assignments,
  departments,
  employeeById,
  selectedDepartmentId,
  searchQuery,
}: {
  assignments: Assignment[];
  departments: Department[];
  employeeById: Map<string, Employee>;
  selectedDepartmentId?: string | null;
  searchQuery?: string;
}) {
  const grouped = new Map<string, AggregatedAssignments>();
  let visibleDepartments = departments;

  if (selectedDepartmentId) {
    visibleDepartments = visibleDepartments.filter(
      (department) => department.id === selectedDepartmentId
    );
  }

  const normalizedQuery = searchQuery?.toLowerCase().trim();
  if (normalizedQuery) {
    visibleDepartments = visibleDepartments.filter((department) =>
      department.name.toLowerCase().includes(normalizedQuery)
    );
  }

  for (const department of visibleDepartments) {
    grouped.set(department.id, {
      name: department.name,
      color: department.color || "#6b7280",
      assignments: [],
    });
  }

  for (const assignment of assignments) {
    const departmentId = getAssignmentDepartmentId(assignment, employeeById);
    if (!departmentId) continue;

    grouped.get(departmentId)?.assignments.push(assignment);
  }

  return new Map(
    [...grouped.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  );
}
