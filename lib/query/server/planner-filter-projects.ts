import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { PlannerDirectoryProjectRow } from "@/lib/planner-directory/types";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type PlannerFilterProjectsRequest = Record<string, never>;

export type PlannerFilterProjectsResponse = {
  projects: ProjectOption[];
  total: number;
  hasMore: boolean;
  scope: {
    brandId: null;
    brandName: null;
    status: null;
    sourceType: null;
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
    brandName: project.brandName ?? null,
    brandCompanyName: project.brandCompanyName ?? null,
  };
}

export async function fetchPlannerFilterProjects(): Promise<PlannerFilterProjectsResponse> {
  const fetchedAt = new Date().toISOString();
  const projects = await plannerDirectoryRepository.listProjectsForFilterOptions();

  return {
    projects: projects.map(toProjectOption),
    total: projects.length,
    hasMore: false,
    scope: {
      brandId: null,
      brandName: null,
      status: null,
      sourceType: null,
    },
    availableStatuses: ["planning", "active", "on_hold", "completed", "cancelled"],
    availableTypes: ["campaign", "pitch"],
    freshness: {
      fetchedAt,
    },
  };
}
