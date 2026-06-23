import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { PlannerDirectoryProjectRow } from "@/lib/planner-directory/types";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type PlannerFilterProjectsRequest = {
  brandIds?: string[] | null;
  status?: ProjectOption["status"] | null;
  sourceType?: ProjectOption["projectType"] | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};

export type PlannerFilterProjectsResponse = {
  projects: ProjectOption[];
  total: number;
  hasMore: boolean;
};

function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }

  return `#${hash.toString(16).padStart(6, "0")}`;
}

export function toProjectOption(project: PlannerDirectoryProjectRow): ProjectOption {
  return {
    id: project.sourceProjectId,
    name: project.name,
    color: project.color ?? randomColor(project.sourceProjectId),
    status:
      project.status === "completed" ||
      project.status === "cancelled" ||
      project.status === "active" ||
      project.status === "planning" ||
      project.status === "on_hold"
        ? project.status
        : "planning",
    projectType: project.sourceType,
    startDate: project.startDate,
    endDate: project.endDate,
    brandId: project.brandId,
    brandName: project.brandName ?? null,
    brandCompanyName: project.brandCompanyName ?? null,
  };
}

export async function fetchPlannerFilterProjects(
  request: PlannerFilterProjectsRequest = {}
): Promise<PlannerFilterProjectsResponse> {
  const limit = request.limit ?? 50;
  const offset = request.offset ?? 0;
  const { data, total, hasMore } = await plannerDirectoryRepository.listProjectsForFilterOptions({
    brandIds: request.brandIds ?? null,
    status: request.status ?? null,
    sourceType: request.sourceType ?? null,
    search: request.search ?? null,
    limit,
    offset,
  });

  return {
    projects: data.map(toProjectOption),
    total,
    hasMore,
  };
}
