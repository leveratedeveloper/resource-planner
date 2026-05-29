import { isWithinInterval, startOfDay } from "date-fns";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { extractDeliverables } from "@/lib/timeline/resource-row-model";

export type DeliverableProjectRow = {
  id: string;
  project: ProjectOption;
  planAssignments: Assignment[];
  actualAssignments: ActualAssignment[];
};

export type DeliverableGroup = {
  name: string | null;
  projects: DeliverableProjectRow[];
};

export function getResourceProjects(
  resourceAssignments: Assignment[],
  projects: ProjectOption[]
): ProjectOption[] {
  const projectIds = new Set(
    resourceAssignments
      .filter((assignment) => !assignment.isTimeOff && assignment.projectId)
      .map((assignment) => assignment.projectId)
  );

  return projects.filter((project) => projectIds.has(project.id));
}

export function sortResourceProjects({
  projects,
  resourceAssignments,
  brandId,
  days,
}: {
  projects: ProjectOption[];
  resourceAssignments: Assignment[];
  brandId: string | null;
  days: Date[];
}): ProjectOption[] {
  const timelineStart = days[0] ? startOfDay(days[0]) : null;
  const timelineEnd = days[days.length - 1] ? startOfDay(days[days.length - 1]) : null;

  return [...projects].sort((a, b) => {
    if (brandId) {
      const aBrandMatch = a.brandId === brandId;
      const bBrandMatch = b.brandId === brandId;
      if (aBrandMatch !== bBrandMatch) return aBrandMatch ? -1 : 1;
    }

    const aHasActive = hasActiveTimelineAssignment(a.id, resourceAssignments, timelineStart, timelineEnd);
    const bHasActive = hasActiveTimelineAssignment(b.id, resourceAssignments, timelineStart, timelineEnd);
    if (aHasActive !== bHasActive) return aHasActive ? -1 : 1;

    const aLatest = getLatestAssignmentStart(a.id, resourceAssignments);
    const bLatest = getLatestAssignmentStart(b.id, resourceAssignments);
    if (aLatest && bLatest && aLatest.getTime() !== bLatest.getTime()) {
      return bLatest.getTime() - aLatest.getTime();
    }
    if (aLatest && !bLatest) return -1;
    if (!aLatest && bLatest) return 1;

    return a.name.localeCompare(b.name);
  });
}

function hasActiveTimelineAssignment(
  projectId: string,
  assignments: Assignment[],
  timelineStart: Date | null,
  timelineEnd: Date | null
): boolean {
  if (!timelineStart || !timelineEnd) return false;

  return assignments.some(
    (assignment) =>
      assignment.projectId === projectId &&
      !assignment.isTimeOff &&
      isWithinInterval(startOfDay(new Date(assignment.startDate)), {
        start: timelineStart,
        end: timelineEnd,
      })
  );
}

function getLatestAssignmentStart(
  projectId: string,
  assignments: Assignment[]
): Date | null {
  let latest: Date | null = null;

  for (const assignment of assignments) {
    if (assignment.projectId !== projectId || assignment.isTimeOff) continue;
    const assignmentStart = new Date(assignment.startDate);
    if (!latest || assignmentStart > latest) latest = assignmentStart;
  }

  return latest;
}

export function groupProjectsByDeliverable({
  sortedProjects,
  resourceAssignments,
  actualAssignments,
}: {
  sortedProjects: ProjectOption[];
  resourceAssignments: Assignment[];
  actualAssignments: ActualAssignment[];
}): DeliverableGroup[] {
  const groupsMap = new Map<string, DeliverableProjectRow[]>();

  for (const project of sortedProjects) {
    const projectPlanAssignments = resourceAssignments.filter(
      (assignment) => assignment.projectId === project.id && !assignment.isTimeOff
    );
    const projectActualAssignments = actualAssignments.filter(
      (assignment) => assignment.projectUuid === project.id && !assignment.isTimeOff
    );
    const deliverableSet = new Set<string>();

    for (const assignment of projectPlanAssignments) {
      const deliverables = extractDeliverables(assignment.note);
      if (deliverables.length === 0) deliverableSet.add("__GENERAL__");
      else deliverables.forEach((deliverable) => deliverableSet.add(deliverable));
    }

    for (const assignment of projectActualAssignments) {
      const deliverables = extractDeliverables(assignment.note);
      if (deliverables.length === 0) deliverableSet.add("__GENERAL__");
      else deliverables.forEach((deliverable) => deliverableSet.add(deliverable));
    }

    if (deliverableSet.size === 0) deliverableSet.add("__GENERAL__");

    for (const deliverableName of deliverableSet) {
      const name = deliverableName === "__GENERAL__" ? null : deliverableName;
      const planAssignments = projectPlanAssignments.filter((assignment) => {
        const deliverables = extractDeliverables(assignment.note);
        return name === null ? deliverables.length === 0 : deliverables.includes(name);
      });
      const matchingActualAssignments = projectActualAssignments.filter((assignment) => {
        const deliverables = extractDeliverables(assignment.note);
        return name === null ? deliverables.length === 0 : deliverables.includes(name);
      });

      if (!groupsMap.has(deliverableName)) groupsMap.set(deliverableName, []);
      groupsMap.get(deliverableName)!.push({
        id: `${project.id}-${deliverableName}`,
        project,
        planAssignments,
        actualAssignments: matchingActualAssignments,
      });
    }
  }

  return Array.from(groupsMap.keys())
    .sort((a, b) => {
      if (a === "__GENERAL__") return -1;
      if (b === "__GENERAL__") return 1;
      return a.localeCompare(b);
    })
    .map((deliverableName) => ({
      name: deliverableName === "__GENERAL__" ? null : deliverableName,
      projects: groupsMap.get(deliverableName)!,
    }));
}
