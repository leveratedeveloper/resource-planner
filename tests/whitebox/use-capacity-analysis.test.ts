import { describe, expect, it } from "vitest";
import { getAnalysisDateRangeKeys } from "@/hooks/useCapacityAnalysis";

describe("useCapacityAnalysis helpers", () => {
  it("normalizes equivalent date values to stable local date keys", () => {
    const first = getAnalysisDateRangeKeys({
      start: new Date(2026, 3, 12),
      end: new Date(2026, 4, 12),
    });
    const second = getAnalysisDateRangeKeys({
      start: new Date(2026, 3, 12),
      end: new Date(2026, 4, 12),
    });

    expect(first).toEqual({
      startKey: "2026-04-12",
      endKey: "2026-05-12",
    });
    expect(second).toEqual(first);
  });
});
