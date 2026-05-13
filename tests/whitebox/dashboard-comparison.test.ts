import { describe, expect, it } from "vitest";
import {
  getForecastDateRange,
  getPreviousPeriodRange,
  getPreviousForecastRange,
  getComparisonDelta,
  getDirectionalTone,
  getUtilizationTone,
} from "@/lib/dashboard/comparison";

describe("dashboard comparison helpers", () => {
  describe("getPreviousPeriodRange", () => {
    it("preserves the inclusive duration for weekly-style ranges", () => {
      expect(
        getPreviousPeriodRange({
          startDate: "2026-05-05",
          endDate: "2026-05-12",
        })
      ).toEqual({
        startDate: "2026-04-27",
        endDate: "2026-05-04",
      });
    });

    it("preserves the inclusive duration for monthly-style ranges", () => {
      expect(
        getPreviousPeriodRange({
          startDate: "2026-04-12",
          endDate: "2026-05-12",
        })
      ).toEqual({
        startDate: "2026-03-12",
        endDate: "2026-04-11",
      });
    });

    it("preserves the inclusive duration for custom ranges", () => {
      expect(
        getPreviousPeriodRange({
          startDate: "2026-01-10",
          endDate: "2026-02-20",
        })
      ).toEqual({
        startDate: "2025-11-29",
        endDate: "2026-01-09",
      });
    });
  });

  describe("getPreviousForecastRange", () => {
    it("aligns the current forecast fetch range to four full calendar weeks", () => {
      expect(getForecastDateRange(new Date(2026, 4, 13))).toEqual({
        startDate: "2026-05-11",
        endDate: "2026-06-07",
      });
    });

    it("aligns previous forecast ranges to full calendar weeks before the current forecast", () => {
      expect(
        getPreviousForecastRange({
          startDate: "2026-05-11",
          endDate: "2026-06-07",
        })
      ).toEqual({
        startDate: "2026-04-13",
        endDate: "2026-05-10",
      });
    });

    it("keeps previous forecast ranges to four weeks even when the supplied start is mid-week", () => {
      expect(
        getPreviousForecastRange({
          startDate: "2026-05-13",
          endDate: "2026-06-10",
        })
      ).toEqual({
        startDate: "2026-04-13",
        endDate: "2026-05-10",
      });
    });

    it("ends exactly one day before the current forecast week starts", () => {
      expect(
        getPreviousForecastRange({
          startDate: "2026-05-11",
          endDate: "2026-06-07",
        }).endDate
      ).toBe("2026-05-10");
    });
  });

  describe("getComparisonDelta", () => {
    it("formats percentage-point increases and decreases", () => {
      expect(getComparisonDelta({ current: 82, previous: 74, unit: "percentage-point" })).toMatchObject({
        label: "8 points higher than previous",
        rawDelta: 8,
      });
      expect(getComparisonDelta({ current: 70, previous: 74, unit: "percentage-point" })).toMatchObject({
        label: "4 points lower than previous",
        rawDelta: -4,
      });
    });

    it("formats count increases and decreases", () => {
      expect(getComparisonDelta({ current: 3, previous: 1, unit: "count" })).toMatchObject({
        label: "2 more than previous",
        rawDelta: 2,
      });
      expect(getComparisonDelta({ current: 1, previous: 3, unit: "count" })).toMatchObject({
        label: "2 fewer than previous",
        rawDelta: -2,
      });
    });

    it("formats unchanged values", () => {
      expect(getComparisonDelta({ current: 3, previous: 3, unit: "count" })).toMatchObject({
        label: "No change from previous",
        rawDelta: 0,
      });
    });
  });

  describe("tone helpers", () => {
    it("treats higher optimal resources as positive", () => {
      expect(getDirectionalTone(8, "higher-is-better")).toBe("positive");
      expect(getDirectionalTone(-8, "higher-is-better")).toBe("negative");
    });

    it("treats lower risk and attention counts as positive", () => {
      expect(getDirectionalTone(-1, "lower-is-better")).toBe("positive");
      expect(getDirectionalTone(1, "lower-is-better")).toBe("negative");
    });

    it("treats utilization movement toward 80 percent as positive", () => {
      expect(getUtilizationTone({ current: 78, previous: 65 })).toBe("positive");
      expect(getUtilizationTone({ current: 96, previous: 84 })).toBe("negative");
      expect(getUtilizationTone({ current: 80, previous: 80 })).toBe("neutral");
    });
  });
});
