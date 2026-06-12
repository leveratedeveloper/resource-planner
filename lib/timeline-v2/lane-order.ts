import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  isProjectHighlighted,
  sortResourceProjects,
} from "@/lib/timeline/resource-project-model";

export type OrderedProjectLane<L> = L & { isHighlighted: boolean };

export function orderProjectLanes<
  L extends { project: ProjectOption; planAssignments: Assignment[] }
>({
  lanes,
  resourceAssignments,
  brandId,
  projectId,
  days,
}: {
  lanes: L[];
  resourceAssignments: Assignment[];
  brandId: string | null;
  projectId: string | null;
  days: Date[];
}): OrderedProjectLane<L>[] {
  const sortedProjects = sortResourceProjects({
    projects: lanes.map((lane) => lane.project),
    resourceAssignments,
    brandId,
    selectedProjectId: projectId,
    days,
  });

  // First occurrence wins so lanes sharing a project keep insertion order.
  const orderByProjectId = new Map<string, number>();
  sortedProjects.forEach((project, index) => {
    if (!orderByProjectId.has(project.id)) orderByProjectId.set(project.id, index);
  });

  const highlightFilters = {
    selectedBrandId: brandId,
    selectedProjectId: projectId,
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
