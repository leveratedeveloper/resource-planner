import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  filterTimelineEmployees,
  sortEmployeeRecordsByName,
  sortTimelineEmployees,
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
  projectKey: "campaign:project-1",
  startDate: "2026-05-18",
  endDate: "2026-05-18",
  status: "confirmed",
  note: null,
  allocations: [{ month: "2026-05-01", plannedHours: 160, kind: "plan" }],
  createdBy: null,
  updatedBy: null,
  ...overrides,
});

const makeProject = (overrides: Partial<ProjectOption>): ProjectOption => ({
  id: "project-1",
  projectKey: "campaign:project-1",
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
  // The rows here mirror MinimalTimelineEmployee EXACTLY (the bootstrap wire
  // shape — the timeline's only employee rows). If the filter starts reading a
  // field the wire doesn't carry, this fails; the broad `as Employee[]` cast
  // in the hook would not.
  it("matches the department filter on bootstrap-minimal employee rows", () => {
    const minimalRows = [
      {
        id: "employee-1",
        fullName: "Alpha Person",
        position: "Designer",
        weeklyCapacity: 40,
        departmentId: "department-1",
        department: { id: "department-1", name: "Creative", color: "#000037" },
      },
      {
        id: "employee-2",
        fullName: "Beta Person",
        position: "Analyst",
        weeklyCapacity: 40,
        departmentId: "department-2",
        department: { id: "department-2", name: "Finance", color: "#000037" },
      },
    ] as unknown as Employee[];

    const visible = filterTimelineEmployees({
      employees: minimalRows,
      dateFilteredAssignments: [],
      projectByKey: new Map(),
      filters: { brandIds: [], departments: ["department-1"], projectIds: [] },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-1"]);
  });

  it("filters resources by selected project using planned assignments", () => {
    const employees = [
      makeEmployee("employee-1", { fullName: "Alpha Person" }),
      makeEmployee("employee-2", { fullName: "Beta Person" }),
      makeEmployee("employee-3", { fullName: "Gamma Person" }),
    ];

    const visible = filterTimelineEmployees({
      employees,
      dateFilteredAssignments: [
        makeAssignment({ id: "planned-match", employeeId: "employee-2", projectKey: "campaign:project-1" }),
        makeAssignment({ id: "planned-other", employeeId: "employee-3", projectKey: "campaign:project-2" }),
      ],
      projectByKey: new Map([
        ["campaign:project-1", makeProject({ id: "project-1", projectKey: "campaign:project-1" })],
        ["campaign:project-2", makeProject({ id: "project-2", projectKey: "campaign:project-2" })],
      ]),
      filters: {
        brandIds: [],
        departments: [],
        projectIds: ["project-1"],
        searchQuery: "",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-2"]);
  });

  it("returns no resources when selected project has no assignments in the visible timeline range", () => {
    const visible = filterTimelineEmployees({
      employees: [
        makeEmployee("employee-1", { fullName: "Alpha Person" }),
        makeEmployee("employee-2", { fullName: "Beta Person" }),
      ],
      dateFilteredAssignments: [
        makeAssignment({ id: "other-project", employeeId: "employee-1", projectKey: "campaign:project-2" }),
      ],
      projectByKey: new Map([
        ["campaign:project-2", makeProject({ id: "project-2", projectKey: "campaign:project-2" })],
      ]),
      filters: {
        brandIds: [],
        departments: [],
        projectIds: ["project-1"],
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
      projectByKey: new Map(),
      filters: {
        brandIds: ["brand-empty"],
        departments: [],
        projectIds: [],
        searchQuery: "",
      },
    });

    expect(visible).toEqual([]);
  });

  it("filters resources by selected brand using visible planned assignments and keeps unassigned members out", () => {
    const projectByKey = new Map([
      ["campaign:project-brand", makeProject({ id: "project-brand", projectKey: "campaign:project-brand", brandId: "brand-1" })],
      ["campaign:project-other", makeProject({ id: "project-other", projectKey: "campaign:project-other", brandId: "brand-2" })],
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
          projectKey: "campaign:project-brand",
        }),
        makeAssignment({
          id: "visible-other-brand-work",
          employeeId: "employee-other-brand-work",
          projectKey: "campaign:project-other",
        }),
      ],
      projectByKey,
      filters: {
        brandIds: ["brand-1"],
        departments: [],
        projectIds: [],
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
          projectKey: "campaign:project-brand-not-in-generic-map",
        }),
        makeAssignment({
          id: "visible-other-brand-work",
          employeeId: "employee-other-brand-work",
          projectKey: "campaign:project-other",
        }),
      ],
      projectByKey: new Map([
        ["campaign:project-other", makeProject({ id: "project-other", projectKey: "campaign:project-other", brandId: "brand-2" })],
      ]),
      selectedBrandProjectKeys: new Set(["campaign:project-brand-not-in-generic-map"]),
      filters: {
        brandIds: ["brand-1"],
        departments: [],
        projectIds: [],
        searchQuery: "",
      },
    });

    expect(visible.map((employee) => employee.id)).toEqual(["employee-visible-brand-work"]);
  });

  it("combines brand, department, search, and project filters before sorting resources", () => {
    const projectByKey = new Map([
      ["campaign:project-1", makeProject({ id: "project-1", projectKey: "campaign:project-1", brandId: "brand-1" })],
      ["campaign:project-2", makeProject({ id: "project-2", projectKey: "campaign:project-2", brandId: "brand-2" })],
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
        makeAssignment({ id: "project-match-a", employeeId: "employee-a", projectKey: "campaign:project-1" }),
        makeAssignment({ id: "project-match-c", employeeId: "employee-c", projectKey: "campaign:project-1" }),
      ],
      projectByKey,
      filters: {
        brandIds: ["brand-1"],
        departments: ["department-1"],
        projectIds: ["project-1"],
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
      makeAssignment({ id: "selected-project", employeeId: "employee-1", projectKey: "campaign:project-1" }),
      makeAssignment({ id: "other-project-same-employee", employeeId: "employee-1", projectKey: "campaign:project-2" }),
      makeAssignment({ id: "other-employee", employeeId: "employee-2", projectKey: "campaign:project-2" }),
    ];

    const visible = filterTimelineEmployees({
      employees,
      dateFilteredAssignments,
      projectByKey: new Map([
        ["campaign:project-1", makeProject({ id: "project-1", projectKey: "campaign:project-1" })],
        ["campaign:project-2", makeProject({ id: "project-2", projectKey: "campaign:project-2" })],
      ]),
      filters: {
        brandIds: [],
        departments: [],
        projectIds: ["project-1"],
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
