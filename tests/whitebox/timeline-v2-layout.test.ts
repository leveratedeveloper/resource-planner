import { describe, expect, it } from "vitest";
import {
  clampTimelineV2ResourceColumnWidth,
  getTimelineV2Layout,
  getTimelineV2RangePosition,
} from "@/lib/timeline-v2/layout";

describe("timeline-v2 layout", () => {
  it("clamps the resource column to the existing visual bounds", () => {
    expect(clampTimelineV2ResourceColumnWidth(100)).toBe(220);
    expect(clampTimelineV2ResourceColumnWidth(250)).toBe(250);
    expect(clampTimelineV2ResourceColumnWidth(800)).toBe(420);
  });

  it("uses exact available width for visible columns", () => {
    expect(getTimelineV2Layout({ availableWidth: 1000, columnCount: 5 })).toEqual({
      columnWidth: 200,
      timelineWidth: 1000,
    });
  });

  it("converts column ranges to percentage positions", () => {
    expect(getTimelineV2RangePosition({ startIndex: 1, endIndex: 3, columnCount: 5 })).toEqual({
      leftPct: 20,
      widthPct: 60,
    });
  });
});
