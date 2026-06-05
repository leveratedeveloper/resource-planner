import { describe, expect, it } from "vitest";
import { getAssignmentBlockPosition } from "@/lib/timeline/assignment-positioning";

describe("assignment positioning", () => {
  it("keeps month-range blocks inside the matching month column", () => {
    const position = getAssignmentBlockPosition({
      startDate: new Date("2026-04-15T00:00:00"),
      endDate: new Date("2026-04-20T00:00:00"),
      days: [
        new Date("2026-04-01T00:00:00"),
        new Date("2026-05-01T00:00:00"),
        new Date("2026-06-01T00:00:00"),
      ],
      isWeekView: false,
      isMonthRangeView: true,
    });

    expect(position).toEqual({
      startVisibleIdx: 0,
      endVisibleIdx: 0,
      visibleDuration: 1,
    });
  });

  it("spans multiple month columns only when the assignment crosses months", () => {
    const position = getAssignmentBlockPosition({
      startDate: new Date("2026-04-15T00:00:00"),
      endDate: new Date("2026-05-10T00:00:00"),
      days: [
        new Date("2026-04-01T00:00:00"),
        new Date("2026-05-01T00:00:00"),
        new Date("2026-06-01T00:00:00"),
      ],
      isWeekView: false,
      isMonthRangeView: true,
    });

    expect(position).toEqual({
      startVisibleIdx: 0,
      endVisibleIdx: 1,
      visibleDuration: 2,
    });
  });
});
