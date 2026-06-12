"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { invalidatePlannerData } from "@/lib/query/invalidatePlannerData";
import { queryKeys } from "@/lib/query/queryKeys";
import {
  useCreateAssignment,
  useDeleteAssignment,
  useUpdateAssignment,
  type Assignment,
} from "@/lib/query/hooks/useAssignments";
import { useMonthlyAssignmentDetail } from "@/lib/query/hooks/useMonthlyAssignmentDetail";
import { shouldLoadPlannerAssignmentDetail } from "@/lib/timeline/planner-loading";
import {
  deleteTimelineV2AssignmentsById,
  saveTimelineV2MonthlyAllocation,
  saveTimelineV2MonthlyAdjustment,
} from "@/lib/timeline-v2/assignment-write-service";
import { useAssignmentEditorStore } from "@/lib/timeline-v2/editor-store";
import { toLocalDateString } from "@/lib/utils";
import type { AssignmentCategory } from "@/types";

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

// Save/delete orchestration for the unified assignment editor. The month-save
// flow is ported from the legacy controller's handleConfirmMonthlyAllocation
// (delete overlapping plan rows -> recreate distribution rows -> reconcile
// adjustments -> invalidate) minus the confirmation dialog, which only
// survives for destructive deletes.
export function useTimelineEditor({
  canEditAssignments,
  createdByUuid,
}: {
  canEditAssignments: boolean;
  createdByUuid: string | null;
}) {
  const queryClient = useQueryClient();
  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const target = useAssignmentEditorStore((state) => state.target);
  const close = useAssignmentEditorStore((state) => state.close);
  const [isSavingMonth, setIsSavingMonth] = useState(false);

  // Month mode loads per-day detail rows (the bootstrap payload only carries
  // month summaries in month-resolution views). Cached + auto-invalidated.
  const needsMonthDetail =
    target?.mode === "month" && shouldLoadPlannerAssignmentDetail(target.clickedAssignment);
  const monthDetailQuery = useMonthlyAssignmentDetail(
    target?.mode === "month" && needsMonthDetail
      ? {
          resourceId: target.resourceId,
          projectId: target.project.id,
          monthStart: target.monthStart,
          monthEnd: target.monthEnd,
        }
      : null
  );

  const monthContext = useMemo(() => {
    if (target?.mode !== "month") return null;

    const source = needsMonthDetail
      ? monthDetailQuery.data ?? []
      : target.resourceAssignments;
    const detailAssignments = source.filter(
      (assignment) =>
        assignment.projectId === target.project.id &&
        !assignment.isTimeOff &&
        new Date(assignment.endDate) >= target.monthStart &&
        new Date(assignment.startDate) <= target.monthEnd
    );
    const existingAssignment = shouldLoadPlannerAssignmentDetail(target.clickedAssignment)
      ? detailAssignments.find((assignment) => !assignment.isAdjustment) ?? detailAssignments[0]
      : target.clickedAssignment;

    return {
      detailAssignments,
      existingAssignment,
      adjustmentAssignments: detailAssignments.filter((assignment) => assignment.isAdjustment),
      isLoadingDetail: needsMonthDetail && monthDetailQuery.isLoading,
    };
  }, [monthDetailQuery.data, monthDetailQuery.isLoading, needsMonthDetail, target]);

  const saveCreate = useCallback(
    (data: CreateSaveData) => {
      if (target?.mode !== "create" || !canEditAssignments) return;
      close();

      createAssignment.mutate({
        employeeId: target.resourceId,
        projectId: target.project.id,
        taskId: null,
        // Local date strings — the legacy popover path used toISOString(),
        // which shifts a day west of UTC midnight; toLocalDateString matches
        // what the month-allocation path always did.
        startDate: toLocalDateString(target.startDate),
        endDate: toLocalDateString(target.endDate),
        hoursPerDay: data.hoursPerDay.toString(),
        allocationPercentage: null,
        isTimeOff: false,
        isAdjustment: false,
        timeOffTypeId: null,
        category: data.category,
        isBillable: data.isBillable,
        status: "draft",
        note: data.note || null,
        createdById: createdByUuid,
      });
    },
    [canEditAssignments, close, createAssignment, createdByUuid, target]
  );

  const saveEdit = useCallback(
    (updates: Partial<Assignment>) => {
      if (target?.mode !== "edit" || !canEditAssignments) return;
      close();
      updateAssignment.mutate({ id: target.assignment.id, ...(updates as object) } as never);
    },
    [canEditAssignments, close, target, updateAssignment]
  );

  const deleteSingle = useCallback(() => {
    if (target?.mode !== "edit" || !canEditAssignments) return;
    close();
    deleteAssignment.mutate(target.assignment.id);
  }, [canEditAssignments, close, deleteAssignment, target]);

  const saveMonth = useCallback(
    async (data: MonthSaveData) => {
      if (target?.mode !== "month" || !canEditAssignments || !monthContext) return;

      const { existingAssignment, detailAssignments } = monthContext;
      const isEditMode = !!existingAssignment;
      const onlyAdjustmentChanged =
        isEditMode &&
        !data.planHoursChanged &&
        (data.removeAdjustment || !!data.adjustmentDistributions);

      setIsSavingMonth(true);
      const newRangeStart = new Date(data.startDate);
      const newRangeEnd = new Date(data.endDate);

      try {
        if (!onlyAdjustmentChanged) {
          const overlappingAssignments = detailAssignments.filter((assignment) => {
            if (assignment.isTimeOff || assignment.isAdjustment) return false;
            if (assignment.projectId !== target.project.id) return false;
            const assignStart = new Date(assignment.startDate);
            const assignEnd = new Date(assignment.endDate);
            return assignEnd >= newRangeStart && assignStart <= newRangeEnd;
          });

          if (overlappingAssignments.length > 0) {
            await deleteTimelineV2AssignmentsById(overlappingAssignments.map((assignment) => assignment.id));
            queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
              if (!old) return old;
              const deletedIds = new Set(overlappingAssignments.map((assignment) => assignment.id));
              return old.filter((assignment) => !deletedIds.has(assignment.id));
            });
          }

          await saveTimelineV2MonthlyAllocation({
            resourceId: target.resourceId,
            projectId: target.project.id,
            distributions: data.distributions,
            category: data.category,
            isBillable: data.isBillable,
            note: data.note,
            createAssignment: async (assignment) => createAssignment.mutateAsync(assignment),
          });
        }

        const { adjustmentDistributions, adjustmentStartDate, adjustmentEndDate, removeAdjustment } = data;
        if (removeAdjustment || adjustmentDistributions) {
          const adjustmentAssignmentsToDelete = detailAssignments.filter((assignment) => {
            if (!assignment.isAdjustment || assignment.isTimeOff) return false;
            if (assignment.projectId !== target.project.id) return false;
            const assignStart = new Date(assignment.startDate);
            const assignEnd = new Date(assignment.endDate);
            const rangeStart = adjustmentStartDate ?? newRangeStart;
            const rangeEnd = adjustmentEndDate ?? newRangeEnd;
            return assignEnd >= rangeStart && assignStart <= rangeEnd;
          });

          if (adjustmentAssignmentsToDelete.length > 0) {
            await deleteTimelineV2AssignmentsById(adjustmentAssignmentsToDelete.map((assignment) => assignment.id));
          }
        }

        if (!removeAdjustment && adjustmentDistributions && adjustmentDistributions.length > 0) {
          await saveTimelineV2MonthlyAdjustment({
            resourceId: target.resourceId,
            projectId: target.project.id,
            adjustmentDistributions,
            category: data.category,
            isBillable: data.isBillable,
            note: data.note,
            createAssignment: async (assignment) => createAssignment.mutateAsync(assignment),
          });
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
        queryClient.invalidateQueries({ queryKey: queryKeys.employees });
        invalidatePlannerData(queryClient);
        close();
      } catch {
        toast({
          variant: "destructive",
          title: "Failed to save monthly allocation",
          description: "The timeline may be partially updated. Refresh and try again.",
        });
      } finally {
        setIsSavingMonth(false);
      }
    },
    [canEditAssignments, close, createAssignment, monthContext, queryClient, target]
  );

  const deleteMonth = useCallback(async () => {
    if (target?.mode !== "month" || !canEditAssignments || !monthContext) return;

    const assignmentsInMonth = monthContext.detailAssignments.filter((assignment) => {
      if (assignment.isTimeOff) return false;
      if (assignment.projectId !== target.project.id) return false;
      const assignStart = new Date(assignment.startDate);
      const assignEnd = new Date(assignment.endDate);
      return assignEnd >= target.monthStart && assignStart <= target.monthEnd;
    });

    setIsSavingMonth(true);
    try {
      await deleteTimelineV2AssignmentsById(assignmentsInMonth.map((assignment) => assignment.id));
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
      invalidatePlannerData(queryClient);
      close();
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to delete monthly allocation",
        description: "Refresh and try again.",
      });
    } finally {
      setIsSavingMonth(false);
    }
  }, [canEditAssignments, close, monthContext, queryClient, target]);

  return {
    target,
    close,
    monthContext,
    saveCreate,
    saveEdit,
    deleteSingle,
    saveMonth,
    deleteMonth,
    isSavingMonth,
  };
}
