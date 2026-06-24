import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { buildAllocationDayMaps } from "@/lib/timeline-v2/allocation-day-map";

// June 2026 has 22 weekdays (Mon Jun 1 … Tue Jun 30).
// 22 * 8 = 176 plannedHours → each weekday carries exactly 8h.

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    employeeId: "employee-1",
    projectKey: "campaign:project-1",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    status: "draft",
    note: null,
    allocations: overrides.allocations ?? [{ month: "2026-06-01", plannedHours: 176, kind: "plan" }],
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

const rangeStart = new Date(2026, 5, 1);  // Jun 1
const rangeEnd   = new Date(2026, 5, 30); // Jun 30

describe("buildAllocationDayMaps", () => {
  it("spreads a month allocation evenly across all its weekdays within the range", () => {
    // June 2026: 22 weekdays × 8h = 176h → 8h per weekday.
    const maps = buildAllocationDayMaps({
      assignments: [assignment()],
      rangeStart,
      rangeEnd,
    });

    const dayMap = maps.get("employee-1")!;
    expect(dayMap).toBeDefined();
    expect([...dayMap.keys()]).toHaveLength(22); // all 22 weekdays

    // First and last weekday get 8h each
    expect(dayMap.get("2026-06-01")).toEqual({ planHours: 8 }); // Mon
    expect(dayMap.get("2026-06-30")).toEqual({ planHours: 8 }); // Tue
    // Weekends are absent
    expect(dayMap.get("2026-06-07")).toBeUndefined(); // Sun
  });

  it("clips to the visible range: allocation months outside the range produce no weekday entries", () => {
    // Assignment with only a July allocation — range is June.
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          allocations: [{ month: "2026-07-01", plannedHours: 160, kind: "plan" }],
        }),
      ],
      rangeStart,
      rangeEnd,
    });

    // The employee-1 entry may exist in the map but should have no weekday keys
    const dayMap = maps.get("employee-1");
    if (dayMap) {
      expect(dayMap.size).toBe(0);
    }
  });

  it("accumulates multiple assignments overlapping the same month", () => {
    // Two assignments, both allocating June hours.
    // a-1: 176h / 22 = 8h per weekday. a-2: 88h / 22 = 4h per weekday.
    // Every June weekday accumulates 8 + 4 = 12h.
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({
          id: "a-1",
          allocations: [{ month: "2026-06-01", plannedHours: 176, kind: "plan" }],
        }),
        assignment({
          id: "a-2",
          allocations: [{ month: "2026-06-01", plannedHours: 88, kind: "plan" }],
        }),
      ],
      rangeStart,
      rangeEnd,
    });

    const dayMap = maps.get("employee-1")!;
    // Every weekday gets 12h
    expect(dayMap.get("2026-06-01")).toEqual({ planHours: 12 });
    expect(dayMap.get("2026-06-09")).toEqual({ planHours: 12 });
    expect(dayMap.get("2026-06-30")).toEqual({ planHours: 12 });
  });

  it("handles multiple employees independently", () => {
    // employee-1: 176h → 8h/day. employee-2: 88h → 4h/day.
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({ employeeId: "employee-1", allocations: [{ month: "2026-06-01", plannedHours: 176, kind: "plan" }] }),
        assignment({ id: "a-2", employeeId: "employee-2", allocations: [{ month: "2026-06-01", plannedHours: 88, kind: "plan" }] }),
      ],
      rangeStart,
      rangeEnd,
    });

    expect(maps.get("employee-1")!.get("2026-06-01")).toEqual({ planHours: 8 });
    expect(maps.get("employee-2")!.get("2026-06-01")).toEqual({ planHours: 4 });
  });

  it("skips allocations with zero plannedHours", () => {
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({
          allocations: [{ month: "2026-06-01", plannedHours: 0, kind: "plan" }],
        }),
      ],
      rangeStart,
      rangeEnd,
    });

    // Assignment skipped — dayMap is either absent or empty
    const dayMap = maps.get("employee-1");
    expect(!dayMap || dayMap.size === 0).toBe(true);
  });

  it("places plannedHours/weekdays hours per weekday (fractional values work)", () => {
    // 165h / 22 weekdays = 7.5h per weekday
    const maps = buildAllocationDayMaps({
      assignments: [
        assignment({
          allocations: [{ month: "2026-06-01", plannedHours: 165, kind: "plan" }],
        }),
      ],
      rangeStart,
      rangeEnd,
    });

    expect(maps.get("employee-1")!.get("2026-06-01")).toEqual({ planHours: 7.5 });
  });
});
