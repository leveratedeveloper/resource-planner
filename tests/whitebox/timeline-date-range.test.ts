import { describe, expect, it } from "vitest";
import { getTimelineDateRange } from "@/components/timeline/timeline-date-range";

describe("timeline date range", () => {
  it("uses the first and last visible day for day-based timeline views", () => {
    const range = getTimelineDateRange(
      [new Date(2026, 4, 4), new Date(2026, 4, 5), new Date(2026, 4, 8)],
      "week"
    );

    expect(range).toEqual({
      startDate: "2026-05-04",
      endDate: "2026-05-08",
    });
  });

  it("extends month-range timeline views to the end of the last visible month", () => {
    const range = getTimelineDateRange(
      [new Date(2026, 0, 1), new Date(2026, 1, 1), new Date(2026, 2, 1)],
      "quarter"
    );

    expect(range).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
  });

  it("returns undefined when there are no visible timeline dates", () => {
    expect(getTimelineDateRange([], "month")).toBeUndefined();
  });
});
