import { describe, expect, it } from "vitest";
import {
  TIMELINE_DIMENSIONS,
  clampTimelineV2ResourceColumnWidth,
  getTimelineEstimatedRowHeight,
  getTimelineV2CellWidth,
  getTimelineV2RangePosition,
  getTimelineV2VisibleWidth,
} from "@/lib/timeline-v2/layout";

describe("timeline-v2 layout", () => {
  it("clamps the resource column width to the token bounds", () => {
    expect(clampTimelineV2ResourceColumnWidth(100)).toBe(TIMELINE_DIMENSIONS.resourceCol.min);
    expect(clampTimelineV2ResourceColumnWidth(1000)).toBe(TIMELINE_DIMENSIONS.resourceCol.max);
    expect(clampTimelineV2ResourceColumnWidth(300)).toBe(300);
  });

  it("derives the visible width and cell width from the container", () => {
    expect(getTimelineV2VisibleWidth(1256, 256)).toBe(1000);
    expect(getTimelineV2VisibleWidth(50, 256)).toBe(100);
    expect(getTimelineV2CellWidth(1000, 5)).toBe(200);
    expect(getTimelineV2CellWidth(1000, 0)).toBe(1000);
  });

  it("positions ranges as percentages of the column count", () => {
    expect(getTimelineV2RangePosition({ startIndex: 1, endIndex: 2, columnCount: 4 })).toEqual({
      leftPct: 25,
      widthPct: 50,
    });
    // Out-of-bounds indices clamp into the visible range.
    expect(getTimelineV2RangePosition({ startIndex: -3, endIndex: 99, columnCount: 4 })).toEqual({
      leftPct: 0,
      widthPct: 100,
    });
  });

  it("estimates row heights from the dimension tokens", () => {
    expect(getTimelineEstimatedRowHeight({ isExpanded: false, laneCount: 5 })).toBe(
      TIMELINE_DIMENSIONS.row
    );
    expect(getTimelineEstimatedRowHeight({ isExpanded: true, laneCount: 3 })).toBe(
      TIMELINE_DIMENSIONS.row + 3 * TIMELINE_DIMENSIONS.lane
    );
    // Expanded rows always reserve at least one lane.
    expect(getTimelineEstimatedRowHeight({ isExpanded: true, laneCount: 0 })).toBe(
      TIMELINE_DIMENSIONS.row + TIMELINE_DIMENSIONS.lane
    );
  });
});
