import { startOfDay } from "date-fns";
import type { NewAssignment, Assignment } from "@/lib/query/hooks/useAssignments";
import { toLocalDateString } from "@/lib/utils";

export function getTimelineV2MonthlyDetailKey(
  resourceId: string,
  projectId: string,
  monthStart: Date,
  monthEnd: Date
): string {
  return [resourceId, projectId, toLocalDateString(monthStart), toLocalDateString(monthEnd)].join(":");
}

export async function fetchTimelineV2MonthlyAssignmentDetail({
  resourceId,
  projectId,
  monthStart,
  monthEnd,
  signal,
}: {
  resourceId: string;
  projectId: string;
  monthStart: Date;
  monthEnd: Date;
  signal?: AbortSignal;
}): Promise<Assignment[]> {
  const url = new URL("/api/assignments", window.location.origin);
  url.searchParams.set("employeeId", resourceId);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("startDate", toLocalDateString(monthStart));
  url.searchParams.set("endDate", toLocalDateString(monthEnd));

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error("Failed to load monthly assignment detail");
  }

  const data = await response.json();
  return data.data ?? [];
}

export async function deleteTimelineV2AssignmentsById(ids: string[]) {
  await Promise.all(
    ids.map(async (id) => {
      const response = await fetch(`/api/assignments/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete ${id}: ${response.status} - ${text}`);
      }
    })
  );
}

export async function saveTimelineV2MonthlyAllocation({
  resourceId,
  projectId,
  distributions,
  category,
  isBillable,
  note,
  createAssignment,
}: {
  resourceId: string;
  projectId: string;
  distributions: Array<{ date: Date; hours: number }>;
  category: string | null;
  isBillable: boolean;
  note?: string | null;
  createAssignment: (assignment: NewAssignment) => Promise<unknown>;
}) {
  const created = await Promise.all(
    distributions.map(({ date, hours }) =>
      createAssignment({
        employeeId: resourceId,
        projectId,
        taskId: null,
        startDate: toLocalDateString(startOfDay(date)),
        endDate: toLocalDateString(startOfDay(date)),
        hoursPerDay: String(hours),
        allocationPercentage: null,
        isTimeOff: false,
        isAdjustment: false,
        timeOffTypeId: null,
        category,
        isBillable,
        status: "draft",
        note: note ?? null,
        createdById: null,
      })
    )
  );

  return { createdCount: created.length };
}

export async function saveTimelineV2MonthlyAdjustment({
  resourceId,
  projectId,
  adjustmentDistributions,
  category,
  isBillable,
  note,
  createAssignment,
}: {
  resourceId: string;
  projectId: string;
  adjustmentDistributions: Array<{ date: Date; hours: number }>;
  category: string | null;
  isBillable: boolean;
  note?: string | null;
  createAssignment: (assignment: NewAssignment) => Promise<unknown>;
}) {
  const created = await Promise.all(
    adjustmentDistributions.map(({ date, hours }) =>
      createAssignment({
        employeeId: resourceId,
        projectId,
        taskId: null,
        startDate: toLocalDateString(startOfDay(date)),
        endDate: toLocalDateString(startOfDay(date)),
        hoursPerDay: String(hours),
        allocationPercentage: null,
        isTimeOff: false,
        isAdjustment: true,
        timeOffTypeId: null,
        category,
        isBillable,
        status: "draft",
        note: note ?? null,
        createdById: null,
      })
    )
  );

  return { createdCount: created.length };
}
