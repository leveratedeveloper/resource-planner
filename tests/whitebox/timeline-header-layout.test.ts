import { describe, expect, it } from "vitest";
import { getTimelineHeaderLayout } from "@/lib/timeline/header-layout";

describe("timeline header layout", () => {
  it("uses pixel widths for loaded timeline columns", () => {
    expect(
      getTimelineHeaderLayout({
        columnCount: 3,
        cellWidth: 466.67,
      })
    ).toEqual({
      headerWidth: "1400.01px",
      columnWidth: "466.67px",
    });
  });
});
