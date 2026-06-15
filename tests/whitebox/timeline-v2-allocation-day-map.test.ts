import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { buildAllocationDayMaps } from "@/lib/timeline-v2/allocation-day-map";

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
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
    category: "Other",
    isBillable: true,
    status: "draft",
    note: null,
    createdById: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function actualAssignment(overrides: Partial<ActualAssignment> = {}): ActualAssignment {
  return {
    uuid: "actual-1",
    employeeUuid: "employee-1",
    projectUuid: "project-1",
    taskUuid: null,
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    hoursPerDay: 4,
    allocationPercentage: null,
    isTimeOff: false,
    timeOffTypeUuid: null,
    category: "Other",
    isBillable: true,
    status: "confirmed",
    note: null,
    createdByUuid: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const rangeStart = new Date(2026, 5, 1);
const rangeEnd = new Date(2026, 5, 30);

describe("buildAllocationDayMaps", () => {
  it("clips assignment spans at both range edges", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ id: "a-1", startDate: "2026-05-28", endDate: "2026-06-02" }),
        assignment({ id: "a-2", startDate: "2026-06-29", endDate: "2026-07-04" }),
      ],
      actualAssignments: [],
      rangeStart,
      rangeEnd,
    });

    const dayMap = maps.get("employee-1");
    expect(dayMap).toBeDefined();
    expect([...dayMap!.keys()].sort()).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-29",
      "2026-06-30",
    ]);
    expect(dayMap!.get("2026-06-01")).toEqual({ planHours: 8, actualHours: 0 });
    expect(dayMap!.get("2026-06-30")).toEqual({ planHours: 8, actualHours: 0 });
  });

  it("accumulates multiple assignments overlapping the same day", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ id: "a-1", startDate: "2026-06-08", endDate: "2026-06-12", hoursPerDay: "8" }),
        assignment({ id: "a-2", startDate: "2026-06-10", endDate: "2026-06-10", hoursPerDay: "4" }),
      ],
      actualAssignments: [],
      rangeStart,
      rangeEnd,
    });

    const dayMap = maps.get("employee-1")!;
    expect(dayMap.get("2026-06-09")).toEqual({ planHours: 8, actualHours: 0 });
    expect(dayMap.get("2026-06-10")).toEqual({ planHours: 12, actualHours: 0 });
    expect(dayMap.get("2026-06-11")).toEqual({ planHours: 8, actualHours: 0 });
  });

  it("keeps plan hours and actual hours separate", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ startDate: "2026-06-10", endDate: "2026-06-10", hoursPerDay: "8" }),
      ],
      actualAssignments: [
        actualAssignment({ startDate: "2026-06-10", endDate: "2026-06-10", hoursPerDay: 3 }),
      ],
      rangeStart,
      rangeEnd,
    });

    expect(maps.get("employee-1")!.get("2026-06-10")).toEqual({
      planHours: 8,
      actualHours: 3,
    });
  });

  it("excludes time-off assignments and actuals", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ startDate: "2026-06-10", endDate: "2026-06-10", isTimeOff: true }),
      ],
      actualAssignments: [
        actualAssignment({ startDate: "2026-06-10", endDate: "2026-06-10", isTimeOff: true }),
      ],
      rangeStart,
      rangeEnd,
    });

    expect(maps.get("employee-1")).toBeUndefined();
  });

  it("omits employees with no assignments touching the range", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ employeeId: "employee-2", startDate: "2026-07-10", endDate: "2026-07-15" }),
      ],
      actualAssignments: [],
      rangeStart,
      rangeEnd,
    });

    expect(maps.get("employee-1")).toBeUndefined();
    expect(maps.get("employee-2")).toBeUndefined();
  });

  it("skips actuals without an employeeUuid", () => {
    const maps = buildAllocationDayMaps({
      assignments: [],
      actualAssignments: [
        actualAssignment({
          employeeUuid: null as unknown as string,
          startDate: "2026-06-10",
          endDate: "2026-06-10",
        }),
      ],
      rangeStart,
      rangeEnd,
    });

    expect(maps.size).toBe(0);
  });

  it("parses comma-decimal hoursPerDay", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ startDate: "2026-06-10", endDate: "2026-06-10", hoursPerDay: "7,5" }),
      ],
      actualAssignments: [],
      rangeStart,
      rangeEnd,
    });

    expect(maps.get("employee-1")!.get("2026-06-10")).toEqual({
      planHours: 7.5,
      actualHours: 0,
    });
  });
});
