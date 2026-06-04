import { describe, expect, it } from "vitest";
import { getTimelineV2AssignmentPosition } from "@/lib/timeline-v2/assignment-positioning";
import type { TimelineV2Column } from "@/lib/timeline-v2/types";

function column(date: string, kind: "day" | "month" = "day"): TimelineV2Column {
  return {
    id: date,
    date: new Date(`${date}T00:00:00`),
    label: date,
    subLabel: null,
    kind,
    isWeekend: false,
    isToday: false,
    isCurrentMonth: false,
  };
}

describe("timeline-v2 assignment positioning", () => {
  it("clips daily assignments to the visible day range", () => {
    const position = getTimelineV2AssignmentPosition({
      startDate: "2026-06-02",
      endDate: "2026-06-04",
      columns: [
        column("2026-06-01"),
        column("2026-06-02"),
        column("2026-06-03"),
        column("2026-06-04"),
        column("2026-06-05"),
      ],
      resolution: "day",
    });

    expect(position).toEqual({ startIndex: 1, endIndex: 3, leftPct: 20, widthPct: 60 });
  });

  it("returns null when the assignment is outside the visible range", () => {
    expect(
      getTimelineV2AssignmentPosition({
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        columns: [column("2026-06-01"), column("2026-06-02")],
        resolution: "day",
      })
    ).toBeNull();
  });

  it("positions monthly summaries by month column", () => {
    expect(
      getTimelineV2AssignmentPosition({
        startDate: "2026-05-01",
        endDate: "2026-05-31",
        columns: [
          column("2026-04-01", "month"),
          column("2026-05-01", "month"),
          column("2026-06-01", "month"),
        ],
        resolution: "month",
      })
    ).toEqual({ startIndex: 1, endIndex: 1, leftPct: 33.333333333333336, widthPct: 33.333333333333336 });
  });
});
