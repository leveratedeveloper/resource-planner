import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { buildTimelineV2PlanDisplaySegments } from "@/lib/timeline-v2/plan-display-segments";

const assignment = (overrides: Partial<Assignment>): Assignment => ({
  id: overrides.id ?? "assignment-1",
  employeeId: overrides.employeeId ?? "employee-1",
  projectId: overrides.projectId ?? "project-1",
  taskId: null,
  startDate: overrides.startDate ?? "2026-06-01",
  endDate: overrides.endDate ?? "2026-06-01",
  hoursPerDay: overrides.hoursPerDay ?? "8",
  totalHours: overrides.totalHours ?? null,
  allocationPercentage: null,
  isTimeOff: overrides.isTimeOff ?? false,
  isAdjustment: overrides.isAdjustment ?? false,
  timeOffTypeId: null,
  category: overrides.category ?? "Other",
  isBillable: true,
  status: overrides.status ?? "draft",
  note: overrides.note ?? null,
  createdById: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
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
    const segments = buildTimelineV2PlanDisplaySegments(dailyAssignments(1, 30));

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      employeeId: "employee-1",
      projectId: "project-1",
    });
    expect(segments[0].assignments).toHaveLength(30);
    expect(segments[0].sourceAssignment.id).toBe("plan-1");
  });

  it("merges daily records into one segment ending on June 18", () => {
    const segments = buildTimelineV2PlanDisplaySegments(dailyAssignments(1, 18));

    expect(segments).toHaveLength(1);
    expect(segments[0].startDate).toBe("2026-06-01");
    expect(segments[0].endDate).toBe("2026-06-18");
  });

  it("keeps directly adjacent ranges merged and date gaps split", () => {
    const adjacentSegments = buildTimelineV2PlanDisplaySegments([
      assignment({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", startDate: "2026-06-11", endDate: "2026-06-18" }),
    ]);
    const gappedSegments = buildTimelineV2PlanDisplaySegments([
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
    const segments = buildTimelineV2PlanDisplaySegments([
      assignment({ id: "a", projectId: "project-1", startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", projectId: "project-2", startDate: "2026-06-11", endDate: "2026-06-18" }),
    ]);

    expect(segments.map((segment) => segment.projectId)).toEqual(["project-1", "project-2"]);
  });

  it("keeps adjustment and non-adjustment assignments in separate segments", () => {
    const segments = buildTimelineV2PlanDisplaySegments([
      assignment({ id: "a", isAdjustment: false, startDate: "2026-06-01", endDate: "2026-06-10" }),
      assignment({ id: "b", isAdjustment: true, startDate: "2026-06-11", endDate: "2026-06-18" }),
    ]);

    expect(segments.map((segment) => segment.isAdjustment)).toEqual([false, true]);
  });

  it("merges workweek chunks into one visible segment when weekends are hidden", () => {
    const segments = buildTimelineV2PlanDisplaySegments({
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
    const segments = buildTimelineV2PlanDisplaySegments({
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
    const segments = buildTimelineV2PlanDisplaySegments({
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
    const segments = buildTimelineV2PlanDisplaySegments({
      assignments: [assignment({ id: "july", startDate: "2026-07-01", endDate: "2026-07-31" })],
      visibleDates: visibleWeekdays(1, 30),
    });

    expect(segments).toEqual([]);
  });
});
