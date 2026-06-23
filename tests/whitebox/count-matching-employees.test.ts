import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  countMatchingEmployees,
  type FilterPreviewDataset,
} from "@/lib/timeline-v2/count-matching-employees";

// Factory helpers — same style as timeline-v2-visible-rows.test.ts
const makeEmployee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
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
  ...overrides,
});

const makeAssignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "assignment-1",
  employeeId: "employee-1",
  projectId: "project-1",
  taskId: null,
  startDate: "2026-05-18",
  endDate: "2026-05-18",
  hoursPerDay: "8",
  totalHours: null,
  allocationPercentage: null,
  isTimeOff: false,
  isAdjustment: false,
  timeOffTypeId: null,
  category: "Design",
  isBillable: true,
  status: "confirmed",
  note: null,
  createdById: null,
  createdAt: "2026-05-18T00:00:00.000Z",
  updatedAt: "2026-05-18T00:00:00.000Z",
  ...overrides,
});

const makeProject = (overrides: Partial<ProjectOption>): ProjectOption => ({
  id: "project-1",
  name: "Project 1",
  color: "#2563eb",
  status: "active",
  projectType: "campaign",
  brandId: "brand-1",
  startDate: null,
  endDate: null,
  ...overrides,
});

// Two employees on different brands and departments
const projectById = new Map([
  ["project-b1", makeProject({ id: "project-b1", brandId: "brand-1" })],
  ["project-b2", makeProject({ id: "project-b2", brandId: "brand-2" })],
  ["project-b3", makeProject({ id: "project-b3", brandId: "brand-3" })],
]);

const employees = [
  makeEmployee("emp-a", { fullName: "Alpha", departmentId: "dept-design" }),
  makeEmployee("emp-b", { fullName: "Beta", departmentId: "dept-dev" }),
  makeEmployee("emp-c", { fullName: "Charlie", departmentId: "dept-design" }),
];

const assignments: Assignment[] = [
  makeAssignment({ id: "a-1", employeeId: "emp-a", projectId: "project-b1" }),
  makeAssignment({ id: "a-2", employeeId: "emp-b", projectId: "project-b2" }),
  makeAssignment({ id: "a-3", employeeId: "emp-c", projectId: "project-b3" }),
];

const actualAssignments: ActualAssignment[] = [];

const dataset: FilterPreviewDataset = {
  employees,
  assignments,
  actualAssignments,
  projectById,
};

describe("countMatchingEmployees", () => {
  it("empty scope (all arrays empty) returns total employee count", () => {
    const count = countMatchingEmployees(dataset, {
      brandIds: [],
      projectIds: [],
      departmentIds: [],
    });
    expect(count).toBe(3);
  });

  it("brandIds filter returns distinct employees on either brand", () => {
    // emp-a is on brand-1, emp-b is on brand-2, emp-c is on brand-3 — expect 2
    const count = countMatchingEmployees(dataset, {
      brandIds: ["brand-1", "brand-2"],
      projectIds: [],
      departmentIds: [],
    });
    expect(count).toBe(2);
  });

  it("departmentIds filter returns employees in matching departments", () => {
    // emp-a and emp-c are in dept-design; emp-b is in dept-dev
    const count = countMatchingEmployees(dataset, {
      brandIds: [],
      projectIds: [],
      departmentIds: ["dept-design"],
    });
    expect(count).toBe(2);
  });

  it("single brand returns only employees with assignments on that brand", () => {
    const count = countMatchingEmployees(dataset, {
      brandIds: ["brand-3"],
      projectIds: [],
      departmentIds: [],
    });
    expect(count).toBe(1);
  });

  it("non-matching brand returns 0", () => {
    const count = countMatchingEmployees(dataset, {
      brandIds: ["brand-999"],
      projectIds: [],
      departmentIds: [],
    });
    expect(count).toBe(0);
  });
});
