import { describe, expect, it } from "vitest";
import {
  buildPendingAssignmentPayloads,
  calculateDerivedHoursPerDay,
  formatProjectDateForDisplay,
  getAssignmentDateStrings,
  getFallbackAssignmentDateRange,
  getMissingAssignmentPlanningDateReason,
  getProjectAssignmentDateRange,
  parseManHoursInput,
} from "@/lib/setup/project-assignment-save";

describe("project setup assignment save helpers", () => {
  it("uses manager-entered total hours and derived hours per day for newly created pending assignments", () => {
    const payloads = buildPendingAssignmentPayloads({
      projectId: "project-1",
      pendingAssignments: [{ employeeId: "employee-1" }],
      manHoursByEmployee: { "employee-1": "10" },
      assignmentDates: {
        startDate: "2026-01-05",
        endDate: "2026-01-16",
      },
    });

    expect(payloads).toEqual([
      {
        employeeId: "employee-1",
        projectId: "project-1",
        taskId: null,
        startDate: "2026-01-05",
        endDate: "2026-01-16",
        hoursPerDay: "1",
        totalHours: 10,
        allocationPercentage: null,
        isTimeOff: false,
        timeOffTypeId: null,
        category: null,
        isBillable: true,
        status: "draft",
        note: "Assigned to project - set dates and hours as needed.",
        createdById: null,
      },
    ]);
  });

  it("does not produce payloads when there are no pending assignments", () => {
    const payloads = buildPendingAssignmentPayloads({
      projectId: "project-1",
      pendingAssignments: [],
      manHoursByEmployee: {},
      assignmentDates: {
        startDate: "2026-01-05",
        endDate: "2026-01-30",
      },
    });

    expect(payloads).toEqual([]);
  });

  it("rejects decimal and non-numeric man hours", () => {
    expect(parseManHoursInput("12")).toBe(12);
    expect(parseManHoursInput("0")).toBe(0);
    expect(parseManHoursInput("12.5")).toBeNull();
    expect(parseManHoursInput("abc")).toBeNull();
    expect(parseManHoursInput("")).toBeNull();
  });

  it("uses a single day divisor for pitch-style one-day assignment ranges", () => {
    expect(calculateDerivedHoursPerDay(30, {
      startDate: "2026-06-12",
      endDate: "2026-06-12",
    })).toBe("30");
  });

  it("formats selected range dates for assignment creation", () => {
    const dates = getAssignmentDateStrings({
      from: new Date(2026, 0, 5),
      to: new Date(2026, 0, 30),
    });

    expect(dates).toEqual({
      startDate: "2026-01-05",
      endDate: "2026-01-30",
    });
  });

  it("falls back to assignment min and max dates when project dates are absent", () => {
    const range = getFallbackAssignmentDateRange([
      { startDate: "2026-03-10", endDate: "2026-03-20" },
      { startDate: "2026-02-02", endDate: "2026-04-15" },
    ]);

    expect(range).toEqual({
      from: new Date(2026, 1, 2),
      to: new Date(2026, 3, 15),
    });
  });

  it("uses campaign start and end dates for assignment planning", () => {
    const range = getProjectAssignmentDateRange({
      startDate: "2026-05-04",
      endDate: "2026-05-29",
      submitDate: null,
    });

    expect(range).toEqual({
      from: new Date(2026, 4, 4),
      to: new Date(2026, 4, 29),
    });
  });

  it("uses pitch submit date as a single-day assignment planning fallback", () => {
    const range = getProjectAssignmentDateRange({
      startDate: null,
      endDate: null,
      submitDate: "2026-06-12",
    });

    expect(range).toEqual({
      from: new Date(2026, 5, 12),
      to: new Date(2026, 5, 12),
    });
  });

  it("requires campaign start and end dates for assignment planning", () => {
    expect(getMissingAssignmentPlanningDateReason("campaign", undefined)).toBe("campaign_date_range");
    expect(getMissingAssignmentPlanningDateReason("campaign", {
      from: new Date(2026, 0, 1),
    })).toBe("campaign_date_range");
    expect(getMissingAssignmentPlanningDateReason("campaign", {
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31),
    })).toBeNull();
  });

  it("requires pitch submit date as a one-day assignment planning date", () => {
    expect(getMissingAssignmentPlanningDateReason("pitch", undefined)).toBe("pitch_submit_date");
    expect(getMissingAssignmentPlanningDateReason("pitch", {
      from: new Date(2026, 5, 12),
      to: new Date(2026, 5, 12),
    })).toBeNull();
  });

  describe("formatProjectDateForDisplay", () => {
    it("formats plain date strings for display", () => {
      expect(formatProjectDateForDisplay("2022-01-11")).toBe("Jan 11, 2022");
    });

    it("formats MySQL datetime strings for display", () => {
      expect(formatProjectDateForDisplay("2022-01-11 00:00:00")).toBe("Jan 11, 2022");
    });

    it("formats ISO datetime strings for display", () => {
      expect(formatProjectDateForDisplay("2022-01-11T00:00:00.000000Z")).toBe("Jan 11, 2022");
    });

    it("returns an empty string for missing dates", () => {
      expect(formatProjectDateForDisplay(null)).toBe("");
      expect(formatProjectDateForDisplay(undefined)).toBe("");
      expect(formatProjectDateForDisplay("")).toBe("");
    });

    it("returns an empty string for invalid dates", () => {
      expect(formatProjectDateForDisplay("not-a-date")).toBe("");
    });
  });
});
