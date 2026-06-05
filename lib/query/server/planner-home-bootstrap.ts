import type { SessionData } from "@/lib/auth/session";
import { fetchOrderedEmployeeSlice } from "@/lib/employees/ordered-directory";
import { fetchProjectSummaries } from "@/lib/projects/project-summary-fetcher";
import { requestPlannerDirectoryRepair } from "@/lib/planner-directory/repair";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import { classifyPlannerDirectoryFreshness } from "@/lib/planner-directory/freshness";
import { fetchPlannerTimeline } from "@/lib/query/server/planner-prefetch";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type {
  PlannerTimelineRequest,
  PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";

export type MinimalTimelineEmployee = Pick<
  Employee,
  "id" | "fullName" | "position" | "weeklyCapacity" | "department"
>;

export type MinimalTimelineProject = Pick<
  ProjectOption,
  "id" | "name" | "color" | "status" | "projectType" | "brandId"
>;

export type MinimalTimelineBrand = Pick<Brand, "id" | "name" | "color" | "status">;

export type PlannerHomeBootstrapRequest = PlannerTimelineRequest & {
  employeeLimit: number;
  employeeOffset: number;
  brandId?: string | null;
  department?: string | null;
  projectId?: string | null;
  search?: string | null;
};

export type PlannerHomeBootstrapResponse = {
  request: PlannerHomeBootstrapRequest;
  employees: MinimalTimelineEmployee[];
  employeeTotal: number;
  employeeHasMore: boolean;
  brandsById: Record<string, MinimalTimelineBrand>;
  projectsById: Record<string, MinimalTimelineProject>;
  plannerTimeline: PlannerTimelineResponse;
  metadataPartial: boolean;
  metadataFreshness: {
    state: "healthy" | "stale" | "syncing" | "unavailable";
    lastSuccessfulSyncAt: string | null;
    latestSyncAt: string | null;
    stale: boolean;
    issueCount: number;
  };
  freshness: {
    timeTrackFetchedAt: string;
    plannerFetchedAt: string;
  };
};

function toMinimalEmployee(employee: Employee): MinimalTimelineEmployee {
  return {
    id: employee.id,
    fullName: employee.fullName,
    position: employee.position,
    weeklyCapacity: employee.weeklyCapacity,
    department: employee.department,
  };
}

function toMinimalProject(project: ProjectOption): MinimalTimelineProject {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    status: project.status,
    projectType: project.projectType,
    brandId: project.brandId,
  };
}

function toPartialBrandFromProject(project: MinimalTimelineProject): MinimalTimelineBrand | null {
  if (!project.brandId) return null;

  return {
    id: project.brandId,
    name: `Brand ${project.brandId}`,
    color: "#64748b",
    status: "active",
  };
}

function getReferencedProjectIds(plannerTimeline: PlannerTimelineResponse): Set<string> {
  const projectIds = new Set<string>();

  for (const assignment of plannerTimeline.assignments) {
    if (assignment.projectId) projectIds.add(assignment.projectId);
  }

  for (const actual of plannerTimeline.actualAssignments) {
    if (actual.projectUuid) projectIds.add(actual.projectUuid);
  }

  return projectIds;
}

export async function fetchPlannerHomeBootstrap(
  session: SessionData,
  request: PlannerHomeBootstrapRequest
): Promise<PlannerHomeBootstrapResponse> {
  const fetchedAt = new Date().toISOString();
  const [latestSuccessfulSync, latestInFlightSync] = await Promise.all([
    plannerDirectoryRepository.getLatestSuccessfulSync(),
    plannerDirectoryRepository.getLatestInFlightSync(),
  ]);
  const metadataFreshness = classifyPlannerDirectoryFreshness({
    lastSuccessfulSyncAt: latestSuccessfulSync?.finishedAt ?? latestSuccessfulSync?.startedAt ?? null,
    latestSyncAt: latestInFlightSync?.startedAt ?? latestSuccessfulSync?.startedAt ?? null,
    isSyncing: !!latestInFlightSync,
    issueCount: latestSuccessfulSync?.issueCount ?? 0,
    now: fetchedAt,
  });

  const [employeeSlice, plannerTimeline, projectSummaryResult] = await Promise.all([
    fetchOrderedEmployeeSlice(session, {
      offset: request.employeeOffset,
      limit: request.employeeLimit,
      search: request.search?.trim() || undefined,
    }),
    fetchPlannerTimeline(session, request),
    fetchProjectSummaries({
      brandId: request.brandId || undefined,
      search: undefined,
      pageSize: 100,
      maxPagesPerSource: 3,
    }),
  ]);

  const referencedProjectIds = getReferencedProjectIds(plannerTimeline);
  const projectsById: Record<string, MinimalTimelineProject> = {};

  for (const project of projectSummaryResult.data) {
    if (
      referencedProjectIds.size === 0 ||
      referencedProjectIds.has(project.id) ||
      project.id === request.projectId
    ) {
      projectsById[project.id] = toMinimalProject(project);
    }
  }

  const missingReferencedProjectCount = Array.from(referencedProjectIds).filter(
    (projectId) => !projectsById[projectId]
  ).length;
  const missingReferencedProjectIds = Array.from(referencedProjectIds).filter(
    (projectId) => !projectsById[projectId]
  );
  const brandsById: Record<string, MinimalTimelineBrand> = {};

  for (const project of Object.values(projectsById)) {
    const brand = toPartialBrandFromProject(project);
    if (brand) brandsById[brand.id] = brand;
  }

  if (missingReferencedProjectIds.length > 0) {
    void Promise.all(
      missingReferencedProjectIds.slice(0, 3).map((projectId) =>
        requestPlannerDirectoryRepair({
          session,
          entityType: "project",
          sourceId: projectId,
          triggerSource: "bootstrap",
          triggeredBy: session.employee.uuid,
        }).catch((error) => {
          console.error("[Planner bootstrap] Failed to request project repair:", error);
        })
      )
    );
  }

  return {
    request,
    employees: employeeSlice.data.map(toMinimalEmployee),
    employeeTotal: employeeSlice.total,
    employeeHasMore: employeeSlice.hasMore,
    brandsById,
    projectsById,
    plannerTimeline,
    metadataPartial: projectSummaryResult.truncated || missingReferencedProjectCount > 0,
    metadataFreshness,
    freshness: {
      timeTrackFetchedAt: fetchedAt,
      plannerFetchedAt: fetchedAt,
    },
  };
}
