import { describe, expect, it } from "vitest";
import {
  calculateAssignedHoursForRange,
  canShowDashboardComparisonDelta,
  canShowComparisonDelta,
  getForecastDateRange,
  getPreviousPeriodRange,
  getPreviousForecastRange,
  getComparisonDelta,
  getComparisonMetricProvenance,
  getDirectionalTone,
  getUtilizationTone,
} from "@/lib/dashboard/comparison";
import { filterEmployeesActiveDuringRange } from "@/lib/dashboard/dashboard-scope";

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

    it("formats hour increases and decreases", () => {
      expect(getComparisonDelta({ current: 20, previous: 12, unit: "hours" })).toMatchObject({
        label: "8 more hours than previous",
        rawDelta: 8,
      });
      expect(getComparisonDelta({ current: 4, previous: 12, unit: "hours" })).toMatchObject({
        label: "8 fewer hours than previous",
        rawDelta: -8,
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

  describe("assignment-derived comparison metrics", () => {
    it("clamps assigned hours to the selected range", () => {
      expect(
        calculateAssignedHoursForRange(
          [
            {
              id: "assignment-1",
              startDate: "2026-05-01",
              endDate: "2026-05-10",
              hoursPerDay: "6",
              isTimeOff: false,
            },
          ],
          {
            startDate: "2026-05-05",
            endDate: "2026-05-07",
          }
        )
      ).toBe(18);
    });

    it("excludes time-off assignments from assigned workload hours", () => {
      expect(
        calculateAssignedHoursForRange(
          [
            {
              id: "assignment-1",
              startDate: "2026-05-05",
              endDate: "2026-05-05",
              hoursPerDay: "8",
              isTimeOff: false,
            },
            {
              id: "time-off-1",
              startDate: "2026-05-05",
              endDate: "2026-05-05",
              hoursPerDay: "8",
              isTimeOff: true,
            },
          ],
          {
            startDate: "2026-05-05",
            endDate: "2026-05-05",
          }
        )
      ).toBe(8);
    });

    it("keeps workload comparison exact while suppressing capacity deltas in the loop-breaker scenario", () => {
      const employees = [
        { id: "emp-1", weeklyCapacity: 40 },
        { id: "emp-2", weeklyCapacity: 24 },
        { id: "emp-3", weeklyCapacity: 40 },
        { id: "emp-4", weeklyCapacity: 40 },
        { id: "emp-5", weeklyCapacity: 40, workStartDate: "2026-05-15" },
      ];
      const changedCapacityEmployees = employees.map((employee) =>
        employee.id === "emp-2" ? { ...employee, weeklyCapacity: 40 } : employee
      );
      const assignments = [
        {
          id: "assignment-1",
          employeeId: "emp-2",
          startDate: "2026-05-05",
          endDate: "2026-05-06",
          hoursPerDay: "5",
          isTimeOff: false,
        },
      ];
      const range = {
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      };
      const roster = filterEmployeesActiveDuringRange(changedCapacityEmployees, range);

      expect(changedCapacityEmployees[1].weeklyCapacity).not.toBe(employees[1].weeklyCapacity);
      expect(roster.map((employee) => employee.id)).toEqual(["emp-1", "emp-2", "emp-3", "emp-4"]);
      expect(calculateAssignedHoursForRange(assignments, range)).toBe(10);
      expect(canShowComparisonDelta("assigned-hours")).toBe(true);
      expect(canShowComparisonDelta("average-utilization")).toBe(false);
    });
  });

  describe("comparison metric provenance", () => {
    it("shows deltas only for assignment-derived metrics", () => {
      expect(getComparisonMetricProvenance("assigned-hours")).toBe("assignment-derived");
      expect(canShowComparisonDelta("assigned-hours")).toBe(true);

      expect(getComparisonMetricProvenance("average-utilization")).toBe("capacity-derived");
      expect(canShowComparisonDelta("average-utilization")).toBe(false);
    });

    it("suppresses the loop-breaker capacity-derived deltas", () => {
      const capacityDerivedMetrics = [
        "optimal-rate",
        "average-utilization",
        "high-risk-weeks",
        "attention-count",
        "overallocated-count",
        "underutilized-count",
        "optimal-count",
        "conflict-count",
      ] as const;

      expect(canShowComparisonDelta("assigned-hours")).toBe(true);
      expect(capacityDerivedMetrics.every((metric) => !canShowComparisonDelta(metric))).toBe(true);
    });

    it("hides assignment-derived deltas when scoped by current department membership", () => {
      expect(
        canShowDashboardComparisonDelta("assigned-hours", {
          selectedDepartmentId: null,
        })
      ).toBe(true);

      expect(
        canShowDashboardComparisonDelta("assigned-hours", {
          selectedDepartmentId: "dept-design",
        })
      ).toBe(false);
    });
  });
});
