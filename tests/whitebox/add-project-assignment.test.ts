import { describe, expect, it } from "vitest";
import {
  buildNewProjectAssignment,
  countAssignmentWorkingDays,
  getDefaultAssignmentRange,
  toDateInputValue,
} from "@/lib/timeline-v2/add-project-assignment";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

const projectWithDates: Pick<ProjectOption, "id" | "startDate" | "endDate"> = {
  id: "proj-1",
  startDate: "2026-04-01",
  endDate: "2026-08-31",
};

describe("getDefaultAssignmentRange", () => {
  it("uses the project's own start/end when both are present (multi-month)", () => {
    const range = getDefaultAssignmentRange(projectWithDates);
    expect(range).toEqual({ startDate: "2026-04-01", endDate: "2026-08-31" });
  });

  it("falls back to today through one month out when project dates are missing", () => {
    const today = new Date(2026, 5, 17); // Wed Jun 17 2026
    const range = getDefaultAssignmentRange({ startDate: null, endDate: null }, today);
    expect(range.startDate).toBe("2026-06-17");
    expect(range.endDate).toBe("2026-07-17");
  });

  it("falls back when only one of the project dates is present", () => {
    const today = new Date(2026, 5, 17); // Wed Jun 17 2026
    const range = getDefaultAssignmentRange({ startDate: "2026-04-01", endDate: null }, today);
    expect(range.startDate).toBe("2026-06-17");
    expect(range.endDate).toBe("2026-07-17");
  });

  it("normalizes ISO-datetime project dates to yyyy-MM-dd (campaign fix)", () => {
    const range = getDefaultAssignmentRange({
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-08-31T00:00:00.000Z",
    } as Pick<ProjectOption, "startDate" | "endDate">);
    expect(range).toEqual({ startDate: "2026-04-01", endDate: "2026-08-31" });
  });
});

describe("toDateInputValue", () => {
  it("passes through a plain yyyy-MM-dd date", () => {
    expect(toDateInputValue("2026-04-01")).toBe("2026-04-01");
  });
  it("slices the date out of an ISO datetime", () => {
    expect(toDateInputValue("2026-04-01T00:00:00.000Z")).toBe("2026-04-01");
  });
  it("slices the date out of a space-separated datetime", () => {
    expect(toDateInputValue("2026-08-31 00:00:00")).toBe("2026-08-31");
  });
  it("returns empty string for null/empty", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("")).toBe("");
  });
});

describe("countAssignmentWorkingDays", () => {
  it("counts weekdays inclusive of both endpoints", () => {
    expect(countAssignmentWorkingDays({ startDate: "2026-04-01", endDate: "2026-04-30" })).toBe(22); // Apr 2026
  });
});

describe("buildNewProjectAssignment", () => {
  it("builds a single NewAssignment spanning the range with derived hours/day", () => {
    const assignment = buildNewProjectAssignment({
      resourceId: "emp-1",
      project: { id: "proj-1" },
      range: { startDate: "2026-04-01", endDate: "2026-04-30" }, // Apr 2026 has 22 weekdays
      totalHours: 44,
      createdByUuid: "user-9",
    });
    expect(assignment.employeeId).toBe("emp-1");
    expect(assignment.projectId).toBe("proj-1");
    expect(assignment.startDate).toBe("2026-04-01");
    expect(assignment.endDate).toBe("2026-04-30");
    expect(assignment.hoursPerDay).toBe("2"); // 44 / 22 weekdays
    expect(assignment.isTimeOff).toBe(false);
    expect(assignment.isBillable).toBe(true);
    expect(assignment.category).toBeNull();
    expect(assignment.status).toBe("draft");
    expect(assignment.createdById).toBe("user-9");
  });

  it("formats fractional hours/day to two decimals", () => {
    const assignment = buildNewProjectAssignment({
      resourceId: "emp-1",
      project: { id: "proj-1" },
      range: { startDate: "2026-04-01", endDate: "2026-04-30" }, // 22 weekdays
      totalHours: 100,
      createdByUuid: null,
    });
    expect(assignment.hoursPerDay).toBe("4.55"); // 100 / 22 = 4.5454..
    expect(assignment.createdById).toBeNull();
  });
});
