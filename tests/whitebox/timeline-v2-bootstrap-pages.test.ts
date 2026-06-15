import { describe, expect, it } from "vitest";
import {
  getBootstrapFilterIdentity,
  mergeBootstrapPages,
  resolveDepthRefill,
} from "@/lib/timeline-v2/bootstrap-pages";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";

// Employee-scoped bootstrap pages each carry their own assignments; the
// timeline renders the union of loaded pages. The merge must dedupe by id
// (overlapping offsets, optimistic creates patched onto every page) and take
// pagination/sync state from the freshest page.

function makePage(overrides: Partial<PlannerHomeBootstrapResponse>): PlannerHomeBootstrapResponse {
  return {
    request: {} as PlannerHomeBootstrapResponse["request"],
    employees: [],
    employeeTotal: 0,
    employeeHasMore: false,
    departmentsById: {},
    brandsById: {},
    projectsById: {},
    plannerTimeline: {
      request: {} as PlannerHomeBootstrapResponse["plannerTimeline"]["request"],
      assignments: [],
      actualAssignments: [],
    },
    metadataPartial: false,
    metadataFreshness: {
      state: "healthy",
      lastSuccessfulSyncAt: null,
      latestSyncAt: null,
      stale: false,
      issueCount: 0,
    },
    freshness: {
      directoryFetchedAt: "2026-06-12T00:00:00.000Z",
      plannerFetchedAt: "2026-06-12T00:00:00.000Z",
    },
    ...overrides,
  } as PlannerHomeBootstrapResponse;
}

const employee = (id: string) =>
  ({ id, fullName: id, position: "", weeklyCapacity: 40 }) as PlannerHomeBootstrapResponse["employees"][number];
const assignment = (id: string) =>
  ({ id, employeeUuid: "e" }) as unknown as PlannerHomeBootstrapResponse["plannerTimeline"]["assignments"][number];
const actual = (uuid: string) =>
  ({ uuid }) as unknown as PlannerHomeBootstrapResponse["plannerTimeline"]["actualAssignments"][number];

