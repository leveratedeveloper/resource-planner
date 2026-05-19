import { describe, expect, it } from "vitest";
import {
  getAnalysisDateRangeKeys,
  isAnalysisResultFresh,
} from "@/hooks/useCapacityAnalysis";

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

  it("marks analysis results stale when their fingerprint no longer matches the latest input", () => {
    expect(
      isAnalysisResultFresh({
        resultFingerprint: "current-input",
        inputFingerprint: "current-input",
      })
    ).toBe(true);

    expect(
      isAnalysisResultFresh({
        resultFingerprint: "old-input",
        inputFingerprint: "current-input",
      })
    ).toBe(false);

    expect(
      isAnalysisResultFresh({
        resultFingerprint: null,
        inputFingerprint: "current-input",
      })
    ).toBe(false);
  });
});
