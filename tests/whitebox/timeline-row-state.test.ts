import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getTimelineRowStateResetKey,
  hasEmployeeFlag,
  setEmployeeFlag,
} from "@/lib/timeline/row-state";

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

  it("resets expanded timeline row state from the global filter signature", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    expect(timelineSource).toContain("rowStateResetKey");
    expect(timelineSource).toContain("useTimelineExpansionStore.getState().collapseAll()");
    expect(timelineSource).not.toContain("setSelectedProjectIdsByEmployee");
    expect(timelineSource).not.toContain("setInitializedProjectFiltersByEmployee");
    expect(timelineSource).not.toContain("setOpenProjectFilterEmployeeIds");
    expect(timelineSource).toContain("rowVirtualizer.scrollToOffset(0)");
  });
});
