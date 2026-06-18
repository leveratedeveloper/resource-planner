import { create } from "zustand";

// Which employee row launched the project picker, plus the project IDs that
// employee is already assigned to (so the picker can disable them). Exactly one
// picker open at a time — mirrors useAssignmentEditorStore.
export type AddProjectTarget = {
  resourceId: string;
  assignedProjectIds: string[];
};

type AddProjectState = {
  target: AddProjectTarget | null;
  open: (target: AddProjectTarget) => void;
  close: () => void;
};

export const useAddProjectStore = create<AddProjectState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
