import { describe, expect, it } from "vitest";
import { getForecastDateRange } from "@/lib/dashboard/forecast-range";

describe("dashboard forecast range helpers", () => {
  it("aligns the current forecast fetch range to four full calendar weeks", () => {
    expect(getForecastDateRange(new Date(2026, 4, 13))).toEqual({
      startDate: "2026-05-11",
      endDate: "2026-06-07",
    });
  });

  it("keeps the forecast range aligned when the supplied start is already a Monday", () => {
    expect(getForecastDateRange(new Date(2026, 4, 11))).toEqual({
      startDate: "2026-05-11",
      endDate: "2026-06-07",
    });
  });
});
