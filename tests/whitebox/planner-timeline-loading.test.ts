import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import {
  getPlannerTimelineQueryKey,
  getTimelineResolution,
  shouldLoadPlannerAssignmentDetail,
  summarizeMonthlyAssignments,
} from "@/lib/timeline/planner-loading";

const makeAssignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "assignment-1",
  employeeId: "employee-1",
  projectId: "project-1",
  taskId: null,
  startDate: "2026-01-30",
  endDate: "2026-02-02",
  hoursPerDay: "8",
  totalHours: 32,
  allocationPercentage: null,
  isTimeOff: false,
  isAdjustment: false,
  timeOffTypeId: null,
  category: "Development",
  isBillable: true,
  status: "confirmed",
  note: "Homepage",
  createdById: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("planner timeline loading contract", () => {
  it("selects day detail for short views and month summaries for long views", () => {
    expect(getTimelineResolution("week")).toBe("day");
    expect(getTimelineResolution("month")).toBe("day");
    expect(getTimelineResolution("quarter")).toBe("month");
    expect(getTimelineResolution("halfYear")).toBe("month");
    expect(getTimelineResolution("year")).toBe("month");
  });

  it("scopes planner cache keys by view, range, resolution, and filters", () => {
    expect(
      getPlannerTimelineQueryKey({
        viewMode: "year",
        resolution: "month",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        filters: {
          brandId: "brand-1",
          department: "department-1",
          projectId: "project-1",
          category: "Development",
          status: "confirmed",
        },
      })
    ).toEqual([
      "planner-timeline",
      {
        viewMode: "year",
        resolution: "month",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        filters: {
          brandId: "brand-1",
          department: "department-1",
          projectId: "project-1",
          category: "Development",
          status: "confirmed",
        },
      },
    ]);
  });

  it("returns one monthly render block per month for assignments crossing a boundary", () => {
    const blocks = summarizeMonthlyAssignments([makeAssignment({})], {
      startDate: "2026-01-01",
      endDate: "2026-02-28",
    });

    expect(blocks.map((block) => ({
      month: block.startDate,
      totalHours: block.totalHours,
      detailIds: block.detailIds,
    }))).toEqual([
      {
        month: "2026-01-01",
        totalHours: 16,
        detailIds: ["assignment-1"],
      },
      {
        month: "2026-02-01",
        totalHours: 16,
        detailIds: ["assignment-1"],
      },
    ]);
  });

  it("only asks for edit detail when a monthly planner summary is opened", () => {
    const [monthlyBlock] = summarizeMonthlyAssignments([makeAssignment({})], {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(shouldLoadPlannerAssignmentDetail(monthlyBlock)).toBe(true);
    expect(shouldLoadPlannerAssignmentDetail(makeAssignment({ id: "raw-assignment" }))).toBe(false);
  });
});
