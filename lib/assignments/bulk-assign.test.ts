import { describe, it, expect } from "vitest";
import { deriveProjectSpan, summarizeBulkAssign, applyHoursToAll, buildBulkAssignOperations } from "./bulk-assign";

describe("deriveProjectSpan", () => {
  it("returns start/end for a campaign that has both dates", () => {
    expect(
      deriveProjectSpan({ projectType: "campaign", startDate: "2026-04-01", endDate: "2026-08-31" }),
    ).toEqual({ startDate: "2026-04-01", endDate: "2026-08-31" });
  });

  it("returns null for a campaign missing either date", () => {
    expect(deriveProjectSpan({ projectType: "campaign", startDate: "2026-04-01", endDate: null })).toBeNull();
    expect(deriveProjectSpan({ projectType: "campaign", startDate: null, endDate: null })).toBeNull();
  });

  it("uses startDate as a single-day span for a pitch", () => {
    expect(
      deriveProjectSpan({ projectType: "pitch", startDate: "2026-05-10", endDate: null }),
    ).toEqual({ startDate: "2026-05-10", endDate: "2026-05-10" });
  });

  it("returns null for a pitch with no startDate", () => {
    expect(deriveProjectSpan({ projectType: "pitch", startDate: null, endDate: null })).toBeNull();
  });

  it("coerces verbose driver date strings to strict yyyy-MM-dd", () => {
    // ProjectOption.startDate/endDate arrive as String(Date) from the planner DB
    // driver, e.g. "Wed Jun 18 2025 00:00:00 GMT+0700 (...)". Passing these
    // straight to splitTotalAcrossMonths yields Invalid Date -> zero allocations.
    expect(
      deriveProjectSpan({
        projectType: "campaign",
        startDate: "Wed Apr 01 2026 00:00:00 GMT+0700 (Western Indonesia Time)",
        endDate: "Mon Aug 31 2026 00:00:00 GMT+0700 (Western Indonesia Time)",
      }),
    ).toEqual({ startDate: "2026-04-01", endDate: "2026-08-31" });
  });

  it("coerces 'yyyy-MM-dd HH:mm:ss' timestamps to date-only", () => {
    expect(
      deriveProjectSpan({ projectType: "campaign", startDate: "2026-04-01 00:00:00", endDate: "2026-08-31 00:00:00" }),
    ).toEqual({ startDate: "2026-04-01", endDate: "2026-08-31" });
  });
});

describe("buildBulkAssignOperations with verbose driver dates (regression)", () => {
  it("produces non-empty monthlyHours for verbose campaign dates", () => {
    const ops = buildBulkAssignOperations({
      members: [{ id: "m1" }],
      projects: [
        {
          projectKey: "campaign:1",
          projectType: "campaign",
          startDate: "Wed Apr 01 2026 00:00:00 GMT+0700 (Western Indonesia Time)",
          endDate: "Wed Jun 30 2026 00:00:00 GMT+0700 (Western Indonesia Time)",
        },
      ],
      hoursByMember: { m1: "30" },
    });
    expect(ops).toHaveLength(1);
    // Before the fix this was {} (Invalid Date -> no months) and hours were lost.
    expect(Object.keys(ops[0].monthlyHours)).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
    const sum = Object.values(ops[0].monthlyHours).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(30, 5);
    expect(ops[0].span).toEqual({ startDate: "2026-04-01", endDate: "2026-06-30" });
  });
});

describe("summarizeBulkAssign", () => {
  const campaign = { projectType: "campaign" as const, startDate: "2026-04-01", endDate: "2026-08-31" };
  const noDates = { projectType: "campaign" as const, startDate: null, endDate: null };

  it("multiplies member count by the number of assignable projects", () => {
    expect(summarizeBulkAssign(2, [campaign, campaign])).toEqual({
      assignableProjectCount: 2,
      skippedCount: 0,
      totalAssignments: 4,
    });
  });

  it("excludes projects with no usable dates from the count", () => {
    expect(summarizeBulkAssign(3, [campaign, noDates])).toEqual({
      assignableProjectCount: 1,
      skippedCount: 1,
      totalAssignments: 3,
    });
  });

  it("returns zero assignments when there are no members", () => {
    expect(summarizeBulkAssign(0, [campaign])).toEqual({
      assignableProjectCount: 1,
      skippedCount: 0,
      totalAssignments: 0,
    });
  });
});

describe("applyHoursToAll", () => {
  it("maps every member id to the given value", () => {
    expect(applyHoursToAll(["a", "b", "c"], "8")).toEqual({ a: "8", b: "8", c: "8" });
  });

  it("returns an empty record when there are no members", () => {
    expect(applyHoursToAll([], "8")).toEqual({});
  });
});

describe("buildBulkAssignOperations", () => {
  const projA = { id: "pA", projectKey: "keyA", projectType: "campaign" as const, startDate: "2026-04-01", endDate: "2026-06-30" };
  const projB = { id: "pB", projectKey: "keyB", projectType: "campaign" as const, startDate: "2026-07-01", endDate: "2026-07-31" };
  const noDates = { id: "pX", projectKey: "keyX", projectType: "campaign" as const, startDate: null, endDate: null };

  it("creates one operation per member per assignable project", () => {
    const ops = buildBulkAssignOperations({
      members: [{ id: "m1" }, { id: "m2" }],
      projects: [projA, projB],
      hoursByMember: { m1: "30", m2: "30" },
    });
    expect(ops).toHaveLength(4);
    expect(ops.map((o) => [o.employeeUuid, o.projectKey])).toEqual([
      ["m1", "keyA"],
      ["m1", "keyB"],
      ["m2", "keyA"],
      ["m2", "keyB"],
    ]);
  });

  it("skips projects with no usable dates", () => {
    const ops = buildBulkAssignOperations({
      members: [{ id: "m1" }],
      projects: [projA, noDates],
      hoursByMember: { m1: "30" },
    });
    expect(ops).toHaveLength(1);
    expect(ops[0].projectKey).toBe("keyA");
  });

  it("applies the member's full hours to EACH project (not divided between them)", () => {
    const ops = buildBulkAssignOperations({
      members: [{ id: "m1" }],
      projects: [projA, projB],
      hoursByMember: { m1: "30" },
    });
    const sum = (o: { monthlyHours: Record<string, number> }) =>
      Object.values(o.monthlyHours).reduce((a, b) => a + b, 0);
    expect(sum(ops[0])).toBeCloseTo(30, 5);
    expect(sum(ops[1])).toBeCloseTo(30, 5);
  });

  it("treats blank or invalid hours as zero", () => {
    const ops = buildBulkAssignOperations({
      members: [{ id: "m1" }],
      projects: [projB],
      hoursByMember: {},
    });
    expect(ops[0].monthlyHours).toEqual({ "2026-07-01": 0 });
  });

  it("stamps every operation as a draft merge", () => {
    const ops = buildBulkAssignOperations({
      members: [{ id: "m1" }],
      projects: [projA],
      hoursByMember: { m1: "12" },
    });
    expect(ops[0].status).toBe("draft");
    expect(ops[0].mode).toBe("merge");
    expect(ops[0].span).toEqual({ startDate: "2026-04-01", endDate: "2026-06-30" });
  });
});
