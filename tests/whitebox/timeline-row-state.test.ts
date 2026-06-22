import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getTimelineRowStateResetKey,
  hasEmployeeFlag,
  setEmployeeFlag,
} from "@/lib/timeline-v2/row-state";

describe("timeline row state helpers", () => {
  it("persists expanded flags by employee id", () => {
    const expanded = setEmployeeFlag(new Set<string>(), "employee-1", true);
    const next = setEmployeeFlag(expanded, "employee-2", true);
    const collapsed = setEmployeeFlag(next, "employee-1", false);

    expect(hasEmployeeFlag(expanded, "employee-1")).toBe(true);
    expect(hasEmployeeFlag(next, "employee-2")).toBe(true);
    expect(hasEmployeeFlag(collapsed, "employee-1")).toBe(false);
    expect(hasEmployeeFlag(collapsed, "employee-2")).toBe(true);
  });

  it("creates a stable row state reset key from global timeline filters", () => {
    const key = getTimelineRowStateResetKey({
      brandId: "brand-1",
      department: null,
      projectId: "project-garuda",
      searchQuery: "  Designer  ",
    });

    expect(key).toBe("brand=brand-1|department=all|project=project-garuda|search=designer");
  });

  it("changes the row state reset key when project filters change", () => {
    const base = getTimelineRowStateResetKey({
      brandId: null,
      department: null,
      projectId: null,
      searchQuery: "",
    });
    const filtered = getTimelineRowStateResetKey({
      brandId: null,
      department: null,
      projectId: "project-garuda",
      searchQuery: "",
    });

    expect(base).not.toBe(filtered);
  });

  it("persists expansion and scroll across filter changes (no filter-key reset)", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    // Client-side filtering re-slices the in-memory window; expansion and
    // scroll position must survive a filter change, so the old filter-key
    // row-state reset is gone.
    expect(timelineSource).not.toContain("rowStateResetKey");
    expect(timelineSource).not.toContain("useTimelineExpansionStore.getState().collapseAll()");
    expect(timelineSource).not.toContain("rowVirtualizer.scrollToOffset(0)");
    expect(timelineSource).not.toContain("setSelectedProjectIdsByEmployee");
    expect(timelineSource).not.toContain("setInitializedProjectFiltersByEmployee");
    expect(timelineSource).not.toContain("setOpenProjectFilterEmployeeIds");
  });
});
