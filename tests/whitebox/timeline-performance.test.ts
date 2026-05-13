import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import {
  TIMELINE_ROW_BATCH_SIZE,
  getEffectiveRenderedEmployeeCount,
  getNextRenderedEmployeeCount,
  groupActualAssignmentsByEmployee,
} from "@/components/timeline/timeline-performance";

function actual(uuid: string, employeeUuid: string): ActualAssignment {
  return {
    uuid,
    employeeUuid,
    projectUuid: "project-1",
    taskUuid: null,
    startDate: "2026-05-01",
    endDate: "2026-05-02",
    hoursPerDay: 8,
    allocationPercentage: null,
    isTimeOff: false,
    timeOffTypeUuid: null,
    category: "Production",
    isBillable: true,
    status: "confirmed",
    note: null,
    createdByUuid: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("timeline performance helpers", () => {
  it("resets the rendered row count to the first batch when filters change", () => {
    const count = getEffectiveRenderedEmployeeCount(
      { key: "brand-a|week", count: 80 },
      "brand-b|week"
    );

    expect(count).toBe(TIMELINE_ROW_BATCH_SIZE);
  });

  it("keeps the rendered row count when the filter key is unchanged", () => {
    const count = getEffectiveRenderedEmployeeCount(
      { key: "brand-a|week", count: 60 },
      "brand-a|week"
    );

    expect(count).toBe(60);
  });

  it("loads rows in batches without exceeding the available employee count", () => {
    expect(getNextRenderedEmployeeCount(20, 95)).toBe(40);
    expect(getNextRenderedEmployeeCount(80, 95)).toBe(95);
    expect(getNextRenderedEmployeeCount(95, 95)).toBe(95);
  });

  it("groups actual assignments by employee without changing assignment objects", () => {
    const first = actual("actual-1", "employee-1");
    const second = actual("actual-2", "employee-2");
    const third = actual("actual-3", "employee-1");

    const grouped = groupActualAssignmentsByEmployee([first, second, third]);

    expect(grouped.get("employee-1")).toEqual([first, third]);
    expect(grouped.get("employee-2")).toEqual([second]);
  });
});