describe("mergeBootstrapPages", () => {
  it("returns an empty union for no pages", () => {
    const merged = mergeBootstrapPages([]);

    expect(merged.employees).toEqual([]);
    expect(merged.assignments).toEqual([]);
    expect(merged.actualAssignments).toEqual([]);
    expect(merged.employeeHasMore).toBe(false);
    expect(merged.metadataFreshness).toBeNull();
  });

  it("unions employees and assignments across pages in page order", () => {
    const merged = mergeBootstrapPages([
      makePage({
        employees: [employee("e1")],
        plannerTimeline: { request: {} as never, assignments: [assignment("a1")], actualAssignments: [actual("x1")] },
        employeeTotal: 3,
        employeeHasMore: true,
      }),
      makePage({
        employees: [employee("e2"), employee("e3")],
        plannerTimeline: { request: {} as never, assignments: [assignment("a2")], actualAssignments: [actual("x2")] },
        employeeTotal: 3,
        employeeHasMore: false,
      }),
    ]);

    expect(merged.employees.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(merged.assignments.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(merged.actualAssignments.map((a) => a.uuid)).toEqual(["x1", "x2"]);
    expect(merged.employeeTotal).toBe(3);
    expect(merged.employeeHasMore).toBe(false);
  });

  it("dedupes employees and assignments carried by more than one page", () => {
    const merged = mergeBootstrapPages([
      makePage({
        employees: [employee("e1"), employee("e2")],
        plannerTimeline: {
          request: {} as never,
          assignments: [assignment("a1"), assignment("optimistic-1")],
          actualAssignments: [actual("x1")],
        },
      }),
      makePage({
        employees: [employee("e2"), employee("e3")],
        plannerTimeline: {
          request: {} as never,
          assignments: [assignment("a1"), assignment("optimistic-1"), assignment("a2")],
          actualAssignments: [actual("x1"), actual("x2")],
        },
      }),
    ]);

    expect(merged.employees.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(merged.assignments.map((a) => a.id)).toEqual(["a1", "optimistic-1", "a2"]);
    expect(merged.actualAssignments.map((a) => a.uuid)).toEqual(["x1", "x2"]);
  });

  it("merges reference maps with later pages winning and reports the last page's sync state", () => {
    const merged = mergeBootstrapPages([
      makePage({
        projectsById: { p1: { name: "old" } as never, p2: { name: "keep" } as never },
        brandsById: { b1: { name: "brand-1" } as never },
        metadataFreshness: {
          state: "healthy",
          lastSuccessfulSyncAt: null,
          latestSyncAt: null,
          stale: false,
          issueCount: 0,
        },
      }),
      makePage({
        projectsById: { p1: { name: "new" } as never },
        brandsById: { b2: { name: "brand-2" } as never },
        metadataFreshness: {
          state: "stale",
          lastSuccessfulSyncAt: null,
          latestSyncAt: null,
          stale: true,
          issueCount: 2,
        },
      }),
    ]);

    expect(merged.projectsById).toEqual({ p1: { name: "new" }, p2: { name: "keep" } });
    expect(merged.brandsById).toEqual({ b1: { name: "brand-1" }, b2: { name: "brand-2" } });
    expect(merged.metadataFreshness?.state).toBe("stale");
  });
});

// Depth refill exists so date/view navigation (new query key, same filters)
// restores the user's loaded page depth instead of collapsing to page 0 and
// clamping their scroll position.
describe("bootstrap page depth refill", () => {
  it("keeps the same identity across date/view changes and changes it per filter", () => {
    const base = { brandId: null, department: "dept-1", projectId: null, search: null };

    // dates/viewMode are not part of the identity — same filters, same key
    expect(getBootstrapFilterIdentity(base)).toBe(getBootstrapFilterIdentity({ ...base }));
    expect(getBootstrapFilterIdentity(base)).not.toBe(
      getBootstrapFilterIdentity({ ...base, department: "dept-2" })
    );
    expect(getBootstrapFilterIdentity(base)).not.toBe(
      getBootstrapFilterIdentity({ ...base, search: "ana" })
    );
  });

  it("never remembers or refills from placeholder pages of the previous key", () => {
    expect(
      resolveDepthRefill({
        pageCount: 3,
        rememberedDepth: 0,
        isPlaceholderData: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("none");
  });

  it("remembers depth when at or beyond the remembered depth", () => {
    expect(
      resolveDepthRefill({
        pageCount: 3,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: true,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("remember");
    expect(
      resolveDepthRefill({
        pageCount: 4,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("remember");
  });

  it("refills toward the remembered depth one page at a time", () => {
    expect(
      resolveDepthRefill({
        pageCount: 1,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: true,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("fetch-next");
    // already fetching — let the in-flight page land first
    expect(
      resolveDepthRefill({
        pageCount: 1,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: true,
        isFetchingNextPage: true,
        hasFetchFailure: false,
      })
    ).toBe("none");
  });

  it("stops when the server runs out of pages before the remembered depth", () => {
    expect(
      resolveDepthRefill({
        pageCount: 2,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("none");
  });

  it("pauses auto-refill after a failed page fetch instead of retrying forever", () => {
    expect(
      resolveDepthRefill({
        pageCount: 1,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: true,
        isFetchingNextPage: false,
        hasFetchFailure: true,
      })
    ).toBe("none");
    // the flag is derived state — once a later fetch succeeds it clears,
    // and the same inputs resume refilling
    expect(
      resolveDepthRefill({
        pageCount: 1,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: true,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("fetch-next");
  });

  it("does nothing before the first page arrives", () => {
    expect(
      resolveDepthRefill({
        pageCount: 0,
        rememberedDepth: 3,
        isPlaceholderData: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        hasFetchFailure: false,
      })
    ).toBe("none");
  });
});
