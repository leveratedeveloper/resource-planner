"use client";

import type { AssignmentCategory } from "@/types";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { useAssignmentEditorStore } from "@/lib/timeline-v2/editor-store";

// TEMPORARY: inline in-timeline editing (create / edit / month-distribution)
// is DISABLED during the monthly-allocation migration. The editor store no
// longer opens (see editor-store.ts), so these handlers are inert no-ops kept
// only to preserve this hook's surface for AssignmentEditor. All assignment
// writes currently go through useAssignmentCommands (Add Project, Manage Team,
// Bulk Assign). Re-implementing the monthly in-timeline editor on top of
// upsertAssignment(setMonthHours) is the next planned piece of work.

export type MonthSaveData = {
  totalHours: number;
  startDate: Date;
  endDate: Date;
  distributions: Array<{ date: Date; hours: number }>;
  category: AssignmentCategory;
  isBillable: boolean;
  note?: string;
  adjustmentDistributions?: Array<{ date: Date; hours: number }>;
  adjustmentStartDate?: Date;
  adjustmentEndDate?: Date;
  removeAdjustment?: boolean;
  planHoursChanged?: boolean;
};

export type CreateSaveData = {
  hoursPerDay: number;
  category: AssignmentCategory;
  isBillable: boolean;
  note?: string;
};

export function useTimelineEditor(_opts: {
  canEditAssignments: boolean;
  createdByUuid: string | null;
}) {
  const target = useAssignmentEditorStore((state) => state.target);
  const close = useAssignmentEditorStore((state) => state.close);

  return {
    target,
    close,
    monthContext: null,
    saveCreate: (_data: CreateSaveData) => {},
    saveEdit: (_updates: Partial<Assignment>) => {},
    deleteSingle: () => {},
    saveMonth: async (_data: MonthSaveData) => {},
    deleteMonth: async () => {},
    isSavingMonth: false,
  };
}
