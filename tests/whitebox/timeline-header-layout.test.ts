import { describe, expect, it } from "vitest";
import { getTimelineHeaderLayout } from "@/lib/timeline/header-layout";

describe("timeline header layout", () => {
  it("keeps every quarter month visible while critical startup is still pending", () => {
    expect(
      getTimelineHeaderLayout({
        columnCount: 3,
        cellWidth: 466.67,
        criticalStartupPending: true,
      })
    ).toEqual({
      headerWidth: "100%",
      columnWidth: "33.333333333333336%",
    });
  });
});
