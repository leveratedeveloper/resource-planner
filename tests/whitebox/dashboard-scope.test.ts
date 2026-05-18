import { describe, expect, it } from "vitest";
import {
  filterAssignmentsByResourceIds,
  filterEmployeesByDepartment,
} from "@/lib/dashboard/dashboard-scope";

const employees = [
  { id: "emp-1", departmentId: "dept-design", fullName: "Ari" },
  { id: "emp-2", departmentId: "dept-dev", fullName: "Bea" },
  { id: "emp-3", departmentId: null, fullName: "Cam" },
];

const assignments = [
  { id: "assignment-1", employeeId: "emp-1" },
  { id: "assignment-2", employeeId: "emp-2" },
  { id: "assignment-3", employeeId: "emp-4" },
];

describe("dashboard scope helpers", () => {
  it("includes all employees when no department is selected", () => {
    expect(filterEmployeesByDepartment(employees, null)).toEqual(employees);
  });

  it("filters employees to the selected department while preserving unassigned only when selected", () => {
    expect(filterEmployeesByDepartment(employees, "dept-design")).toEqual([employees[0]]);
  });

  it("filters assignments to scoped employee ids", () => {
    expect(filterAssignmentsByResourceIds(assignments, new Set(["emp-1", "emp-3"]))).toEqual([
      assignments[0],
    ]);
  });
});
