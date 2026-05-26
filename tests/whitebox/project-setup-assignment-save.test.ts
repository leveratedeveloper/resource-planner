import { describe, expect, it } from "vitest";
import {
  buildPendingAssignmentPayloads,
  getAssignmentDateStrings,
  getFallbackAssignmentDateRange,
  getProjectAssignmentDateRange,
} from "@/lib/setup/project-assignment-save";

describe("project setup assignment save helpers", () => {
  it("uses the selected date range for newly created pending assignments", () => {
    const payloads = buildPendingAssignmentPayloads({
      projectId: "project-1",
      pendingAssignments: [{ employeeId: "employee-1" }],
      selectedDeliverablesByEmployee: { "employee-1": ["deliverable-1"] },
      allDeliverables: [
        {
          id: "deliverable-1",
          deliverableName: "Landing Page",
          deliverableNameNew: "Landing Page v2",
        },
      ],
      assignmentDates: {
        startDate: "2026-01-05",
        endDate: "2026-01-30",
      },
    });

    expect(payloads).toEqual([
      {
        employeeId: "employee-1",
        projectId: "project-1",
        taskId: null,
        startDate: "2026-01-05",
        endDate: "2026-01-30",
        hoursPerDay: "0",
        allocationPercentage: null,
        isTimeOff: false,
        timeOffTypeId: null,
        category: null,
        isBillable: true,
        status: "draft",
        note: "Assigned to project - Deliverables: Landing Page v2. Set dates and hours as needed.",
        createdById: null,
      },
    ]);
  });

  it("does not produce update payloads for existing assignment dates", () => {
    const payloads = buildPendingAssignmentPayloads({
      projectId: "project-1",
      pendingAssignments: [],
      selectedDeliverablesByEmployee: {},
      allDeliverables: [],
      assignmentDates: {
        startDate: "2026-01-05",
        endDate: "2026-01-30",
      },
    });

    expect(payloads).toEqual([]);
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
});
