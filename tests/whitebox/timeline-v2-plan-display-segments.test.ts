import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { buildSegmentDisplayAssignment, buildTimelinePlanDisplaySegments } from "@/lib/timeline-v2/plan-display-segments";

const assignment = (overrides: Partial<Assignment>): Assignment => ({
  id: overrides.id ?? "assignment-1",
  employeeId: overrides.employeeId ?? "employee-1",
  projectKey: overrides.projectKey ?? "campaign:project-1",
  startDate: overrides.startDate ?? "2026-06-01",
  endDate: overrides.endDate ?? "2026-06-01",
  status: overrides.status ?? "draft",
  note: overrides.note ?? null,
  // Default to a non-zero allocation so hasHours() returns true
  allocations: overrides.allocations ?? [{ month: "2026-06-01", plannedHours: 160, kind: "plan" }],
  createdBy: null,
  updatedBy: null,
});

function dailyAssignments(startDay: number, endDay: number, overrides: Partial<Assignment> = {}) {
  const assignments: Assignment[] = [];

  for (let day = startDay; day <= endDay; day += 1) {
    const date = `2026-06-${String(day).padStart(2, "0")}`;
    assignments.push(
      assignment({
        id: `${overrides.id ?? "plan"}-${day}`,
        startDate: date,
        endDate: date,
        ...overrides,
      })
    );
  }

  return assignments;
}

function visibleWeekdays(startDay: number, endDay: number) {
  const dates: Date[] = [];

  for (let day = startDay; day <= endDay; day += 1) {
    const date = new Date(`2026-06-${String(day).padStart(2, "0")}T00:00:00`);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) dates.push(date);
  }

  return dates;
}

describe("timeline-v2 plan display segments", () => {
  it("merges full-month daily planned records into one segment", () => {
    const segments = buildTimelinePlanDisplaySegments(dailyAssignments(1, 30));

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      employeeId: "employee-1",
      projectKey: "campaign:project-1",
    });
    expect(segments[0].assignments).toHaveLength(30);
    expect(segments[0].sourceAssignment.id).toBe("plan-1");
  });

  it("merges daily records into one segment ending on June 18", () => {
    const segments = buildTimelinePlanDisplaySegments(dailyAssignments(1, 18));

    expect(segments).toHaveLength(1);
    expect(segments[0].startDate).toBe("2026-06-01");
    expect(segments[0].endDate).toBe("2026-06-18");
  });

  it("keeps directly adjacent ranges merged and date gaps split", () => {
    const adjacentSegments = buildTimelinePlanDisplaySegments([
      assignment({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", startDate: "2026-06-11", endDate: "2026-06-18" }),
    ]);
    const gappedSegments = buildTimelinePlanDisplaySegments([
      assignment({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", startDate: "2026-06-12", endDate: "2026-06-18" }),
    ]);

    expect(adjacentSegments.map((segment) => [segment.startDate, segment.endDate])).toEqual([
      ["2026-06-01", "2026-06-18"],
    ]);
    expect(gappedSegments.map((segment) => [segment.startDate, segment.endDate])).toEqual([
      ["2026-06-01", "2026-06-10"],
      ["2026-06-12", "2026-06-18"],
    ]);
  });

  it("keeps different projects in separate segments", () => {
    const segments = buildTimelinePlanDisplaySegments([
      assignment({ id: "a", projectKey: "campaign:project-1", startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", projectKey: "campaign:project-2", startDate: "2026-06-11", endDate: "2026-06-18" }),
    ]);

    expect(segments.map((segment) => segment.projectKey)).toEqual([
      "campaign:project-1",
      "campaign:project-2",
    ]);
  });

  it("keeps different statuses in separate segments (replaces isAdjustment split)", () => {
    const segments = buildTimelinePlanDisplaySegments([
      assignment({ id: "a", status: "draft", startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", status: "confirmed", startDate: "2026-06-11", endDate: "2026-06-18" }),
    ]);

    expect(segments.map((segment) => segment.status)).toEqual(["draft", "confirmed"]);
  });

  it("merges workweek chunks into one visible segment when weekends are hidden", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({ id: "week-1", startDate: "2026-06-01", endDate: "2026-06-05" }),
        assignment({ id: "week-2", startDate: "2026-06-08", endDate: "2026-06-12" }),
        assignment({ id: "week-3", startDate: "2026-06-15", endDate: "2026-06-19" }),
        assignment({ id: "week-4", startDate: "2026-06-22", endDate: "2026-06-26" }),
        assignment({ id: "week-5", startDate: "2026-06-29", endDate: "2026-06-30" }),
      ],
      visibleDates: visibleWeekdays(1, 30),
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(segments[0].assignments.map((item) => item.id)).toEqual([
      "week-1",
      "week-2",
      "week-3",
      "week-4",
      "week-5",
    ]);
  });

  it("splits segments when a visible weekday is missing", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({ id: "before-gap", startDate: "2026-06-01", endDate: "2026-06-10" }),
        assignment({ id: "after-gap", startDate: "2026-06-12", endDate: "2026-06-18" }),
      ],
      visibleDates: visibleWeekdays(1, 30),
    });

    expect(segments.map((segment) => [segment.startDate, segment.endDate])).toEqual([
      ["2026-06-01", "2026-06-10"],
      ["2026-06-12", "2026-06-18"],
    ]);
  });

  it("clips visible display coverage to campaign dates", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({ id: "june", startDate: "2026-06-01", endDate: "2026-06-30" }),
      ],
      visibleDates: visibleWeekdays(1, 30),
      projectStartDate: "2026-06-01",
      projectEndDate: "2026-06-18",
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-18",
    });
  });

  it("does not build a display segment outside the visible range", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [assignment({ id: "july", startDate: "2026-07-01", endDate: "2026-07-31" })],
      visibleDates: visibleWeekdays(1, 30),
    });

    expect(segments).toEqual([]);
  });

  it("skips assignments with no planned hours (zero-allocation)", () => {
    const segments = buildTimelinePlanDisplaySegments([
      assignment({
        id: "empty",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        allocations: [{ month: "2026-06-01", plannedHours: 0, kind: "plan" }],
      }),
      assignment({
        id: "has-hours",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        allocations: [{ month: "2026-06-01", plannedHours: 80, kind: "plan" }],
      }),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].sourceAssignment.id).toBe("has-hours");
  });
});

