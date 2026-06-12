import { isWithinInterval, startOfDay } from "date-fns";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
// Inlined from the retired lib/timeline/resource-row-model.
function extractDeliverables(note: string | null): string[] {
  if (!note) return [];
  const match = note.match(/Deliverable[s]?:\s*([^.\n]+)/);
  if (!match) return [];
  return match[1].split(",").map((value) => value.trim()).filter(Boolean);
}

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

export type ProjectHighlightFilters = {
  selectedProjectId: string | null;
  selectedBrandId: string | null;
};

export function getResourceProjects(
  resourceAssignments: Assignment[],
  actualAssignments: ActualAssignment[],
  projects: ProjectOption[]
): ProjectOption[] {
  const projectIds = new Set<string>();

  for (const assignment of resourceAssignments) {
    if (!assignment.isTimeOff && assignment.projectId) {
      projectIds.add(assignment.projectId);
    }
  }

  for (const assignment of actualAssignments) {
    if (!assignment.isTimeOff && assignment.projectUuid) {
      projectIds.add(assignment.projectUuid);
    }
  }

  return projects.filter((project) => projectIds.has(project.id));
}

export function isProjectHighlighted(
  project: ProjectOption,
  filters: ProjectHighlightFilters
): boolean {
  if (filters.selectedProjectId && project.id === filters.selectedProjectId) {
    return true;
  }

  if (filters.selectedBrandId && project.brandId === filters.selectedBrandId) {
    return true;
  }

  return false;
}

export function isDeliverableGroupHighlighted(
  group: DeliverableGroup,
  filters: ProjectHighlightFilters
): boolean {
  return group.projects.some((row) => isProjectHighlighted(row.project, filters));
}

export function sortResourceProjects({
  projects,
  resourceAssignments,
  brandId,
  selectedProjectId,
  days,
}: {
  projects: ProjectOption[];
  resourceAssignments: Assignment[];
  brandId: string | null;
  selectedProjectId?: string | null;
  days: Date[];
}): ProjectOption[] {
  const timelineStart = days[0] ? startOfDay(days[0]) : null;
  const timelineEnd = days[days.length - 1] ? startOfDay(days[days.length - 1]) : null;

  return [...projects].sort((a, b) => {
    if (selectedProjectId) {
      const aProjectMatch = a.id === selectedProjectId;
      const bProjectMatch = b.id === selectedProjectId;
      if (aProjectMatch !== bProjectMatch) return aProjectMatch ? -1 : 1;
    }

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
