import type { SessionData } from "@/lib/auth/session";
import { requestPlannerDirectoryRepair } from "@/lib/planner-directory/repair";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import { classifyPlannerDirectoryFreshness } from "@/lib/planner-directory/freshness";
import type {
  PlannerDirectoryBrandRow,
  PlannerDirectoryDepartmentRow,
  PlannerDirectoryEmployeeRow,
  PlannerDirectoryProjectRow,
} from "@/lib/planner-directory/types";
import { fetchPlannerTimeline } from "@/lib/query/server/planner-prefetch";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type {
  PlannerTimelineRequest,
  PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";

export type MinimalTimelineEmployee = Pick<
  Employee,
  "id" | "fullName" | "position" | "weeklyCapacity" | "department"
>;

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
  departmentsById: Record<string, PlannerDirectoryDepartmentRow>;
  brandsById: Record<string, PlannerDirectoryBrandRow>;
  projectsById: Record<string, PlannerDirectoryProjectRow>;
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
    directoryFetchedAt: string;
    plannerFetchedAt: string;
  };
};

type PlannerTiming = {
  phase: (phase: string, context?: Record<string, unknown>) => void;
};

function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }

  return `#${hash.toString(16).padStart(6, "0")}`;
}

function toMinimalEmployee(
  employee: PlannerDirectoryEmployeeRow,
  departmentsById: Record<string, PlannerDirectoryDepartmentRow>
): MinimalTimelineEmployee {
  const department = employee.departmentId ? departmentsById[employee.departmentId] : undefined;

  return {
    id: employee.employeeUuid,
    fullName: employee.fullName,
    position: employee.position ?? "",
    weeklyCapacity: employee.weeklyCapacity,
    department: department
      ? {
          id: department.departmentId,
          name: department.name,
          color: department.color ?? randomColor(department.departmentId),
        }
      : undefined,
  };
}

function getReferencedProjectIds(
  plannerTimeline: PlannerTimelineResponse,
  request: PlannerHomeBootstrapRequest
): Set<string> {
  const projectIds = new Set<string>();

  for (const assignment of plannerTimeline.assignments) {
    if (assignment.projectId) projectIds.add(assignment.projectId);
  }

  for (const actual of plannerTimeline.actualAssignments) {
    if (actual.projectUuid) projectIds.add(actual.projectUuid);
  }

  if (request.projectId) {
    projectIds.add(request.projectId);
  }

  return projectIds;
}

function indexById<T extends { [key: string]: unknown }>(
  rows: T[],
  getId: (row: T) => string
): Record<string, T> {
  return rows.reduce<Record<string, T>>((acc, row) => {
    acc[getId(row)] = row;
    return acc;
  }, {});
}

function getDepartmentIdsFromEmployees(employees: PlannerDirectoryEmployeeRow[]): string[] {
  return Array.from(
    new Set(
      employees
        .map((employee) => employee.departmentId)
        .filter((departmentId): departmentId is string => !!departmentId)
    )
  );
}

function getBrandIdsFromProjects(projects: PlannerDirectoryProjectRow[]): string[] {
  return Array.from(
    new Set(projects.map((project) => project.brandId).filter((brandId): brandId is string => !!brandId))
  );
}

function getMissingIds<T extends { [key: string]: unknown }>(
  referencedIds: Set<string>,
  rowsById: Record<string, T>
): string[] {
  return Array.from(referencedIds).filter((id) => !rowsById[id]);
}

