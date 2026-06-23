import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  isProjectHighlighted,
  sortResourceProjects,
} from "@/lib/timeline-v2/resource-project-model";

export type OrderedProjectLane<L> = L & { isHighlighted: boolean };

export function orderProjectLanes<
  L extends { project: ProjectOption; planAssignments: Assignment[] }
>({
  lanes,
  resourceAssignments,
  brandIds,
  projectIds,
  days,
}: {
  lanes: L[];
  resourceAssignments: Assignment[];
  brandIds: string[];
  projectIds: string[];
  days: Date[];
}): OrderedProjectLane<L>[] {
  const sortedProjects = sortResourceProjects({
    projects: lanes.map((lane) => lane.project),
    resourceAssignments,
    brandIds,
    selectedProjectIds: projectIds,
    days,
  });

  // First occurrence wins so lanes sharing a project keep insertion order.
  const orderByProjectId = new Map<string, number>();
  sortedProjects.forEach((project, index) => {
    if (!orderByProjectId.has(project.id)) orderByProjectId.set(project.id, index);
  });

  const highlightFilters = {
    selectedBrandIds: brandIds,
    selectedProjectIds: projectIds,
  };

  // Stable sort keeps insertion order for ties and for lanes missing from
  // the sorted output (defensive; normally every lane project is present).
  return [...lanes]
    .sort(
      (a, b) =>
        (orderByProjectId.get(a.project.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderByProjectId.get(b.project.id) ?? Number.MAX_SAFE_INTEGER)
    )
    .map((lane) => ({
      ...lane,
      isHighlighted: isProjectHighlighted(lane.project, highlightFilters),
    }));
}
