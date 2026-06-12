import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMELINE_VIEW,
  getInitialTimelineAnchor,
  getInitialTimelineDateRange,
  shouldEnableTimelineAssignments,
} from "@/lib/planner/initial-load";

describe("timeline initial loading helpers", () => {
  it("defaults fresh planner loads to the current calendar quarter", () => {
    const initialAnchor = getInitialTimelineAnchor(new Date("2026-05-21T12:00:00+07:00"));

    expect(DEFAULT_TIMELINE_VIEW).toBe("quarter");
    expect(initialAnchor).toBe("2026-05-21");
    expect(getInitialTimelineDateRange(initialAnchor, DEFAULT_TIMELINE_VIEW)).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
  });

  it("keeps weekday-only ranges for week detail loads", () => {
    const initialAnchor = "2026-05-21";

    expect(getInitialTimelineDateRange(initialAnchor, "week")).toEqual({
      startDate: "2026-05-18",
      endDate: "2026-05-22",
    });
  });

  it("does not enable assignment loading without a concrete date range", () => {
    expect(shouldEnableTimelineAssignments(undefined)).toBe(false);
    expect(shouldEnableTimelineAssignments({ startDate: "2026-05-18", endDate: "2026-05-22" })).toBe(true);
  });
});
