import { describe, it, expect } from "vitest";
import { deriveProjectSpan } from "./bulk-assign";

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
