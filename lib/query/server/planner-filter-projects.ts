import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { PlannerDirectoryProjectRow } from "@/lib/planner-directory/types";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type PlannerFilterProjectsRequest = {
  offset: number;
  limit: number;
  brandId?: string | null;
  status?: string | null;
  sourceType?: string | null;
  search?: string | null;
  selectedProjectId?: string | null;
};

export type PlannerFilterProjectsResponse = {
  projects: ProjectOption[];
  total: number;
  hasMore: boolean;
  selectedProject: ProjectOption | null;
  scope: {
    brandId: string | null;
    brandName: string | null;
    status: string | null;
    sourceType: string | null;
    search: string | null;
    selectedProjectId: string | null;
  };
  availableStatuses: ProjectOption["status"][];
  availableTypes: ProjectOption["projectType"][];
  freshness: {
    fetchedAt: string;
  };
};

function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }

  return `#${hash.toString(16).padStart(6, "0")}`;
}

function toProjectOption(project: PlannerDirectoryProjectRow): ProjectOption {
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
    brandId: project.brandId,
  };
}

function getBrandName(brandRow: { name: string } | null): string | null {
  return brandRow ? brandRow.name : null;
}

export async function fetchPlannerFilterProjects(
  request: PlannerFilterProjectsRequest
): Promise<PlannerFilterProjectsResponse> {
  const fetchedAt = new Date().toISOString();
  const projectPage = await plannerDirectoryRepository.listProjectsForFilterOptions({
    offset: request.offset,
    limit: request.limit,
    brandId: request.brandId || undefined,
    status: request.status || undefined,
    sourceType: request.sourceType || undefined,
    search: request.search?.trim() || undefined,
  });

  const [selectedProject, selectedBrandRows] = await Promise.all([
    request.selectedProjectId
      ? plannerDirectoryRepository.getProjectForFilterOption(request.selectedProjectId)
      : Promise.resolve<PlannerDirectoryProjectRow | null>(null),
    request.brandId ? plannerDirectoryRepository.listBrandsByIds([request.brandId]) : Promise.resolve([]),
  ]);

  return {
    projects: projectPage.data.map(toProjectOption),
    total: projectPage.total,
    hasMore: projectPage.hasMore,
    selectedProject: selectedProject ? toProjectOption(selectedProject) : null,
    scope: {
      brandId: request.brandId ?? null,
      brandName: getBrandName(selectedBrandRows[0] ?? null),
      status: request.status ?? null,
      sourceType: request.sourceType ?? null,
      search: request.search?.trim() || null,
      selectedProjectId: request.selectedProjectId ?? null,
    },
    availableStatuses: ["planning", "active", "on_hold", "completed", "cancelled"],
    availableTypes: ["campaign", "pitch"],
    freshness: {
      fetchedAt,
    },
  };
}
