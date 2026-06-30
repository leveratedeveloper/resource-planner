import { create } from "zustand";
import { startOfMonth, startOfWeek } from "date-fns";
import type { TimelineViewMode } from "@/lib/timeline-v2/types";
import {
  TIMELINE_DIMENSIONS,
  clampTimelineResourceColumnWidth,
} from "@/lib/timeline-v2/layout";

type TimelineViewState = {
  viewMode: TimelineViewMode;
  customRange: { start: Date; end: Date } | null;
  // null until the page seeds it from initialTimelineAnchor via setAnchorDate.
  anchorDate: Date | null;
  showWeekends: boolean;
  hasHydratedWeekendPreference: boolean;
  resourceColumnWidth: number;
  setViewMode: (mode: TimelineViewMode) => void;
  setCustomRange: (range: { start: Date; end: Date }) => void;
  setAnchorDate: (date: Date) => void;
  toggleWeekends: () => void;
  hydrateWeekendPreference: () => void;
  setResourceColumnWidth: (width: number) => void;
};

export const useTimelineViewStore = create<TimelineViewState>((set) => ({
  viewMode: "quarter",
  customRange: null,
  anchorDate: null,
  showWeekends: false,
  hasHydratedWeekendPreference: false,
  resourceColumnWidth: TIMELINE_DIMENSIONS.resourceCol.default,
  setViewMode: (mode) => set({ viewMode: mode }),
  setCustomRange: (range) =>
    set({
      viewMode: "custom",
      customRange: { start: startOfMonth(range.start), end: startOfMonth(range.end) },
    }),
  // Timeline columns are Monday-aligned, so the anchor always snaps to week start.
  setAnchorDate: (date) => set({ anchorDate: startOfWeek(date, { weekStartsOn: 1 }) }),
  toggleWeekends: () =>
    set((state) => {
      const next = !state.showWeekends;
      localStorage.setItem("showWeekends", String(next));
      return { showWeekends: next };
    }),
  // Call-site runs this in a useEffect, so localStorage access is safe here.
  hydrateWeekendPreference: () => {
    const saved = localStorage.getItem("showWeekends");
    set((state) => ({
      showWeekends: saved === null ? state.showWeekends : saved === "true",
      hasHydratedWeekendPreference: true,
    }));
  },
  setResourceColumnWidth: (width) =>
    set({ resourceColumnWidth: clampTimelineResourceColumnWidth(width) }),
}));
