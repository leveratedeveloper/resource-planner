import type {
  MinimalTimelineEmployee,
  PlannerHomeBootstrapResponse,
} from "@/lib/query/server/planner-home-bootstrap";

type TimelineAssignments = PlannerHomeBootstrapResponse["plannerTimeline"]["assignments"];
type TimelineActualAssignments = PlannerHomeBootstrapResponse["plannerTimeline"]["actualAssignments"];

export type MergedBootstrapPages = {
  employees: MinimalTimelineEmployee[];
  assignments: TimelineAssignments;
  actualAssignments: TimelineActualAssignments;
  departmentsById: PlannerHomeBootstrapResponse["departmentsById"];
  brandsById: PlannerHomeBootstrapResponse["brandsById"];
  projectsById: PlannerHomeBootstrapResponse["projectsById"];
  employeeTotal: number;
  employeeHasMore: boolean;
  metadataFreshness: PlannerHomeBootstrapResponse["metadataFreshness"] | null;
};

function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergeRecords<T>(pages: PlannerHomeBootstrapResponse[], pick: (page: PlannerHomeBootstrapResponse) => Record<string, T>): Record<string, T> {
  const merged: Record<string, T> = {};
  for (const page of pages) {
    Object.assign(merged, pick(page));
  }
  return merged;
}

// Date/view navigation mints a NEW query key (dates are part of the request)
// while the filter identity stays the same — without intervention the list
// collapses to page 0, the browser clamps the scroll position, and rows only
// refill when the user scrolls near the end. These helpers let the hook
// remember how deep each filter identity was loaded and refill to that depth.
export function getBootstrapFilterIdentity(request: {
  brandId?: string | null;
  department?: string | null;
  projectId?: string | null;
  search?: string | null;
}): string {
  return [
    request.brandId ?? "",
    request.department ?? "",
    request.projectId ?? "",
    request.search ?? "",
  ].join("|");
}

export type DepthRefillDecision = "remember" | "fetch-next" | "none";

export function resolveDepthRefill(input: {
  pageCount: number;
  rememberedDepth: number;
  isPlaceholderData: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  hasFetchFailure: boolean;
}): DepthRefillDecision {
  // Placeholder pages belong to the PREVIOUS key — neither remember nor
  // refill from them, or stale depth leaks across filter changes.
  if (input.isPlaceholderData || input.pageCount === 0) return "none";
  if (input.pageCount >= input.rememberedDepth) return "remember";
  // A failed page fetch must pause auto-refill, or the effect retries forever
  // against a failing endpoint. The flag is derived state — a successful
  // scroll-triggered fetch or a key change clears it and refill resumes.
  if (input.hasFetchFailure) return "none";
  if (input.hasNextPage && !input.isFetchingNextPage) return "fetch-next";
  return "none";
}

// Offset pages can overlap when the directory shifts between fetches, and
// optimistic creates are appended to every cached page — dedupe by id so an
// entity renders exactly once no matter how many pages carry it. First page
// wins on order; the last page carries the freshest totals and sync state.
export function mergeBootstrapPages(pages: PlannerHomeBootstrapResponse[]): MergedBootstrapPages {
  const lastPage = pages.length > 0 ? pages[pages.length - 1] : null;

  return {
    employees: dedupeBy(
      pages.flatMap((page) => page.employees),
      (employee) => employee.id
    ),
    assignments: dedupeBy(
      pages.flatMap((page) => page.plannerTimeline.assignments),
      (assignment) => assignment.id
    ),
    actualAssignments: dedupeBy(
      pages.flatMap((page) => page.plannerTimeline.actualAssignments),
      (actual) => actual.uuid
    ),
    departmentsById: mergeRecords(pages, (page) => page.departmentsById),
    brandsById: mergeRecords(pages, (page) => page.brandsById),
    projectsById: mergeRecords(pages, (page) => page.projectsById),
    employeeTotal: lastPage?.employeeTotal ?? 0,
    employeeHasMore: lastPage?.employeeHasMore ?? false,
    metadataFreshness: lastPage?.metadataFreshness ?? null,
  };
}