export async function fetchPlannerHomeBootstrap(
  session: SessionData,
  request: PlannerHomeBootstrapRequest,
  options: { timing?: PlannerTiming } = {}
): Promise<PlannerHomeBootstrapResponse> {
  const directoryFetchedAt = new Date().toISOString();

  const [latestSuccessfulSync, latestInFlightSync, employeeSliceResult, departments] = await Promise.all([
    plannerDirectoryRepository.getLatestSuccessfulSync(),
    plannerDirectoryRepository.getLatestInFlightSync(),
    plannerDirectoryRepository.listEmployeesForBootstrap({
      offset: session.access.can_view_all ? request.employeeOffset : 0,
      limit: session.access.can_view_all ? request.employeeLimit : 1,
      search: session.access.can_view_all ? request.search?.trim() || undefined : undefined,
      employeeUuid: session.access.can_view_all ? undefined : session.employee.uuid,
    }),
    plannerDirectoryRepository.listDepartments(),
  ]);
  const employeeUuids = employeeSliceResult.data.map((employee) => employee.employeeUuid);
  const shouldScopeTimelineToBootstrapEmployees =
    session.access.can_view_all &&
    !request.brandId &&
    !request.department &&
    !request.projectId &&
    !request.search?.trim();
  const timelineRequest: PlannerTimelineRequest = {
    ...request,
    employeeUuids: shouldScopeTimelineToBootstrapEmployees ? employeeUuids : undefined,
  };
  const plannerTimeline = await fetchPlannerTimeline(session, timelineRequest, {
    timing: options.timing,
  });

  const metadataFreshness = classifyPlannerDirectoryFreshness({
    lastSuccessfulSyncAt: latestSuccessfulSync?.finishedAt ?? latestSuccessfulSync?.startedAt ?? null,
    latestSyncAt: latestInFlightSync?.startedAt ?? latestSuccessfulSync?.startedAt ?? null,
    isSyncing: !!latestInFlightSync,
    syncMode: latestInFlightSync?.syncMode ?? null,
    issueCount: latestSuccessfulSync?.issueCount ?? 0,
    now: directoryFetchedAt,
  });

  const departmentsById = indexById(departments, (department) => department.departmentId);

  const referencedProjectIds = getReferencedProjectIds(plannerTimeline, request);
  const projects = await plannerDirectoryRepository.listProjectsForBootstrap({
    brandId: request.brandId || undefined,
    search: request.search?.trim() || undefined,
    referencedProjectIds: Array.from(referencedProjectIds),
  });
  const projectsById = indexById(projects, (project) => project.sourceProjectId);
  const missingReferencedProjectIds = getMissingIds(referencedProjectIds, projectsById);

  const brandIds = getBrandIdsFromProjects(projects);
  const brands = await plannerDirectoryRepository.listBrandsByIds(brandIds);
  const brandsById = indexById(brands, (brand) => brand.brandId);
  const missingReferencedBrandIds = getMissingIds(new Set(brandIds), brandsById);

  const missingDepartmentIds = getMissingIds(
    new Set(getDepartmentIdsFromEmployees(employeeSliceResult.data)),
    departmentsById
  );

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

  if (missingReferencedBrandIds.length > 0) {
    void Promise.all(
      missingReferencedBrandIds.slice(0, 3).map((brandId) =>
        requestPlannerDirectoryRepair({
          session,
          entityType: "brand",
          sourceId: brandId,
          triggerSource: "bootstrap",
          triggeredBy: session.employee.uuid,
        }).catch((error) => {
          console.error("[Planner bootstrap] Failed to request brand repair:", error);
        })
      )
    );
  }

  if (missingDepartmentIds.length > 0) {
    void Promise.all(
      missingDepartmentIds.slice(0, 3).map((departmentId) =>
        requestPlannerDirectoryRepair({
          session,
          entityType: "department",
          sourceId: departmentId,
          triggerSource: "bootstrap",
          triggeredBy: session.employee.uuid,
        }).catch((error) => {
          console.error("[Planner bootstrap] Failed to request department repair:", error);
        })
      )
    );
  }

  const metadataPartial =
    missingReferencedProjectIds.length > 0 ||
    missingReferencedBrandIds.length > 0 ||
    missingDepartmentIds.length > 0;

  return {
    request,
    employees: employeeSliceResult.data.map((employee) => toMinimalEmployee(employee, departmentsById)),
    employeeTotal: employeeSliceResult.total,
    employeeHasMore: employeeSliceResult.hasMore,
    departmentsById,
    brandsById,
    projectsById,
    plannerTimeline,
    metadataPartial,
    metadataFreshness,
    freshness: {
      directoryFetchedAt,
      plannerFetchedAt: directoryFetchedAt,
    },
  };
}
