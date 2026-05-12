import { describe, expect, it } from "vitest";
import { getIncrementalWindow } from "@/lib/dashboard/incremental-list";

describe("getIncrementalWindow", () => {
  it("returns the first page and reports more items are available", () => {
    const result = getIncrementalWindow([1, 2, 3, 4, 5], 2, 1);

    expect(result.visibleItems).toEqual([1, 2]);
    expect(result.visibleCount).toBe(2);
    expect(result.totalCount).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it("caps visible items at the total count", () => {
    const result = getIncrementalWindow([1, 2, 3], 2, 4);

    expect(result.visibleItems).toEqual([1, 2, 3]);
    expect(result.visibleCount).toBe(3);
    expect(result.totalCount).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it("normalizes invalid page sizes and page counts", () => {
    const result = getIncrementalWindow([1, 2, 3], 0, 0);

    expect(result.visibleItems).toEqual([1]);
    expect(result.visibleCount).toBe(1);
    expect(result.totalCount).toBe(3);
    expect(result.hasMore).toBe(true);
  });
});
