import { describe, expect, it } from "vitest";
import { getCriticalMonthlyAllocations } from "@/lib/utils/critical-allocation";

describe("getCriticalMonthlyAllocations", () => {
  it("hides months at exactly 90% allocation", () => {
    const warnings = getCriticalMonthlyAllocations(
      [
        {
          startDate: "2026-01-01",
          endDate: "2026-01-30",
          hoursPerDay: "7.2",
          isTimeOff: false,
        },
      ],
      {
        from: new Date(2026, 0, 1),
        to: new Date(2026, 0, 31),
      }
    );

    expect(warnings).toEqual([]);
  });

  it("returns months above 90% allocation", () => {
    const warnings = getCriticalMonthlyAllocations(
      [
        {
          startDate: "2026-01-01",
          endDate: "2026-01-30",
          hoursPerDay: "7.3",
          isTimeOff: false,
        },
      ],
      {
        from: new Date(2026, 0, 1),
        to: new Date(2026, 0, 31),
      }
    );

    expect(warnings).toEqual([{ monthKey: "2026-01", monthLabel: "Jan 2026", percentage: 91 }]);
  });

  it("excludes months outside the project period", () => {
    const warnings = getCriticalMonthlyAllocations(
      [
        {
          startDate: "2026-01-01",
          endDate: "2026-01-30",
          hoursPerDay: "8",
          isTimeOff: false,
        },
        {
          startDate: "2026-02-02",
          endDate: "2026-02-27",
          hoursPerDay: "8",
          isTimeOff: false,
        },
      ],
      {
        from: new Date(2026, 1, 1),
        to: new Date(2026, 1, 28),
      }
    );

    expect(warnings).toEqual([{ monthKey: "2026-02", monthLabel: "Feb 2026", percentage: 100 }]);
  });

  it("ignores weekend days when calculating allocation and capacity", () => {
    const warnings = getCriticalMonthlyAllocations(
      [
        {
          startDate: "2026-03-07",
          endDate: "2026-03-08",
          hoursPerDay: "24",
          isTimeOff: false,
        },
        {
          startDate: "2026-03-02",
          endDate: "2026-03-31",
          hoursPerDay: "8",
          isTimeOff: false,
        },
      ],
      {
        from: new Date(2026, 2, 1),
        to: new Date(2026, 2, 31),
      }
    );

    expect(warnings).toEqual([{ monthKey: "2026-03", monthLabel: "Mar 2026", percentage: 100 }]);
  });

  it("ignores time off when calculating critical allocation", () => {
    const warnings = getCriticalMonthlyAllocations(
      [
        {
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          hoursPerDay: "8",
          isTimeOff: true,
        },
      ],
      {
        from: new Date(2026, 3, 1),
        to: new Date(2026, 3, 30),
      }
    );

    expect(warnings).toEqual([]);
  });

  it("returns no warnings for empty assignments", () => {
    expect(getCriticalMonthlyAllocations([], undefined)).toEqual([]);
  });
});
