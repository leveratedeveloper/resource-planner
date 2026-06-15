import { create } from "zustand";

interface TimelineExpansionState {
  expandedIds: ReadonlySet<string>;
  toggle: (id: string) => void;
  collapseAll: () => void;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export const useTimelineExpansionStore = create<TimelineExpansionState>()((set, get) => ({
  expandedIds: EMPTY_SET,
  toggle: (id) => {
    const next = new Set(get().expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ expandedIds: next });
  },
  collapseAll: () => {
    // Skip the update when already empty so subscribers don't re-render.
    if (get().expandedIds.size === 0) return;
    set({ expandedIds: new Set() });
  },
}));

export const useIsRowExpanded = (id: string): boolean =>
  useTimelineExpansionStore((s) => s.expandedIds.has(id));
