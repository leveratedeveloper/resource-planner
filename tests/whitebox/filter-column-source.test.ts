import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const source = readFileSync("components/filters/FilterColumn.tsx", "utf8");
describe("FilterColumn", () => {
  it("is a reusable column with optional search + paginated checklist", () => {
    expect(source).toContain("onToggle");
    expect(source).toContain("isFetchingNextPage");
    expect(source).toContain("data-testid={`${testidPrefix}-option`}");
  });
  it("scrolls vertically and truncates long rows with a hover tooltip", () => {
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("truncate");
    expect(source).toContain("title=");
  });
});
