import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  getMatchingTimelineEmployeeIds,
  hasActiveTimelineScopeFilter,
} from "@/lib/timeline/timeline-filters";

const makeAssignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "assignment-1",
  employeeId: "employee-1",
  projectId: "project-1",
  taskId: null,
  startDate: "2026-06-01",
  endDate: "2026-06-01",
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
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

const makeActualAssignment = (overrides: Partial<ActualAssignment>): ActualAssignment => ({
  uuid: "actual-1",
  employeeUuid: "employee-1",
  projectUuid: "project-1",
  taskUuid: null,
  startDate: "2026-06-01",
  endDate: "2026-06-01",
  hoursPerDay: 8,
  allocationPercentage: null,
  isTimeOff: false,
  timeOffTypeUuid: null,
  category: "Design",
  isBillable: true,
  status: "confirmed",
  note: null,
  createdByUuid: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
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

describe("timeline scope filters", () => {
  it("reports whether a brand or project resource filter is active", () => {
    expect(hasActiveTimelineScopeFilter({ brandId: null, projectId: null })).toBe(false);
    expect(hasActiveTimelineScopeFilter({ brandId: "brand-1", projectId: null })).toBe(true);
    expect(hasActiveTimelineScopeFilter({ brandId: null, projectId: "project-1" })).toBe(true);
  });

  it("returns null when no brand or project filter is active", () => {
    const employeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments: [makeAssignment({ employeeId: "employee-1" })],
      visibleActualAssignments: [],
      projectById: new Map([["project-1", makeProject({ id: "project-1", brandId: "brand-1" })]]),
      selectedBrandProjectIds: new Set(),
      filters: { brandId: null, projectId: null },
    });

    expect(employeeIds).toBeNull();
  });

  it("matches brand resources from visible planned and actual assignments", () => {
    const employeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments: [
        makeAssignment({ id: "planned-brand", employeeId: "employee-planned", projectId: "project-brand" }),
        makeAssignment({ id: "planned-other", employeeId: "employee-other", projectId: "project-other" }),
      ],
      visibleActualAssignments: [
        makeActualAssignment({ uuid: "actual-brand", employeeUuid: "employee-actual", projectUuid: "project-brand" }),
        makeActualAssignment({ uuid: "actual-other", employeeUuid: "employee-actual-other", projectUuid: "project-other" }),
      ],
      projectById: new Map([
        ["project-brand", makeProject({ id: "project-brand", brandId: "brand-1" })],
        ["project-other", makeProject({ id: "project-other", brandId: "brand-2" })],
      ]),
      selectedBrandProjectIds: new Set(),
      filters: { brandId: "brand-1", projectId: null },
    });

    expect(Array.from(employeeIds ?? []).sort()).toEqual(["employee-actual", "employee-planned"]);
  });

  it("matches brand resources when the selected brand project is missing from the generic project map", () => {
    const employeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments: [
        makeAssignment({
          id: "planned-brand",
          employeeId: "employee-planned",
          projectId: "project-from-brand-summary",
        }),
      ],
      visibleActualAssignments: [
        makeActualAssignment({
          uuid: "actual-brand",
          employeeUuid: "employee-actual",
          projectUuid: "project-from-brand-summary",
        }),
      ],
      projectById: new Map(),
      selectedBrandProjectIds: new Set(["project-from-brand-summary"]),
      filters: { brandId: "brand-1", projectId: null },
    });

    expect(Array.from(employeeIds ?? []).sort()).toEqual(["employee-actual", "employee-planned"]);
  });

  it("matches project resources from visible planned and actual assignments", () => {
    const employeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments: [
        makeAssignment({ id: "planned-match", employeeId: "employee-planned", projectId: "project-1" }),
        makeAssignment({ id: "planned-other", employeeId: "employee-other", projectId: "project-2" }),
      ],
      visibleActualAssignments: [
        makeActualAssignment({ uuid: "actual-match", employeeUuid: "employee-actual", projectUuid: "project-1" }),
        makeActualAssignment({ uuid: "actual-other", employeeUuid: "employee-actual-other", projectUuid: "project-2" }),
      ],
      projectById: new Map(),
      selectedBrandProjectIds: new Set(),
      filters: { brandId: null, projectId: "project-1" },
    });

    expect(Array.from(employeeIds ?? []).sort()).toEqual(["employee-actual", "employee-planned"]);
  });

  it("excludes time off assignments from brand and project resource matching", () => {
    const employeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments: [
        makeAssignment({
          id: "planned-time-off",
          employeeId: "employee-planned",
          projectId: "project-1",
          isTimeOff: true,
        }),
      ],
      visibleActualAssignments: [
        makeActualAssignment({
          uuid: "actual-time-off",
          employeeUuid: "employee-actual",
          projectUuid: "project-1",
          isTimeOff: true,
        }),
      ],
      projectById: new Map([["project-1", makeProject({ id: "project-1", brandId: "brand-1" })]]),
      selectedBrandProjectIds: new Set(),
      filters: { brandId: "brand-1", projectId: "project-1" },
    });

    expect(Array.from(employeeIds ?? [])).toEqual([]);
  });

  it("intersects brand and project filters when both are selected", () => {
    const employeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments: [
        makeAssignment({ id: "brand-and-project", employeeId: "employee-match", projectId: "project-1" }),
        makeAssignment({ id: "brand-only", employeeId: "employee-brand-only", projectId: "project-2" }),
        makeAssignment({ id: "project-only", employeeId: "employee-project-only", projectId: "project-3" }),
      ],
      visibleActualAssignments: [],
      projectById: new Map([
        ["project-1", makeProject({ id: "project-1", brandId: "brand-1" })],
        ["project-2", makeProject({ id: "project-2", brandId: "brand-1" })],
        ["project-3", makeProject({ id: "project-3", brandId: "brand-2" })],
      ]),
      selectedBrandProjectIds: new Set(["project-1", "project-2"]),
      filters: { brandId: "brand-1", projectId: "project-1" },
    });

    expect(Array.from(employeeIds ?? [])).toEqual(["employee-match"]);
  });
});
