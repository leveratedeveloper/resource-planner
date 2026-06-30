import { describe, it, expect } from "vitest";
import { getTimelineColumns, getTimelineResolution } from "./date-range";

describe("custom view mode", () => {
  it("resolves to month resolution", () => {
    expect(getTimelineResolution("custom")).toBe("month");
  });

  it("builds one column per month across the custom range, inclusive", () => {
    const set = getTimelineColumns({
      anchorDate: new Date(2026, 0, 1),
      viewMode: "custom",
      showWeekends: false,
      customRange: { start: new Date(2026, 6, 1), end: new Date(2026, 11, 1) },
    });
    expect(set.resolution).toBe("month");
    expect(set.columns).toHaveLength(6);
    expect(set.columns[0].label).toBe("July");
    expect(set.columns[5].label).toBe("December");
    expect(set.startDate).toBe("2026-07-01");
    expect(set.endDate).toBe("2026-12-31");
  });

  it("supports a cross-year custom range", () => {
    const set = getTimelineColumns({
      anchorDate: new Date(2026, 0, 1),
      viewMode: "custom",
      showWeekends: false,
      customRange: { start: new Date(2026, 10, 1), end: new Date(2027, 1, 1) },
    });
    expect(set.columns).toHaveLength(4);
    expect(set.startDate).toBe("2026-11-01");
    expect(set.endDate).toBe("2027-02-28");
  });
});