describe("timeline-v2 plan display segments — month resolution (per-month split)", () => {
  const monthCols = (yyyymm: string[]) =>
    yyyymm.map((m) => new Date(`${m}-01T00:00:00`));

  it("emits one segment per plan allocation-month with hours", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({
          id: "eng-1",
          startDate: "2026-04-01",
          endDate: "2026-06-30",
          allocations: [
            { month: "2026-04-01", plannedHours: 50, kind: "plan" },
            { month: "2026-05-01", plannedHours: 30, kind: "plan" },
            { month: "2026-06-01", plannedHours: 40, kind: "plan" },
          ],
        }),
      ],
      visibleDates: monthCols(["2026-04", "2026-05", "2026-06"]),
      resolution: "month",
    });

    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.month)).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
    expect(segments.map((s) => [s.startDate, s.endDate])).toEqual([
      ["2026-04-01", "2026-04-30"],
      ["2026-05-01", "2026-05-31"],
      ["2026-06-01", "2026-06-30"],
    ]);
    expect(segments.every((s) => s.id.startsWith("eng-1:"))).toBe(true);
  });

  it("skips months with zero / no plan hours (renders a gap)", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({
          id: "eng-1",
          startDate: "2026-04-01",
          endDate: "2026-06-30",
          allocations: [
            { month: "2026-04-01", plannedHours: 50, kind: "plan" },
            { month: "2026-05-01", plannedHours: 0, kind: "plan" },
            { month: "2026-06-01", plannedHours: 40, kind: "plan" },
          ],
        }),
      ],
      visibleDates: monthCols(["2026-04", "2026-05", "2026-06"]),
      resolution: "month",
    });

    expect(segments.map((s) => s.month)).toEqual(["2026-04-01", "2026-06-01"]);
  });

  it("ignores adjustment-kind allocations (plan only)", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({
          id: "eng-1",
          startDate: "2026-04-01",
          endDate: "2026-05-31",
          allocations: [
            { month: "2026-04-01", plannedHours: 50, kind: "plan" },
            { month: "2026-05-01", plannedHours: 20, kind: "adjustment" },
          ],
        }),
      ],
      visibleDates: monthCols(["2026-04", "2026-05"]),
      resolution: "month",
    });

    expect(segments.map((s) => s.month)).toEqual(["2026-04-01"]);
  });

  it("skips months outside the visible columns", () => {
    const segments = buildTimelinePlanDisplaySegments({
      assignments: [
        assignment({
          id: "eng-1",
          startDate: "2026-04-01",
          endDate: "2026-06-30",
          allocations: [
            { month: "2026-04-01", plannedHours: 10, kind: "plan" },
            { month: "2026-06-01", plannedHours: 10, kind: "plan" },
          ],
        }),
      ],
      visibleDates: monthCols(["2026-04", "2026-05"]),
      resolution: "month",
    });

    expect(segments.map((s) => s.month)).toEqual(["2026-04-01"]);
  });
});

describe("buildSegmentDisplayAssignment", () => {
  const base = assignment({
    id: "eng-1",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    allocations: [
      { month: "2026-04-01", plannedHours: 50, kind: "plan" },
      { month: "2026-05-01", plannedHours: 30, kind: "plan" },
    ],
  });

  it("narrows a month segment's allocations to its own month", () => {
    const display = buildSegmentDisplayAssignment({
      id: "eng-1:2026-04-01",
      sourceAssignment: base,
      assignments: [base],
      employeeId: base.employeeId,
      projectKey: base.projectKey,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      status: base.status,
      month: "2026-04-01",
    });
    expect(display.allocations).toEqual([{ month: "2026-04-01", plannedHours: 50, kind: "plan" }]);
    expect([display.startDate, display.endDate]).toEqual(["2026-04-01", "2026-04-30"]);
  });

  it("keeps full allocations for a non-month (day-resolution) segment", () => {
    const display = buildSegmentDisplayAssignment({
      id: "eng-1",
      sourceAssignment: base,
      assignments: [base],
      employeeId: base.employeeId,
      projectKey: base.projectKey,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      status: base.status,
    });
    expect(display.allocations).toHaveLength(2);
  });
});
