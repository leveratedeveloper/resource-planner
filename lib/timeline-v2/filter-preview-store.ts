import { create } from "zustand";
import type { FilterPreviewDataset } from "@/lib/timeline-v2/count-matching-employees";

type FilterPreviewState = {
  dataset: FilterPreviewDataset | null;
  setDataset: (dataset: FilterPreviewDataset) => void;
};

export const useFilterPreviewStore = create<FilterPreviewState>((set) => ({
  dataset: null,
  setDataset: (dataset) => set({ dataset }),
}));
