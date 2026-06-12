import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline/employees";
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

const noFilters = {
  brandId: null,
  department: null,
  projectId: null,
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
      actualAssignments: [],
      projectById: new Map(),
      selectedBrandProjectIds: new Set(),
      filters: noFilters,
    });

    expect(ids).toEqual(["employee-a", "employee-b", "employee-c"]);
  });

  it("keeps only employees with assignments on the selected brand's projects", () => {
    const projectById = new Map([
      ["project-brand", makeProject({ id: "project-brand", brandId: "brand-1" })],
      ["project-other", makeProject({ id: "project-other", brandId: "brand-2" })],
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
          projectId: "project-brand",
        }),
        makeAssignment({
          id: "visible-other-brand-work",
          employeeId: "employee-other-brand-work",
          projectId: "project-other",
        }),
      ],
      actualAssignments: [],
      projectById,
      selectedBrandProjectIds: new Set(["project-brand"]),
      filters: { ...noFilters, brandId: "brand-1" },
    });

    expect(ids).toEqual(["employee-visible-brand-work"]);
  });

  it("matches brand membership through actual assignments", () => {
    const projectById = new Map([
      ["project-brand", makeProject({ id: "project-brand", brandId: "brand-1" })],
      ["project-other", makeProject({ id: "project-other", brandId: "brand-2" })],
    ]);

    const ids = getVisibleEmployeeIds({
      employees: [
        makeEmployee("employee-actual-brand"),
        makeEmployee("employee-actual-other"),
      ],
      assignments: [],
      actualAssignments: [
        makeActualAssignment({
          uuid: "actual-brand",
          employeeUuid: "employee-actual-brand",
          projectUuid: "project-brand",
        }),
        makeActualAssignment({
          uuid: "actual-other",
          employeeUuid: "employee-actual-other",
          projectUuid: "project-other",
        }),
      ],
      projectById,
      selectedBrandProjectIds: new Set(["project-brand"]),
      filters: { ...noFilters, brandId: "brand-1" },
    });

    expect(ids).toEqual(["employee-actual-brand"]);
  });

  it("filters by department", () => {
    const ids = getVisibleEmployeeIds({
      employees: [
        makeEmployee("employee-design", { departmentId: "department-design" }),
        makeEmployee("employee-dev", { departmentId: "department-dev" }),
      ],
      assignments: [],
      actualAssignments: [],
      projectById: new Map(),
      selectedBrandProjectIds: new Set(),
      filters: { ...noFilters, department: "department-design" },
    });

    expect(ids).toEqual(["employee-design"]);
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
      actualAssignments: [],
      projectById: new Map(),
      selectedBrandProjectIds: new Set(),
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
      makeAssignment({ id: "match-a", employeeId: "employee-a", projectId: "project-1" }),
      makeAssignment({ id: "match-b", employeeId: "employee-b", projectId: "project-1" }),
      makeAssignment({ id: "other-brand-d", employeeId: "employee-d", projectId: "project-2" }),
    ];
    const actualAssignments = [
      makeActualAssignment({
        uuid: "actual-c",
        employeeUuid: "employee-c",
        projectUuid: "project-1",
      }),
    ];
    const projectById = new Map([
      ["project-1", makeProject({ id: "project-1", brandId: "brand-1" })],
      ["project-2", makeProject({ id: "project-2", brandId: "brand-2" })],
    ]);
    const selectedBrandProjectIds = new Set(["project-1"]);
    const filters = {
      brandId: "brand-1",
      department: null,
      projectId: "project-1",
      searchQuery: "",
    };

    const ids = getVisibleEmployeeIds({
      employees,
      assignments,
      actualAssignments,
      projectById,
      selectedBrandProjectIds,
      filters,
    });

    const expected = filterTimelineEmployees({
      employees,
      dateFilteredAssignments: assignments,
      visibleActualAssignments: actualAssignments,
      projectById,
      selectedBrandProjectIds,
      filters,
    }).map((employee) => employee.id);

    expect(ids).toEqual(expected);
    // Guard against a vacuous cross-check: the fixture must produce a
    // non-trivial, sorted subset (employee-c enters via its actual
    // assignment on project-1; employee-d is on the other brand).
    expect(expected).toEqual(["employee-a", "employee-b", "employee-c"]);
  });
});
