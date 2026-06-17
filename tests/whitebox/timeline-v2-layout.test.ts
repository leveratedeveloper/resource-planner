import { describe, expect, it } from "vitest";
import {
  TIMELINE_DIMENSIONS,
  clampTimelineResourceColumnWidth,
  getTimelineEstimatedRowHeight,
  getTimelineRangePosition,
  getTimelineVisibleWidth,
} from "@/lib/timeline-v2/layout";

describe("timeline-v2 layout", () => {
  it("clamps the resource column width to the token bounds", () => {
    expect(clampTimelineResourceColumnWidth(100)).toBe(TIMELINE_DIMENSIONS.resourceCol.min);
    expect(clampTimelineResourceColumnWidth(1000)).toBe(TIMELINE_DIMENSIONS.resourceCol.max);
    expect(clampTimelineResourceColumnWidth(300)).toBe(300);
  });

  it("derives the visible width from the container", () => {
    expect(getTimelineVisibleWidth(1256, 256)).toBe(1000);
    expect(getTimelineVisibleWidth(50, 256)).toBe(100);
  });

  it("positions ranges as percentages of the column count", () => {
    expect(getTimelineRangePosition({ startIndex: 1, endIndex: 2, columnCount: 4 })).toEqual({
      leftPct: 25,
      widthPct: 50,
    });
    // Out-of-bounds indices clamp into the visible range.
    expect(getTimelineRangePosition({ startIndex: -3, endIndex: 99, columnCount: 4 })).toEqual({
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

  it("reserves an extra lane for the add-project row when expanded and editable", () => {
    // Editable + lanes: row + laneCount lanes + 1 add-project lane.
    expect(
      getTimelineEstimatedRowHeight({ isExpanded: true, laneCount: 3, canEditAssignments: true })
    ).toBe(TIMELINE_DIMENSIONS.row + 4 * TIMELINE_DIMENSIONS.lane);
    // Editable + zero lanes: row + the single add-project lane.
    expect(
      getTimelineEstimatedRowHeight({ isExpanded: true, laneCount: 0, canEditAssignments: true })
    ).toBe(TIMELINE_DIMENSIONS.row + TIMELINE_DIMENSIONS.lane);
    // Collapsed ignores canEditAssignments.
    expect(
      getTimelineEstimatedRowHeight({ isExpanded: false, laneCount: 5, canEditAssignments: true })
    ).toBe(TIMELINE_DIMENSIONS.row);
  });
});
