import { describe, expect, it } from "vitest";
import {
  calculateAssignmentDisplayTotalHours,
  formatAssignmentDisplayHours,
} from "@/lib/timeline-v2/assignment-display-hours";

describe("assignment display hours", () => {
  it("sums all allocation months when no range is given", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        allocations: [
          { month: "2026-06-01", plannedHours: 80 },
          { month: "2026-07-01", plannedHours: 40 },
        ],
      })
    ).toBe(120);
  });

  it("returns zero when allocations are empty", () => {
    expect(calculateAssignmentDisplayTotalHours({ allocations: [] })).toBe(0);
  });

  it("returns zero when allocations are missing", () => {
    expect(calculateAssignmentDisplayTotalHours({})).toBe(0);
  });

  it("sums only months whose calendar span overlaps the visible range", () => {
    // Jun overlaps Jun 1-30 range; May does not.
    expect(
      calculateAssignmentDisplayTotalHours(
        {
          allocations: [
            { month: "2026-05-01", plannedHours: 160 },
            { month: "2026-06-01", plannedHours: 80 },
          ],
        },
        {
          startDate: new Date("2026-06-01T00:00:00"),
          endDate: new Date("2026-06-30T00:00:00"),
        }
      )
    ).toBe(80);
  });

  it("returns zero when no allocation month overlaps the visible range", () => {
    expect(
      calculateAssignmentDisplayTotalHours(
        {
          allocations: [{ month: "2026-05-01", plannedHours: 160 }],
        },
        {
          startDate: new Date("2026-06-01T00:00:00"),
          endDate: new Date("2026-06-30T00:00:00"),
        }
      )
    ).toBe(0);
  });

  it("includes partial-overlap months at full value (monthly grain, no proration)", () => {
    // The range starts mid-June; June month still fully counts.
    expect(
      calculateAssignmentDisplayTotalHours(
        {
          allocations: [{ month: "2026-06-01", plannedHours: 120 }],
        },
        {
          startDate: new Date("2026-06-15T00:00:00"),
          endDate: new Date("2026-06-30T00:00:00"),
        }
      )
    ).toBe(120);
  });

  it("rounds to one decimal place", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        allocations: [{ month: "2026-06-01", plannedHours: 7.55 }],
      })
    ).toBe(7.6);
  });

  it("accepts numeric plannedHours (not string)", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        allocations: [{ month: "2026-06-01", plannedHours: 2.5 }],
      })
    ).toBe(2.5);
  });

  it("formats whole and decimal hours compactly", () => {
    expect(formatAssignmentDisplayHours(40)).toBe("40h");
    expect(formatAssignmentDisplayHours(12.25)).toBe("12.3h");
    expect(formatAssignmentDisplayHours(Number.NaN)).toBe("0h");
  });
});
