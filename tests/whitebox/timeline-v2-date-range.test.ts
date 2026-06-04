import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { getTimelineV2Columns } from "@/lib/timeline-v2/date-range";

const labels = (dates: Date[]) => dates.map((date) => format(date, "yyyy-MM-dd"));

describe("timeline-v2 date range", () => {
  it("builds a Monday-start week and hides weekends by default", () => {
    const result = getTimelineV2Columns({
      anchorDate: new Date("2026-06-04T00:00:00"),
      viewMode: "week",
      showWeekends: false,
    });

    expect(labels(result.columns.map((column) => column.date))).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
    expect(result.startDate).toBe("2026-06-01");
    expect(result.endDate).toBe("2026-06-07");
    expect(result.resolution).toBe("day");
  });

  it("builds daily month columns with optional weekends", () => {
    const result = getTimelineV2Columns({
      anchorDate: new Date("2026-02-10T00:00:00"),
      viewMode: "month",
      showWeekends: true,
    });

    expect(result.columns).toHaveLength(28);
    expect(labels([result.columns[0].date, result.columns[27].date])).toEqual([
      "2026-02-01",
      "2026-02-28",
    ]);
    expect(result.resolution).toBe("day");
  });

  it("builds monthly columns for quarter, half-year, and year views", () => {
    expect(
      labels(
        getTimelineV2Columns({
          anchorDate: new Date("2026-06-04T00:00:00"),
          viewMode: "quarter",
          showWeekends: false,
        }).columns.map((column) => column.date)
      )
    ).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);

    expect(
      getTimelineV2Columns({
        anchorDate: new Date("2026-09-04T00:00:00"),
        viewMode: "halfYear",
        showWeekends: false,
      }).columns
    ).toHaveLength(6);

    expect(
      getTimelineV2Columns({
        anchorDate: new Date("2026-09-04T00:00:00"),
        viewMode: "year",
        showWeekends: false,
      }).columns
    ).toHaveLength(12);
  });
});
