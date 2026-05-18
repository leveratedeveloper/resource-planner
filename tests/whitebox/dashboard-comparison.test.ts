import { describe, expect, it } from "vitest";
import { getPreviousPeriodRange } from "@/lib/dashboard/comparison";

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
});
