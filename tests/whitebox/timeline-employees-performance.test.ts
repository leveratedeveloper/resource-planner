import { describe, expect, it } from "vitest";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import {
  getLoadedTimelineEmployees,
  sortEmployeeRecordsByName,
  sortTimelineEmployees,
  shouldUseCompleteEmployeeList,
} from "@/lib/timeline/employees";

const makeEmployee = (id: string): Employee => ({
  id,
  employeeNumber: id,
  fullName: `Employee ${id}`,
  nickname: null,
  email: null,
  photo: null,
  position: "Consultant",
  departmentId: "department-1",
  businessUnitId: null,
  directSupervisorId: null,
  weeklyCapacity: 40,
  workStartDate: null,
  dateOfBirth: null,
  employmentStatus: "active",
  visibility: "active",
  gender: null,
  createdAt: "2026-05-18T00:00:00.000Z",
  updatedAt: "2026-05-18T00:00:00.000Z",
});

describe("timeline employee loading helpers", () => {
  it("flattens loaded employee pages without resetting previous pages", () => {
    const pages = [
      { data: [makeEmployee("employee-1"), makeEmployee("employee-2")], total: 4, hasMore: true },
      { data: [makeEmployee("employee-3"), makeEmployee("employee-4")], total: 4, hasMore: false },
    ];

    expect(getLoadedTimelineEmployees(pages).map((employee) => employee.id)).toEqual([
      "employee-1",
      "employee-2",
      "employee-3",
      "employee-4",
    ]);
  });

  it("uses the complete employee list when filters require full client-side relationship checks", () => {
    expect(shouldUseCompleteEmployeeList({ brandId: "brand-1", department: null })).toBe(true);
    expect(shouldUseCompleteEmployeeList({ brandId: null, department: "department-1" })).toBe(true);
    expect(shouldUseCompleteEmployeeList({ brandId: null, department: null, searchQuery: "project" })).toBe(true);
    expect(shouldUseCompleteEmployeeList({ brandId: null, department: null, searchQuery: "" })).toBe(false);
  });

  it("sorts resources alphabetically by employee name by default", () => {
    const employees = [
      { ...makeEmployee("employee-b"), fullName: "Beta Person" },
      { ...makeEmployee("employee-a"), fullName: "Alpha Person" },
      { ...makeEmployee("employee-current"), fullName: "Current User" },
    ];

    expect(sortTimelineEmployees(employees).map((employee) => employee.id)).toEqual([
      "employee-a",
      "employee-b",
      "employee-current",
    ]);
  });

  it("keeps alphabetical resource order when a later page is appended", () => {
    const firstPage = [
      { ...makeEmployee("employee-b"), fullName: "Beta Person" },
      { ...makeEmployee("employee-d"), fullName: "Delta Person" },
    ];
    const withNextPage = [
      ...firstPage,
      { ...makeEmployee("employee-a"), fullName: "Alpha Person" },
    ];

    expect(sortTimelineEmployees(firstPage).map((employee) => employee.id)).toEqual([
      "employee-b",
      "employee-d",
    ]);
    expect(sortTimelineEmployees(withNextPage).map((employee) => employee.id)).toEqual([
      "employee-a",
      "employee-b",
      "employee-d",
    ]);
  });

  it("sorts raw employee records by full_name before API pagination", () => {
    const employees = [
      { uuid: "employee-b", full_name: "Beta Person" },
      { uuid: "employee-a", full_name: "alpha Person" },
      { uuid: "employee-c", full_name: "Charlie Person" },
    ];

    expect(sortEmployeeRecordsByName(employees).map((employee) => employee.uuid)).toEqual([
      "employee-a",
      "employee-b",
      "employee-c",
    ]);
  });
});
