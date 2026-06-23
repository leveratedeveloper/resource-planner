import { create } from "zustand";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

// The single editing surface's target. Exactly one editor can be open at a
// time — opening a new target replaces the previous one.
export type AssignmentEditorTarget =
  | {
      mode: "create";
      resourceId: string;
      project: ProjectOption;
      startDate: Date;
      endDate: Date;
    }
  | {
      mode: "edit";
      assignment: Assignment;
      project: ProjectOption;
    }
  | {
      mode: "month";
      resourceId: string;
      project: ProjectOption;
      monthStart: Date;
      monthEnd: Date;
      // The existing assignment for this employee+project in this month, if any.
      clickedAssignment?: Assignment;
    };

type AssignmentEditorState = {
  target: AssignmentEditorTarget | null;
  open: (target: AssignmentEditorTarget) => void;
  close: () => void;
};

export const useAssignmentEditorStore = create<AssignmentEditorState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
