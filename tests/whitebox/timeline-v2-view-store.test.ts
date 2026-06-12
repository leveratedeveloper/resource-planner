import { beforeEach, describe, expect, it } from "vitest";
import { useTimelineViewStore } from "@/lib/timeline-v2/view-store";

const storage = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
};

const initialState = useTimelineViewStore.getState();

beforeEach(() => {
  storage.clear();
  useTimelineViewStore.setState(initialState, true);
});

describe("timeline view store", () => {
  it("normalizes the anchor date to the Monday of its week", () => {
    // 2026-06-11 is a Thursday; its Monday is 2026-06-08.
    useTimelineViewStore.getState().setAnchorDate(new Date("2026-06-11T15:30:00"));

    expect(useTimelineViewStore.getState().anchorDate).toEqual(new Date("2026-06-08T00:00:00"));
  });

  it("keeps a Monday anchor on the same Monday", () => {
    useTimelineViewStore.getState().setAnchorDate(new Date("2026-06-08T00:00:00"));

    expect(useTimelineViewStore.getState().anchorDate).toEqual(new Date("2026-06-08T00:00:00"));
  });

  it("persists the weekend toggle to localStorage as \"true\"/\"false\"", () => {
    useTimelineViewStore.getState().toggleWeekends();
    expect(useTimelineViewStore.getState().showWeekends).toBe(true);
    expect(storage.get("showWeekends")).toBe("true");

    useTimelineViewStore.getState().toggleWeekends();
    expect(useTimelineViewStore.getState().showWeekends).toBe(false);
    expect(storage.get("showWeekends")).toBe("false");
  });

  it("hydrates the saved weekend preference and marks hydration complete", () => {
    storage.set("showWeekends", "true");

    useTimelineViewStore.getState().hydrateWeekendPreference();

    expect(useTimelineViewStore.getState().showWeekends).toBe(true);
    expect(useTimelineViewStore.getState().hasHydratedWeekendPreference).toBe(true);
  });

  it("keeps the default weekend value when nothing is saved, but still marks hydration", () => {
    useTimelineViewStore.getState().hydrateWeekendPreference();

    expect(useTimelineViewStore.getState().showWeekends).toBe(false);
    expect(useTimelineViewStore.getState().hasHydratedWeekendPreference).toBe(true);
  });

  it("clamps the resource column width to the token bounds [224, 416]", () => {
    useTimelineViewStore.getState().setResourceColumnWidth(100);
    expect(useTimelineViewStore.getState().resourceColumnWidth).toBe(224);

    useTimelineViewStore.getState().setResourceColumnWidth(1000);
    expect(useTimelineViewStore.getState().resourceColumnWidth).toBe(416);

    useTimelineViewStore.getState().setResourceColumnWidth(300);
    expect(useTimelineViewStore.getState().resourceColumnWidth).toBe(300);
  });
});
