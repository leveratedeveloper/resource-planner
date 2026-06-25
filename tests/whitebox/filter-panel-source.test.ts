import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const panel = readFileSync("components/filters/FilterPanel.tsx", "utf8");
describe("FilterPanel — column browser", () => {
  it("lays out brands + projects paired and departments apart, with chips + apply", () => {
    expect(panel).toContain("FilterColumn");
    expect(panel).toContain("FilterChips");
    expect(panel).toContain("filter-panel-apply");
    expect(panel).toContain("filter-panel-clear");
    expect(panel).toContain("Show ");
    // brand+project share a surface; departments is a separate bordered column
    expect(panel).toContain("data-testid=\"filter-work-group\"");
    expect(panel).toContain("data-testid=\"filter-team-group\"");
  });
  it("no longer imports the retired stacked sections", () => {
    expect(panel).not.toContain("MultiSelectSearchSection");
    expect(panel).not.toContain("DepartmentChecklist");
  });
});
