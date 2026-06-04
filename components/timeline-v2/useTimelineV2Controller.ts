"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query/queryKeys";
import { useCreateAssignment, useDeleteAssignment, useUpdateAssignment } from "@/lib/query/hooks/useAssignments";
import { useCreateActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { shouldLoadPlannerAssignmentDetail } from "@/lib/timeline/planner-loading";
import { getTimelineV2MonthlyDetailKey, fetchTimelineV2MonthlyAssignmentDetail, deleteTimelineV2AssignmentsById, saveTimelineV2MonthlyAllocation, saveTimelineV2MonthlyAdjustment } from "@/lib/timeline-v2/monthly-allocation-service";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { AssignmentCategory } from "@/types";
import type { MonthlyAllocationData } from "@/components/timeline/MonthlyAllocationConfirmation";

type PlannedPopoverState = {
  resourceId: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
} | null;

type ActualPopoverState = {
  resourceId: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  plannedHoursLimit: number;
  currentActualHours: number;
} | null;

type MonthlyAllocationModalState = {
  resourceId: string;
  monthStart: Date;
  monthEnd: Date;
  project: ProjectOption;
  existingAssignment?: Assignment;
  adjustmentAssignments?: Assignment[];
  detailAssignments?: Assignment[];
  monthlyTotalHours?: number;
  planTotalHours?: number;
  adjustmentTotalHours?: number;
} | null;

type PendingMonthlyAllocationSave = {
  data: {
    projectId: string;
    totalHours: number;
    startDate: Date;
    endDate: Date;
    distributions: Array<{ date: Date; hours: number }>;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
    adjustmentHours?: number;
    adjustmentStartDate?: Date;
    adjustmentEndDate?: Date;
    adjustmentDistributions?: Array<{ date: Date; hours: number }>;
    removeAdjustment?: boolean;
    planHoursChanged?: boolean;
  };
  existingAssignment?: Assignment;
  resourceId: string;
};

async function updateActualAssignment({
  uuid,
  ...data
}: Partial<ActualAssignment> & { uuid: string }): Promise<ActualAssignment> {
  const response = await fetch(`/api/actual/${uuid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update actual assignment");
  }

  const result = await response.json();
  return result.data;
}

async function deleteActualAssignment(uuid: string): Promise<void> {
  const response = await fetch(`/api/actual/${uuid}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete actual assignment");
  }
}

export function useTimelineV2Controller({
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
  const createActualAssignment = useCreateActualAssignment();

  const [plannedPopover, setPlannedPopover] = useState<PlannedPopoverState>(null);
  const [actualPopover, setActualPopover] = useState<ActualPopoverState>(null);
  const [monthlyAllocationModal, setMonthlyAllocationModal] = useState<MonthlyAllocationModalState>(null);
  const [monthlyAllocationConfirm, setMonthlyAllocationConfirm] = useState<{
    data: MonthlyAllocationData;
    isEditMode: boolean;
  } | null>(null);
  const [pendingMonthlyAllocationSave, setPendingMonthlyAllocationSave] = useState<PendingMonthlyAllocationSave | null>(null);
  const [loadingMonthlyPlanDetailKey, setLoadingMonthlyPlanDetailKey] = useState<string | null>(null);
  const monthlyPlanDetailRequestRef = useRef<{ key: string; controller: AbortController } | null>(null);

  useEffect(() => {
    return () => {
      monthlyPlanDetailRequestRef.current?.controller.abort();
    };
  }, []);

  const closePlannedPopover = useCallback(() => setPlannedPopover(null), []);
  const closeActualPopover = useCallback(() => setActualPopover(null), []);
  const closeMonthlyAllocationModal = useCallback(() => setMonthlyAllocationModal(null), []);
  const closeMonthlyAllocationConfirm = useCallback(() => setMonthlyAllocationConfirm(null), []);

  const handleCreatePlannedAssignment = useCallback((args: {
    resourceId: string;
    projectId: string;
    startDate: Date;
    endDate: Date;
  }) => {
    setPlannedPopover(args);
  }, []);

  const handleCreateActualAssignment = useCallback((args: {
    resourceId: string;
    projectId: string;
    startDate: Date;
    endDate: Date;
    plannedHoursLimit: number;
    currentActualHours: number;
  }) => {
    setActualPopover(args);
  }, []);

  const handleCreateTimeOff = useCallback((args: {
    resourceId: string;
    startDate: Date;
    endDate: Date;
  }) => {
    if (!canEditAssignments) return;

    createAssignment.mutate({
      employeeId: args.resourceId,
      projectId: null,
      taskId: null,
      startDate: args.startDate.toISOString().slice(0, 10),
      endDate: args.endDate.toISOString().slice(0, 10),
      hoursPerDay: "8",
      allocationPercentage: null,
      isTimeOff: true,
      isAdjustment: false,
      timeOffTypeId: null,
      category: "Other",
      isBillable: false,
      status: "confirmed",
      note: "Time Off",
      createdById: createdByUuid,
    });
  }, [canEditAssignments, createAssignment, createdByUuid]);

  const handleOpenMonthlyAllocation = useCallback(async (args: {
    resourceId: string;
    monthStart: Date;
    monthEnd: Date;
    project: ProjectOption;
    resourceAssignments: Assignment[];
    clickedAssignment?: Assignment;
    monthlyTotalHours?: number;
    planTotalHours?: number;
    adjustmentTotalHours?: number;
  }) => {
    if (!canEditAssignments) return;

    const openModal = (detailAssignments: Assignment[] = args.resourceAssignments) => {
      const projectDetailAssignments = detailAssignments.filter(
        (assignment) =>
          assignment.projectId === args.project.id &&
          !assignment.isTimeOff &&
          new Date(assignment.endDate) >= args.monthStart &&
          new Date(assignment.startDate) <= args.monthEnd
      );
      const existingAssignment = shouldLoadPlannerAssignmentDetail(args.clickedAssignment)
        ? projectDetailAssignments.find((assignment) => !assignment.isAdjustment) ?? projectDetailAssignments[0]
        : args.clickedAssignment;

      setMonthlyAllocationModal({
        resourceId: args.resourceId,
        monthStart: args.monthStart,
        monthEnd: args.monthEnd,
        project: args.project,
        existingAssignment,
        adjustmentAssignments: projectDetailAssignments.filter((assignment) => assignment.isAdjustment),
        detailAssignments: projectDetailAssignments,
        monthlyTotalHours: args.monthlyTotalHours,
        planTotalHours: args.planTotalHours,
        adjustmentTotalHours: args.adjustmentTotalHours,
      });
    };

    if (!shouldLoadPlannerAssignmentDetail(args.clickedAssignment)) {
      openModal();
      return;
    }

    const requestKey = getTimelineV2MonthlyDetailKey(args.resourceId, args.project.id, args.monthStart, args.monthEnd);
    const existingRequest = monthlyPlanDetailRequestRef.current;
    if (existingRequest?.key === requestKey) return;

    existingRequest?.controller.abort();
    const controller = new AbortController();
    monthlyPlanDetailRequestRef.current = { key: requestKey, controller };
    setLoadingMonthlyPlanDetailKey(requestKey);

    try {
      const detailAssignments = await fetchTimelineV2MonthlyAssignmentDetail({
        resourceId: args.resourceId,
        projectId: args.project.id,
        monthStart: args.monthStart,
        monthEnd: args.monthEnd,
        signal: controller.signal,
      });

      if (monthlyPlanDetailRequestRef.current?.key === requestKey) {
        openModal(detailAssignments);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast({
        variant: "destructive",
        title: "Failed to load assignment detail",
        description: "Try opening this monthly allocation again.",
      });
    } finally {
      if (monthlyPlanDetailRequestRef.current?.key === requestKey) {
        monthlyPlanDetailRequestRef.current = null;
        setLoadingMonthlyPlanDetailKey(null);
      }
    }
  }, [canEditAssignments]);

  const handleSavePlannedPopover = useCallback((data: {
    hoursPerDay: number;
    workDays: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => {
    if (!plannedPopover || !canEditAssignments) return;

    const finalEndDate = new Date(plannedPopover.endDate);
    setPlannedPopover(null);

    createAssignment.mutate({
      employeeId: plannedPopover.resourceId,
      projectId: plannedPopover.projectId,
      taskId: null,
      startDate: plannedPopover.startDate.toISOString().slice(0, 10),
      endDate: finalEndDate.toISOString().slice(0, 10),
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
  }, [canEditAssignments, createAssignment, createdByUuid, plannedPopover]);

  const handleSaveActualPopover = useCallback((data: {
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => {
    if (!actualPopover || !canEditAssignments) {
      setActualPopover(null);
      return;
    }

    createActualAssignment.mutate({
      employeeUuid: actualPopover.resourceId,
      projectUuid: actualPopover.projectId,
      taskUuid: null,
      startDate: data.startDate,
      endDate: data.endDate,
      hoursPerDay: data.hoursPerDay,
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeUuid: null,
      category: data.category,
      isBillable: data.isBillable,
      status: "confirmed",
      note: data.note || null,
      createdByUuid,
    });

    setActualPopover(null);
  }, [actualPopover, canEditAssignments, createActualAssignment, createdByUuid]);

  const handleDeletePlannedAssignment = useCallback((id: string) => {
    if (!canEditAssignments) return;
    deleteAssignment.mutate(id);
  }, [canEditAssignments, deleteAssignment]);

  const handleUpdatePlannedAssignment = useCallback((id: string, updates: unknown) => {
    if (!canEditAssignments) return;
    updateAssignment.mutate({ id, ...(updates as object) } as never);
  }, [canEditAssignments, updateAssignment]);

  const handleUpdateActualAssignment = useCallback((uuid: string, updates: Partial<ActualAssignment>) => {
    if (!canEditAssignments) return;
    void updateActualAssignment({ uuid, ...updates }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["actual"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline });
    });
  }, [canEditAssignments, queryClient]);

  const handleDeleteActualAssignment = useCallback((uuid: string) => {
    if (!canEditAssignments) return;
    void deleteActualAssignment(uuid).then(() => {
      queryClient.invalidateQueries({ queryKey: ["actual"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline });
    });
  }, [canEditAssignments, queryClient]);

  const handleSaveMonthlyAllocation = useCallback((data: PendingMonthlyAllocationSave["data"], existingAssignment?: Assignment) => {
    const project = monthlyAllocationModal?.project;
    if (!project || !canEditAssignments) {
      setMonthlyAllocationModal(null);
      return;
    }

    setMonthlyAllocationConfirm({
      data: {
        projectId: data.projectId,
        projectName: project.name,
        projectColor: project.color,
        totalHours: data.totalHours,
        startDate: data.startDate,
        endDate: data.endDate,
        distributions: data.distributions,
        category: data.category,
        isBillable: data.isBillable,
        note: data.note,
        adjustmentHours: data.adjustmentHours,
        adjustmentStartDate: data.adjustmentStartDate,
        adjustmentEndDate: data.adjustmentEndDate,
        removeAdjustment: data.removeAdjustment,
      },
      isEditMode: !!existingAssignment,
    });

    setPendingMonthlyAllocationSave({
      data,
      existingAssignment,
      resourceId: monthlyAllocationModal.resourceId,
    });
  }, [canEditAssignments, monthlyAllocationModal]);

  const handleConfirmMonthlyAllocation = useCallback(async () => {
    if (!pendingMonthlyAllocationSave) return;

    const { data, existingAssignment, resourceId } = pendingMonthlyAllocationSave;
    const modalDetailAssignments = monthlyAllocationModal?.detailAssignments ?? [];
    const isEditMode = !!existingAssignment;
    const onlyAdjustmentChanged =
      isEditMode &&
      !data.planHoursChanged &&
      (data.removeAdjustment || !!data.adjustmentDistributions);

    setMonthlyAllocationConfirm(null);

    const newRangeStart = new Date(data.startDate);
    const newRangeEnd = new Date(data.endDate);

    if (!onlyAdjustmentChanged) {
      const overlappingAssignments = modalDetailAssignments.filter((assignment) => {
        if (assignment.isTimeOff || assignment.isAdjustment) return false;
        if (assignment.projectId !== data.projectId) return false;
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
        resourceId,
        projectId: data.projectId,
        distributions: data.distributions,
        category: data.category,
        isBillable: data.isBillable,
        note: data.note,
        createAssignment: async (assignment) => {
          const result = await createAssignment.mutateAsync(assignment);
          return result;
        },
      });
    }

    const { adjustmentDistributions, adjustmentStartDate, adjustmentEndDate, removeAdjustment } = data;
    if (removeAdjustment || adjustmentDistributions) {
      const adjustmentAssignmentsToDelete = modalDetailAssignments.filter((assignment) => {
        if (!assignment.isAdjustment || assignment.isTimeOff) return false;
        if (assignment.projectId !== data.projectId) return false;
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
        resourceId,
        projectId: data.projectId,
        adjustmentDistributions,
        category: data.category,
        isBillable: data.isBillable,
        note: data.note,
        createAssignment: async (assignment) => createAssignment.mutateAsync(assignment),
      });
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
    queryClient.invalidateQueries({ queryKey: queryKeys.employees });
    queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline });

    setPendingMonthlyAllocationSave(null);
    setMonthlyAllocationModal(null);
  }, [createAssignment, monthlyAllocationModal, pendingMonthlyAllocationSave, queryClient]);

  const handleDeleteMonthlyAllocation = useCallback(async () => {
    if (!monthlyAllocationModal) return;
    const projectId = monthlyAllocationModal.project.id;
    const monthStart = monthlyAllocationModal.monthStart;
    const monthEnd = monthlyAllocationModal.monthEnd;
    const assignmentsInMonth = (monthlyAllocationModal.detailAssignments ?? []).filter((assignment) => {
      if (assignment.isTimeOff) return false;
      if (assignment.projectId !== projectId) return false;
      const assignStart = new Date(assignment.startDate);
      const assignEnd = new Date(assignment.endDate);
      return assignEnd >= monthStart && assignStart <= monthEnd;
    });

    await deleteTimelineV2AssignmentsById(assignmentsInMonth.map((assignment) => assignment.id));
    queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
    queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline });
    setMonthlyAllocationModal(null);
  }, [monthlyAllocationModal, queryClient]);

  const openMonthlyAllocationConfirm = useCallback(() => setMonthlyAllocationConfirm((value) => value), []);

  return {
    plannedPopover,
    actualPopover,
    monthlyAllocationModal,
    monthlyAllocationConfirm,
    loadingMonthlyPlanDetailKey,
    canEditAssignments,
    handleCreatePlannedAssignment,
    handleCreateActualAssignment,
    handleCreateTimeOff,
    handleOpenMonthlyAllocation,
    handleSavePlannedPopover,
    handleSaveActualPopover,
    handleDeletePlannedAssignment,
    handleUpdatePlannedAssignment,
    handleUpdateActualAssignment,
    handleDeleteActualAssignment,
    handleSaveMonthlyAllocation,
    handleConfirmMonthlyAllocation,
    handleDeleteMonthlyAllocation,
    closePlannedPopover,
    closeActualPopover,
    closeMonthlyAllocationModal,
    closeMonthlyAllocationConfirm,
    setMonthlyAllocationModal,
    setPendingMonthlyAllocationSave,
    openMonthlyAllocationConfirm,
  };
}
