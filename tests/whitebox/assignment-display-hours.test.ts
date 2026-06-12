import { describe, expect, it } from "vitest";
import {
  calculateAssignmentDisplayTotalHours,
  formatAssignmentDisplayHours,
} from "@/lib/timeline-v2/assignment-display-hours";

describe("assignment display hours", () => {
  it("calculates full assignment totals from hoursPerDay and weekdays", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        startDate: "2026-06-01",
        endDate: "2026-06-07",
        hoursPerDay: "8",
      })
    ).toBe(40);
  });

  it("ignores totalHours even when totalHours disagrees with hoursPerDay", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        hoursPerDay: "4",
        totalHours: 200,
      })
    ).toBe(20);
  });

  it("calculates visible overlap totals for a specific timeline range", () => {
    expect(
      calculateAssignmentDisplayTotalHours(
        {
          startDate: "2026-05-28",
          endDate: "2026-06-03",
          hoursPerDay: "4",
        },
        {
          startDate: new Date("2026-06-01T00:00:00"),
          endDate: new Date("2026-06-30T00:00:00"),
        }
      )
    ).toBe(12);
  });

  it("returns zero when the assignment does not overlap the visible range", () => {
    expect(
      calculateAssignmentDisplayTotalHours(
        {
          startDate: "2026-05-01",
          endDate: "2026-05-08",
          hoursPerDay: "8",
        },
        {
          startDate: new Date("2026-06-01T00:00:00"),
          endDate: new Date("2026-06-30T00:00:00"),
        }
      )
    ).toBe(0);
  });

  it("returns zero for invalid or missing hoursPerDay", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        hoursPerDay: "",
      })
    ).toBe(0);
  });

  it("accepts numeric actual-assignment hoursPerDay values", () => {
    expect(
      calculateAssignmentDisplayTotalHours({
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        hoursPerDay: 2.5,
      })
    ).toBe(7.5);
  });

  it("formats whole and decimal hours compactly", () => {
    expect(formatAssignmentDisplayHours(40)).toBe("40h");
    expect(formatAssignmentDisplayHours(12.25)).toBe("12.3h");
    expect(formatAssignmentDisplayHours(Number.NaN)).toBe("0h");
  });
});
