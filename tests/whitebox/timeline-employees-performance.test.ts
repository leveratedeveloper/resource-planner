import { describe, expect, it } from "vitest";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import {
  getLoadedTimelineEmployees,
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
});
