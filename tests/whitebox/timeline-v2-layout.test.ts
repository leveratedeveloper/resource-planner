import { describe, expect, it } from "vitest";
import {
  clampTimelineV2ResourceColumnWidth,
  getTimelineV2CellWidth,
  getTimelineV2EstimatedRowHeight,
  getTimelineV2Layout,
  getTimelineV2TodayScrollLeft,
  getTimelineV2RangePosition,
  getTimelineV2VisibleWidth,
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

  it("derives a stable visible width and cell width", () => {
    expect(getTimelineV2VisibleWidth(1500, 250)).toBe(1250);
    expect(getTimelineV2VisibleWidth(200, 250)).toBe(100);
    expect(getTimelineV2CellWidth(1250, 5)).toBe(250);
    expect(getTimelineV2CellWidth(100, 0)).toBe(100);
  });

  it("converts column ranges to percentage positions", () => {
    expect(getTimelineV2RangePosition({ startIndex: 1, endIndex: 3, columnCount: 5 })).toEqual({
      leftPct: 20,
      widthPct: 60,
    });
  });

  it("calculates a centered Today scroll target and expanded row estimate", () => {
    expect(
      getTimelineV2TodayScrollLeft({
        todayIndex: 4,
        cellWidth: 250,
        viewportWidth: 900,
      })
    ).toBe(675);
    expect(
      getTimelineV2EstimatedRowHeight({
        isExpanded: false,
        campaignGroups: [],
      })
    ).toBe(48);
    expect(
      getTimelineV2EstimatedRowHeight({
        isExpanded: true,
        campaignGroups: [{}, {}, {}],
      })
    ).toBe(48 + 32 + 3 * 34);
  });
});
