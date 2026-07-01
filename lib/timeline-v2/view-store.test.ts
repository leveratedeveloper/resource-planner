import { describe, it, expect, beforeEach } from "vitest";
import { useTimelineViewStore } from "./view-store";

describe("useTimelineViewStore.setCustomRange", () => {
  beforeEach(() => {
    useTimelineViewStore.setState({ viewMode: "quarter", customRange: null });
  });

  it("stores the range snapped to first-of-month and switches to custom mode", () => {
    useTimelineViewStore.getState().setCustomRange({
      start: new Date(2026, 6, 15),
      end: new Date(2026, 11, 20),
    });
    const state = useTimelineViewStore.getState();
    expect(state.viewMode).toBe("custom");
    expect(state.customRange).toEqual({ start: new Date(2026, 6, 1), end: new Date(2026, 11, 1) });
  });
});
