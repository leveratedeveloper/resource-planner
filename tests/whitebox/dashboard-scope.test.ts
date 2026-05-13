import { describe, expect, it } from "vitest";
import {
  filterAssignmentsByResourceIds,
  filterEmployeesActiveDuringRange,
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

  it("excludes employees whose work start date is after the comparison window", () => {
    const roster = [
      { id: "emp-1", workStartDate: "2026-04-01" },
      { id: "emp-2", workStartDate: "2026-05-15" },
    ];

    expect(
      filterEmployeesActiveDuringRange(roster, {
        startDate: "2026-04-13",
        endDate: "2026-05-10",
      })
    ).toEqual([roster[0]]);
  });

  it("keeps employees without a work start date in historical rosters", () => {
    const roster = [
      { id: "emp-1", workStartDate: null },
      { id: "emp-2" },
    ];

    expect(
      filterEmployeesActiveDuringRange(roster, {
        startDate: "2026-04-13",
        endDate: "2026-05-10",
      })
    ).toEqual(roster);
  });

  it("keeps employees whose work start date falls inside the comparison window", () => {
    const roster = [
      { id: "emp-1", workStartDate: "2026-04-13" },
      { id: "emp-2", workStartDate: "2026-05-10" },
    ];

    expect(
      filterEmployeesActiveDuringRange(roster, {
        startDate: "2026-04-13",
        endDate: "2026-05-10",
      })
    ).toEqual(roster);
  });
});
