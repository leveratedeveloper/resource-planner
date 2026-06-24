import { describe, it, expect } from "vitest";
import { deriveProjectSpan, summarizeBulkAssign } from "./bulk-assign";

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
