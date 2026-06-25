import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline-v2/employees";
import { getVisibleEmployeeIds } from "@/lib/timeline-v2/visible-rows";

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

const noFilters = {
  brandIds: [],
  departments: [],
  projectIds: [],
  searchQuery: "",
};

describe("getVisibleEmployeeIds", () => {
  it("returns all employee ids in filterTimelineEmployees' alphabetical order when no filters are active", () => {
    const employees = [
      makeEmployee("employee-b", { fullName: "Beta Person" }),
      makeEmployee("employee-a", { fullName: "Alpha Person" }),
      makeEmployee("employee-c", { fullName: "Charlie Person" }),
    ];

    const ids = getVisibleEmployeeIds({
      employees,
      assignments: [],
      projectByKey: new Map(),
      selectedBrandProjectKeys: new Set(),
      filters: noFilters,
    });

    expect(ids).toEqual(["employee-a", "employee-b", "employee-c"]);
  });

  it("keeps only employees with assignments on the selected brand's projects", () => {
    const projectByKey = new Map([
      ["campaign:project-brand", makeProject({ id: "project-brand", projectKey: "campaign:project-brand", brandId: "brand-1" })],
      ["campaign:project-other", makeProject({ id: "project-other", projectKey: "campaign:project-other", brandId: "brand-2" })],
    ]);

    const ids = getVisibleEmployeeIds({
      employees: [
        makeEmployee("employee-brand-member"),
        makeEmployee("employee-visible-brand-work"),
        makeEmployee("employee-other-brand-work"),
      ],
      assignments: [
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
      selectedBrandProjectKeys: new Set(["campaign:project-brand"]),
      filters: { ...noFilters, brandIds: ["brand-1"] },
    });

    expect(ids).toEqual(["employee-visible-brand-work"]);
  });

  it("filters by department (single)", () => {
    const ids = getVisibleEmployeeIds({
      employees: [
        makeEmployee("employee-design", { departmentId: "department-design" }),
        makeEmployee("employee-dev", { departmentId: "department-dev" }),
      ],
      assignments: [],
      projectByKey: new Map(),
      selectedBrandProjectKeys: new Set(),
      filters: { ...noFilters, departments: ["department-design"] },
    });

    expect(ids).toEqual(["employee-design"]);
  });

  it("filters by ANY of multiple departments", () => {
    const ids = getVisibleEmployeeIds({
      employees: [
        makeEmployee("employee-design", {
          fullName: "Design Person",
          departmentId: "department-design",
        }),
        makeEmployee("employee-dev", {
          fullName: "Dev Person",
          departmentId: "department-dev",
        }),
        makeEmployee("employee-hr", {
          fullName: "HR Person",
          departmentId: "department-hr",
        }),
      ],
      assignments: [],
      projectByKey: new Map(),
      selectedBrandProjectKeys: new Set(),
      filters: { ...noFilters, departments: ["department-design", "department-dev"] },
    });

    expect(ids).toEqual(["employee-design", "employee-dev"]);
  });

  it("filters by ANY of multiple brands", () => {
    const projectByKey = new Map([
      ["campaign:project-b1", makeProject({ id: "project-b1", projectKey: "campaign:project-b1", brandId: "brand-1" })],
      ["campaign:project-b2", makeProject({ id: "project-b2", projectKey: "campaign:project-b2", brandId: "brand-2" })],
      ["campaign:project-b3", makeProject({ id: "project-b3", projectKey: "campaign:project-b3", brandId: "brand-3" })],
    ]);

    const ids = getVisibleEmployeeIds({
      employees: [
        makeEmployee("employee-brand1", { fullName: "Brand1 Person" }),
        makeEmployee("employee-brand2", { fullName: "Brand2 Person" }),
        makeEmployee("employee-brand3", { fullName: "Brand3 Person" }),
      ],
      assignments: [
        makeAssignment({ id: "a-b1", employeeId: "employee-brand1", projectKey: "campaign:project-b1" }),
        makeAssignment({ id: "a-b2", employeeId: "employee-brand2", projectKey: "campaign:project-b2" }),
        makeAssignment({ id: "a-b3", employeeId: "employee-brand3", projectKey: "campaign:project-b3" }),
      ],
      projectByKey,
      selectedBrandProjectKeys: new Set(["campaign:project-b1", "campaign:project-b2"]),
      filters: { ...noFilters, brandIds: ["brand-1", "brand-2"] },
    });

    expect(ids).toEqual(["employee-brand1", "employee-brand2"]);
  });

  it("empty arrays behave like no filters and return all employees", () => {
    const employees = [
      makeEmployee("employee-x", { fullName: "X Person", departmentId: "dept-x" }),
      makeEmployee("employee-y", { fullName: "Y Person", departmentId: "dept-y" }),
    ];

    const ids = getVisibleEmployeeIds({
      employees,
      assignments: [],
      projectByKey: new Map(),
      selectedBrandProjectKeys: new Set(),
      filters: noFilters,
    });

    expect(ids).toEqual(["employee-x", "employee-y"]);
  });

  it("matches searchQuery against employee name and position", () => {
    const employees = [
      makeEmployee("employee-named", { fullName: "Designer Dana", position: "Consultant" }),
      makeEmployee("employee-positioned", { fullName: "Eko Person", position: "Senior Designer" }),
      makeEmployee("employee-unrelated", { fullName: "Frank Person", position: "Developer" }),
    ];

    const ids = getVisibleEmployeeIds({
      employees,
      assignments: [],
      projectByKey: new Map(),
      selectedBrandProjectKeys: new Set(),
      filters: { ...noFilters, searchQuery: "designer" },
    });

    expect(ids).toEqual(["employee-named", "employee-positioned"]);
  });

  it("returns exactly filterTimelineEmployees(...).map(e => e.id) for a mixed fixture", () => {
    const employees = [
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
      makeEmployee("employee-d", {
        fullName: "Delta Outsider",
        departmentId: "department-1",
        position: "Designer",
      }),
    ];
    const assignments = [
      makeAssignment({ id: "match-a", employeeId: "employee-a", projectKey: "campaign:project-1" }),
      makeAssignment({ id: "match-b", employeeId: "employee-b", projectKey: "campaign:project-1" }),
      makeAssignment({ id: "other-brand-d", employeeId: "employee-d", projectKey: "campaign:project-2" }),
    ];
    const projectByKey = new Map([
      ["campaign:project-1", makeProject({ id: "project-1", projectKey: "campaign:project-1", brandId: "brand-1" })],
      ["campaign:project-2", makeProject({ id: "project-2", projectKey: "campaign:project-2", brandId: "brand-2" })],
    ]);
    const selectedBrandProjectKeys = new Set(["campaign:project-1"]);
    const filters = {
      brandIds: ["brand-1"],
      departments: [],
      projectIds: ["project-1"],
      searchQuery: "",
    };

    const ids = getVisibleEmployeeIds({
      employees,
      assignments,
      projectByKey,
      selectedBrandProjectKeys,
      filters,
    });

    const expected = filterTimelineEmployees({
      employees,
      dateFilteredAssignments: assignments,
      projectByKey,
      selectedBrandProjectKeys,
      filters,
    }).map((employee) => employee.id);

    expect(ids).toEqual(expected);
    // Guard against a vacuous cross-check: employee-a and employee-b are on
    // brand-1 via project-1; employee-d is on brand-2 (excluded); employee-c
    // has no assignments (excluded by brand filter).
    expect(expected).toEqual(["employee-a", "employee-b"]);
  });
});
