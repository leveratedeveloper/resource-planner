import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  filterTimelineEmployees,
  getLoadedTimelineEmployees,
  sortEmployeeRecordsByName,
  sortTimelineEmployees,
  shouldUseCompleteEmployeeList,
} from "@/lib/timeline-v2/employees";

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

const makeActualAssignment = (overrides: Partial<ActualAssignment>): ActualAssignment => ({
  uuid: "actual-1",
  employeeUuid: "employee-1",
  projectUuid: "project-1",
  taskUuid: null,
  startDate: "2026-05-18",
  endDate: "2026-05-18",
  hoursPerDay: 8,
  allocationPercentage: null,
  isTimeOff: false,
  timeOffTypeUuid: null,
  category: "Design",
  isBillable: true,
  status: "confirmed",
  note: null,
  createdByUuid: null,
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
    expect(shouldUseCompleteEmployeeList({ brandId: null, department: null, projectId: "project-1" })).toBe(true);
    expect(shouldUseCompleteEmployeeList({ brandId: null, department: null, searchQuery: "project" })).toBe(true);
    expect(shouldUseCompleteEmployeeList({ brandId: null, department: null, searchQuery: "" })).toBe(false);
  });

  it("filters resources by selected project using planned and actual assignments", () => {
    const employees = [
      makeEmployee("employee-1", { fullName: "Alpha Person" }),
      makeEmployee("employee-2", { fullName: "Beta Person" }),
      makeEmployee("employee-3", { fullName: "Gamma Person" }),
    ];

    const visible = filterTimelineEmployees({
      employees,
      dateFilteredAssignments: [
        makeAssignment({ id: "planned-match", employeeId: "employee-2", projectId: "project-1" }),
        makeAssignment({ id: "planned-other", employeeId: "employee-3", projectId: "project-2" }),
      ],
      visibleActualAssignments: [
        makeActualAssignment({ uuid: "actual-match", employeeUuid: "employee-1", projectUuid: "project-1" }),
      ],
      projectById: new Map(),
      filters: {
        brandId: null,
        department: null,
        projectId: "project-1",
        searchQuery: "",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-1", "employee-2"]);
  });

  it("returns no resources when selected project has no assignments in the visible timeline range", () => {
    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-1", { fullName: "Alpha Person" }),
        makeEmployee("employee-2", { fullName: "Beta Person" }),
      ],
      dateFilteredAssignments: [
        makeAssignment({ id: "other-project", employeeId: "employee-1", projectId: "project-2" }),
      ],
      visibleActualAssignments: [
        makeActualAssignment({ uuid: "other-actual", employeeUuid: "employee-2", projectUuid: "project-3" }),
      ],
      projectById: new Map(),
      filters: {
        brandId: null,
        department: null,
        projectId: "project-1",
        searchQuery: "",
      },
    });

    expect(visible).toEqual([]);
  });

  it("returns no resources when selected brand has no matching employees or assignments", () => {
    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-1", { fullName: "Alpha Person" }),
        makeEmployee("employee-2", { fullName: "Beta Person" }),
      ],
      dateFilteredAssignments: [],
      visibleActualAssignments: [],
      projectById: new Map(),
      filters: {
        brandId: "brand-empty",
        department: null,
        projectId: null,
        searchQuery: "",
      },
    });

    expect(visible).toEqual([]);
  });

  it("filters resources by selected brand using visible planned assignments and keeps unassigned members out", () => {
    const projectById = new Map([
      ["project-brand", makeProject({ id: "project-brand", brandId: "brand-1" })],
      ["project-other", makeProject({ id: "project-other", brandId: "brand-2" })],
    ]);

    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-brand-member"),
        makeEmployee("employee-visible-brand-work"),
        makeEmployee("employee-all-time-brand-work"),
        makeEmployee("employee-other-brand-work"),
      ],
      dateFilteredAssignments: [
        makeAssignment({
          id: "visible-brand-work",
          employeeId: "employee-visible-brand-work",
          projectId: "project-brand",
        }),
        makeAssignment({
          id: "visible-other-brand-work",
          employeeId: "employee-other-brand-work",
          projectId: "project-other",
        }),
      ],
      visibleActualAssignments: [],
      projectById,
      filters: {
        brandId: "brand-1",
        department: null,
        projectId: null,
        searchQuery: "",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-visible-brand-work"]);
  });

  it("filters resources by selected brand when the generic project map is missing that brand project", () => {
    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-visible-brand-work"),
        makeEmployee("employee-other-brand-work"),
      ],
      dateFilteredAssignments: [
        makeAssignment({
          id: "visible-brand-work",
          employeeId: "employee-visible-brand-work",
          projectId: "project-brand-not-in-generic-map",
        }),
        makeAssignment({
          id: "visible-other-brand-work",
          employeeId: "employee-other-brand-work",
          projectId: "project-other",
        }),
      ],
      visibleActualAssignments: [],
      projectById: new Map([
        ["project-other", makeProject({ id: "project-other", brandId: "brand-2" })],
      ]),
      selectedBrandProjectIds: new Set(["project-brand-not-in-generic-map"]),
      filters: {
        brandId: "brand-1",
        department: null,
        projectId: null,
        searchQuery: "",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-visible-brand-work"]);
  });

  it("filters resources by selected brand using visible actual assignments", () => {
    const projectById = new Map([
      ["project-brand", makeProject({ id: "project-brand", brandId: "brand-1" })],
      ["project-other", makeProject({ id: "project-other", brandId: "brand-2" })],
    ]);

    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-visible-actual-brand"),
        makeEmployee("employee-visible-actual-other"),
      ],
      dateFilteredAssignments: [],
      visibleActualAssignments: [
        makeActualAssignment({
          uuid: "actual-brand",
          employeeUuid: "employee-visible-actual-brand",
          projectUuid: "project-brand",
        }),
        makeActualAssignment({
          uuid: "actual-other",
          employeeUuid: "employee-visible-actual-other",
          projectUuid: "project-other",
        }),
      ],
      projectById,
      filters: {
        brandId: "brand-1",
        department: null,
        projectId: null,
        searchQuery: "",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-visible-actual-brand"]);
  });

  it("combines brand, department, search, and project filters before sorting resources", () => {
    const projectById = new Map([
      ["project-1", makeProject({ id: "project-1", brandId: "brand-1" })],
      ["project-2", makeProject({ id: "project-2", brandId: "brand-2" })],
    ]);

    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-b", {
          fullName: "Beta Designer",
          departmentId: "department-1",
          position: "Designer",
        }),
        makeEmployee("employee-a", {
          fullName: "Alpha Designer",
          departmentId: "department-1",
          position: "Designer",
        }),
        makeEmployee("employee-c", {
          fullName: "Gamma Developer",
          departmentId: "department-2",
          position: "Developer",
        }),
      ],
      dateFilteredAssignments: [
        makeAssignment({ id: "project-match-a", employeeId: "employee-a", projectId: "project-1" }),
        makeAssignment({ id: "project-match-c", employeeId: "employee-c", projectId: "project-1" }),
      ],
      visibleActualAssignments: [],
      projectById,
      filters: {
        brandId: "brand-1",
        department: "department-1",
        projectId: "project-1",
        searchQuery: "designer",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-a"]);
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

  it("keeps all visible assignments available after a project resource filter chooses employees", () => {
    const employees = [
      makeEmployee("employee-1", { fullName: "Alpha Person" }),
      makeEmployee("employee-2", { fullName: "Beta Person" }),
    ];

    const dateFilteredAssignments = [
      makeAssignment({ id: "selected-project", employeeId: "employee-1", projectId: "project-1" }),
      makeAssignment({ id: "other-project-same-employee", employeeId: "employee-1", projectId: "project-2" }),
      makeAssignment({ id: "other-employee", employeeId: "employee-2", projectId: "project-2" }),
    ];

    const visible = filterTimelineEmployees({
      employees,
      dateFilteredAssignments,
      visibleActualAssignments: [],
      projectById: new Map(),
      filters: {
        brandId: null,
        department: null,
        projectId: "project-1",
        searchQuery: "",
      },
    });

    const assignmentsByVisibleEmployee = new Map(
      visible.map((employee) => [
        employee.id,
        dateFilteredAssignments.filter((assignment) => assignment.employeeId === employee.id),
      ])
    );

    expect(visible.map((employee) => employee.id)).toEqual(["employee-1"]);
    expect(assignmentsByVisibleEmployee.get("employee-1")?.map((assignment) => assignment.id)).toEqual([
      "selected-project",
      "other-project-same-employee",
    ]);
  });

  it("delegates brand and project resource matching to the unified timeline scope filter module", () => {
    const source = readFileSync("lib/timeline-v2/employees.ts", "utf8");

    expect(source).toContain("getMatchingTimelineEmployeeIds");
    expect(source).not.toContain("function getBrandEmployeeIds");
    expect(source).not.toContain("const projectEmployeeIds = new Set<string>()");
  });
});
