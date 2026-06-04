# Home Page Backend Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Resource Planner home page initial loading time by making the V2 timeline backend lighter, more purpose-built, and easier to measure without replacing the split TimeTrack plus Resource Planner data architecture.

**Architecture:** Keep TimeTrack as the source of truth for employees, brands, and projects, and keep the Resource Planner database as the source of truth for planned allocations and actual/planning overlays. Salvage the current backend by adding measured planner-specific data access, a compact home bootstrap endpoint, and a thinner client loading contract. Avoid stored procedures as the first move; push filtering/projection and monthly aggregation closer to SQL first, then consider a database function only if measured query plans prove Node summarization remains the bottleneck.

**Tech Stack:** Next.js App Router route handlers, TypeScript, TanStack Query, PostgreSQL via `pg`, MySQL via `mysql2/promise`, TimeTrack REST API client, Vitest whitebox tests.

---

## Current Structure

Home page data currently flows through separate client queries:

- `components/timeline-v2/TimelineV2.tsx`
  - Owns V2 UI state, layout state, row expansion, virtualization, and row model construction.
  - Calls `useEmployees`, `useInfiniteEmployees`, `useBrands`, `useProjectOptions`, `useProjectsByBrand`, and `usePlannerTimeline`.
- `lib/query/hooks/usePlannerTimeline.ts`
  - Browser fetches `/api/planner/timeline`.
  - Keeps previous planner data during request changes.
- `app/api/planner/timeline/route.ts`
  - Checks session.
  - Validates `viewMode`, `startDate`, and `endDate`.
  - Calls `fetchPlannerTimeline`.
- `lib/query/server/planner-prefetch.ts`
  - Fetches planned assignments from `assignments`.
  - Fetches actual assignments from `actual`.
  - Filters `category` and `status` in Node.
  - Summarizes month-resolution data in Node.
- `lib/mysql-assignments/queries.ts`
  - Uses generic `SELECT *` queries for planner data.
- `lib/mysql-assignments/db.ts`
  - Uses a MySQL pool locally.
  - Creates and closes a new PostgreSQL client per query in production.
- TimeTrack lookup routes
  - `/api/employees` returns employee slices from TimeTrack.
  - `/api/brands` returns brands from TimeTrack.
  - `/api/projects/summary` returns campaign and pitch summaries from TimeTrack.

The split source is valid. The performance problem is the current loading contract: first paint depends on multiple browser-originated API calls, broad assignment rows, generic project/employee lookups, and client-side joining.

## Backend Problems To Address

- `usePlannerTimeline` fetches useful planner data only after client mount.
- `/api/planner/timeline` returns planner rows only, so the home page still needs separate employee, brand, and project calls before rows are meaningful.
- Planner queries use `SELECT *`, returning more columns than V2 needs.
- Planner `category` and `status` filters are applied in Node rather than SQL.
- PostgreSQL mode creates one database connection per query.
- Month-resolution summarization happens in Node after raw rows are loaded.
- Project summary fetching can walk many TimeTrack pages for first-load metadata.
- `prefetchCriticalPlannerStartup` is tested but not wired into the rendered home page.
- Dead-code and cleanup candidates:
  - `lib/mysql-assignments/db.ts` imports `PostgreSQLPool` but does not use it.
  - `validateAssignmentData` in `lib/mysql-assignments/queries.ts` is not called.
  - `openMonthlyAllocationConfirm` in `components/timeline-v2/useTimelineV2Controller.ts` returns a no-op state update and is not used by `TimelineV2`.
  - `prefetchCriticalPlannerStartup` is unused in page rendering; either wire it through a real hydration path or remove it after the bootstrap endpoint replaces it.
  - Debug `console.log` statements in backend startup routes inflate logs and can leak sensitive operational detail. Remove the high-volume logs from home-page-related paths first: `app/api/brands/route.ts`, `lib/mysql-assignments/queries.ts`, and client query hooks used on the home page.

## Target Backend Shape

Add a purpose-built home bootstrap endpoint:

`GET /api/planner/home-bootstrap?viewMode=quarter&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&employeeLimit=24&employeeOffset=0&brandId=&department=&projectId=&search=`

Return only the data needed to render the first home timeline state:

```ts
type PlannerHomeBootstrapResponse = {
  request: PlannerHomeBootstrapRequest;
  employees: MinimalTimelineEmployee[];
  employeeTotal: number;
  employeeHasMore: boolean;
  brandsById: Record<string, MinimalTimelineBrand>;
  projectsById: Record<string, MinimalTimelineProject>;
  assignments: MinimalTimelineAssignment[];
  actualAssignments: MinimalTimelineActualAssignment[];
  freshness: {
    timeTrackFetchedAt: string;
    plannerFetchedAt: string;
  };
};
```

This endpoint should fetch the first employee slice from TimeTrack, fetch planner rows from the Resource Planner database for the visible date range, derive the referenced `projectIds` and `brandIds`, and fetch only the needed project/brand metadata where possible. If TimeTrack does not support batch lookup by IDs yet, keep a short TTL cache and bounded page scan, then expose `metadataPartial: true` in the response for non-blocking enrichment.

## Task 1: Add Measurable Backend Timing And Payload Metrics

**Files:**
- Modify: `app/api/planner/timeline/route.ts`
- Modify: `lib/query/server/planner-prefetch.ts`
- Create: `tests/whitebox/planner-backend-observability.test.ts`

- [x] **Step 1: Write the failing observability test**

Create `tests/whitebox/planner-backend-observability.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner backend observability", () => {
  it("logs planner fetch phases and response payload size", () => {
    const routeSource = readFileSync("app/api/planner/timeline/route.ts", "utf8");
    const prefetchSource = readFileSync("lib/query/server/planner-prefetch.ts", "utf8");

    expect(routeSource).toContain('createRequestTiming("planner_timeline_api")');
    expect(routeSource).toContain('timing.phase("response_payload"');
    expect(routeSource).toContain("Buffer.byteLength");
    expect(prefetchSource).toContain('timing.phase("planned_assignments_query"');
    expect(prefetchSource).toContain('timing.phase("actual_assignments_query"');
    expect(prefetchSource).toContain('timing.phase("monthly_summary"');
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-backend-observability.test.ts`

Expected: FAIL because the planner backend does not yet log query phases and response byte size.

- [x] **Step 3: Add timing to `fetchPlannerTimeline`**

Change `lib/query/server/planner-prefetch.ts` so `fetchPlannerTimeline` accepts optional timing and logs each major phase:

```ts
type PlannerTiming = {
  phase: (phase: string, context?: Record<string, unknown>) => void;
};

export async function fetchPlannerTimeline(
  session: SessionData,
  request: PlannerTimelineRequest,
  options: { timing?: PlannerTiming } = {}
): Promise<PlannerTimelineResponse> {
  const dateRange = {
    startDate: request.startDate,
    endDate: request.endDate,
  };

  const plannedPromise = fetchPlannerAssignments(session, dateRange).then((assignments) => {
    options.timing?.phase("planned_assignments_query", { count: assignments.length });
    return assignments;
  });

  const actualPromise = fetchPlannerActualAssignments(session, dateRange).then((actualAssignments) => {
    options.timing?.phase("actual_assignments_query", { count: actualAssignments.length });
    return actualAssignments;
  });

  const [assignments, actualAssignments] = await Promise.all([plannedPromise, actualPromise]);
  const filteredAssignments = filterPlannerAssignments(assignments, request);
  const filteredActualAssignments = filterPlannerActualAssignments(actualAssignments, request);

  if (request.resolution === "month") {
    const summarizedAssignments = summarizeMonthlyAssignments(filteredAssignments, dateRange);
    const summarizedActualAssignments = summarizeMonthlyActualAssignments(filteredActualAssignments, dateRange);
    options.timing?.phase("monthly_summary", {
      assignmentCount: summarizedAssignments.length,
      actualAssignmentCount: summarizedActualAssignments.length,
    });

    return {
      request,
      assignments: summarizedAssignments,
      actualAssignments: summarizedActualAssignments,
    };
  }

  options.timing?.phase("monthly_summary", {
    assignmentCount: filteredAssignments.length,
    actualAssignmentCount: filteredActualAssignments.length,
    skipped: true,
  });

  return {
    request,
    assignments: filteredAssignments,
    actualAssignments: filteredActualAssignments,
  };
}
```

- [x] **Step 4: Add response byte logging to the planner route**

Change `app/api/planner/timeline/route.ts` so the response is built before returning:

```ts
const data = await fetchPlannerTimeline(
  session,
  {
    viewMode,
    resolution: getTimelineResolution(viewMode),
    startDate,
    endDate,
    filters,
  },
  { timing }
);

const body = { success: true, data };
const responseBytes = Buffer.byteLength(JSON.stringify(body), "utf8");

timing.phase("response_payload", {
  bytes: responseBytes,
  assignmentCount: data.assignments.length,
  actualAssignmentCount: data.actualAssignments.length,
});
timing.total({ result: "success" });

return NextResponse.json(body);
```

- [x] **Step 5: Run observability test**

Run: `npm run test -- tests/whitebox/planner-backend-observability.test.ts`

Expected: PASS.

- [x] **Step 6: Run existing planner tests**

Run: `npm run test -- tests/whitebox/planner-timeline-loading.test.ts tests/whitebox/planner-startup.test.ts`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add app/api/planner/timeline/route.ts lib/query/server/planner-prefetch.ts tests/whitebox/planner-backend-observability.test.ts
git commit -m "chore: add planner backend timing metrics"
```

## Task 2: Reuse PostgreSQL Connections Safely

**Files:**
- Modify: `lib/mysql-assignments/db.ts`
- Create: `tests/whitebox/assignments-db-connection.test.ts`

- [x] **Step 1: Write the failing connection test**

Create `tests/whitebox/assignments-db-connection.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("assignments database connection management", () => {
  it("uses a PostgreSQL pool instead of creating a client per query", () => {
    const source = readFileSync("lib/mysql-assignments/db.ts", "utf8");

    expect(source).toContain("let _postgresPool");
    expect(source).toContain("async function getPostgresPool");
    expect(source).toContain("return _postgresPool");
    expect(source).not.toContain("PostgreSQL client for serverless - ALWAYS create new connection");
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/assignments-db-connection.test.ts`

Expected: FAIL because `db.ts` currently creates a new PostgreSQL client per query.

- [x] **Step 3: Replace per-query PostgreSQL clients with a pool**

In `lib/mysql-assignments/db.ts`, replace the unused `PostgreSQLPool` import and `getPostgresClient` implementation with:

```ts
import { Pool as PostgreSQLPool } from 'pg';
import type { Pool as MySQLPool } from 'mysql2/promise';

let _postgresPool: PostgreSQLPool | null = null;

async function getPostgresPool(): Promise<PostgreSQLPool> {
  if (_postgresPool) return _postgresPool;

  _postgresPool = new PostgreSQLPool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.POSTGRES_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return _postgresPool;
}
```

Update the PostgreSQL branch of `query`:

```ts
if (dbClient === 'postgresql') {
  const pool = await getPostgresPool();
  const pgSql = convertMySQLToPostgreSQL(sql);
  const result = await pool.query(pgSql, params);

  return [
    result.rows,
    result.fields,
  ];
}
```

Update the PostgreSQL branch of `execute` with the same implementation.

Update `getConnection` for PostgreSQL:

```ts
if (dbClient === 'postgresql') {
  const pool = await getPostgresPool();
  const client = await pool.connect();

  return {
    query: async (sql: string, params?: any[]) => {
      const pgSql = convertMySQLToPostgreSQL(sql);
      return client.query(pgSql, params);
    },
    execute: async (sql: string, params?: any[]) => {
      const pgSql = convertMySQLToPostgreSQL(sql);
      return client.query(pgSql, params);
    },
    release: async () => {
      client.release();
    },
    ping: async () => client.query('SELECT 1'),
  };
}
```

Update `end`:

```ts
async end() {
  if (dbClient === 'postgresql' && _postgresPool) {
    await _postgresPool.end();
    _postgresPool = null;
  }

  if (dbClient === 'mysql' && _mysqlPool) {
    await _mysqlPool.end();
    _mysqlPool = null;
  }
},
```

- [x] **Step 4: Run connection test**

Run: `npm run test -- tests/whitebox/assignments-db-connection.test.ts`

Expected: PASS.

- [x] **Step 5: Run planner tests**

Run: `npm run test -- tests/whitebox/planner-timeline-loading.test.ts tests/whitebox/planner-backend-observability.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add lib/mysql-assignments/db.ts tests/whitebox/assignments-db-connection.test.ts
git commit -m "perf: reuse postgres connections for planner data"
```

## Task 3: Add Timeline-Specific Assignment Query Projections

**Files:**
- Modify: `lib/mysql-assignments/queries.ts`
- Modify: `lib/query/server/planner-prefetch.ts`
- Create: `tests/whitebox/planner-assignment-projection.test.ts`

- [x] **Step 1: Write the failing projection test**

Create `tests/whitebox/planner-assignment-projection.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner assignment projections", () => {
  it("uses timeline-specific selected columns for planner reads", () => {
    const queriesSource = readFileSync("lib/mysql-assignments/queries.ts", "utf8");
    const prefetchSource = readFileSync("lib/query/server/planner-prefetch.ts", "utf8");

    expect(queriesSource).toContain("const TIMELINE_ASSIGNMENT_COLUMNS");
    expect(queriesSource).toContain("getTimelineAssignments");
    expect(queriesSource).toContain("getTimelineActualAssignments");
    expect(queriesSource).not.toContain("export async function getTimelineAssignments(filters");
    expect(prefetchSource).toContain("getTimelineAssignments");
    expect(prefetchSource).toContain("getTimelineActualAssignments");
    expect(prefetchSource).not.toContain("getAssignments({");
    expect(prefetchSource).not.toContain("getActualAssignments({");
  });
});
```

After writing the test, remove this deliberately impossible assertion before implementation:

```ts
expect(queriesSource).not.toContain("export async function getTimelineAssignments(filters");
```

The corrected test must assert the new functions are present and the prefetch layer no longer uses the generic broad queries.

- [x] **Step 2: Run the corrected test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-assignment-projection.test.ts`

Expected: FAIL because timeline-specific query functions do not exist.

- [x] **Step 3: Add timeline-specific query functions**

Add this to `lib/mysql-assignments/queries.ts` near the existing assignment read functions:

```ts
const TIMELINE_ASSIGNMENT_COLUMNS = [
  'uuid',
  'employee_uuid',
  'project_uuid',
  'task_uuid',
  'start_date',
  'end_date',
  'hours_per_day',
  'total_hours',
  'allocation_percentage',
  'is_time_off',
  'is_adjustment',
  'time_off_type_uuid',
  'category',
  'is_billable',
  'status',
  'note',
  'created_by_uuid',
  'created_at',
  'updated_at',
].join(', ');

const TIMELINE_ACTUAL_COLUMNS = [
  'uuid',
  'employee_uuid',
  'project_uuid',
  'task_uuid',
  'start_date',
  'end_date',
  'hours_per_day',
  'total_hours',
  'allocation_percentage',
  'is_time_off',
  'time_off_type_uuid',
  'category',
  'is_billable',
  'status',
  'note',
  'created_by_uuid',
  'created_at',
  'updated_at',
].join(', ');

type TimelineAssignmentFilters = {
  employee_uuid?: string;
  project_uuid?: string;
  project_uuids?: string[];
  start_date: string;
  end_date: string;
  status?: string | null;
  category?: string | null;
};

export async function getTimelineAssignments(filters: TimelineAssignmentFilters) {
  let query = `SELECT ${TIMELINE_ASSIGNMENT_COLUMNS} FROM assignments WHERE end_date >= ? AND start_date <= ?`;
  const params: any[] = [filters.start_date, filters.end_date];

  if (filters.employee_uuid) {
    query += ' AND employee_uuid = ?';
    params.push(filters.employee_uuid);
  }

  if (filters.project_uuid) {
    query += ' AND project_uuid = ?';
    params.push(filters.project_uuid);
  }

  if (filters.project_uuids && filters.project_uuids.length > 0) {
    const placeholders = filters.project_uuids.map(() => '?').join(',');
    query += ` AND project_uuid IN (${placeholders})`;
    params.push(...filters.project_uuids);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  query += ' ORDER BY employee_uuid, start_date, project_uuid';

  const [rows] = await assignmentsDb.execute(query, params);
  return rows;
}

export async function getTimelineActualAssignments(filters: TimelineAssignmentFilters) {
  let query = `SELECT ${TIMELINE_ACTUAL_COLUMNS} FROM actual WHERE end_date >= ? AND start_date <= ?`;
  const params: any[] = [filters.start_date, filters.end_date];

  if (filters.employee_uuid) {
    query += ' AND employee_uuid = ?';
    params.push(filters.employee_uuid);
  }

  if (filters.project_uuid) {
    query += ' AND project_uuid = ?';
    params.push(filters.project_uuid);
  }

  if (filters.project_uuids && filters.project_uuids.length > 0) {
    const placeholders = filters.project_uuids.map(() => '?').join(',');
    query += ` AND project_uuid IN (${placeholders})`;
    params.push(...filters.project_uuids);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  query += ' ORDER BY employee_uuid, start_date, project_uuid';

  const [rows] = await assignmentsDb.execute(query, params);
  return rows;
}
```

- [x] **Step 4: Use projections from the planner prefetch layer**

Change the import in `lib/query/server/planner-prefetch.ts`:

```ts
import {
  getTimelineActualAssignments,
  getTimelineAssignments,
} from "@/lib/mysql-assignments/queries";
```

Change `fetchPlannerAssignments`:

```ts
export async function fetchPlannerAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string },
  filters: PlannerTimelineRequest["filters"] = {}
): Promise<Assignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const assignments = (await getTimelineAssignments({
    employee_uuid: employeeUuid,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    status: filters?.status,
    category: filters?.category,
  })) as ApiRecord[];

  return assignments.map(transformAssignment);
}
```

Change `fetchPlannerActualAssignments`:

```ts
export async function fetchPlannerActualAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string },
  filters: PlannerTimelineRequest["filters"] = {}
): Promise<ActualAssignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const actuals = (await getTimelineActualAssignments({
    employee_uuid: employeeUuid,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    status: filters?.status,
    category: filters?.category,
  })) as ApiRecord[];

  return actuals.map(transformActual);
}
```

Change the promises in `fetchPlannerTimeline`:

```ts
const plannedPromise = fetchPlannerAssignments(session, dateRange, request.filters).then((assignments) => {
  options.timing?.phase("planned_assignments_query", { count: assignments.length });
  return assignments;
});

const actualPromise = fetchPlannerActualAssignments(session, dateRange, request.filters).then((actualAssignments) => {
  options.timing?.phase("actual_assignments_query", { count: actualAssignments.length });
  return actualAssignments;
});
```

Remove `filterPlannerAssignments` and `filterPlannerActualAssignments` only after tests prove no caller relies on post-fetch filtering.

- [x] **Step 5: Run projection test**

Run: `npm run test -- tests/whitebox/planner-assignment-projection.test.ts`

Expected: PASS.

- [x] **Step 6: Run planner tests**

Run: `npm run test -- tests/whitebox/planner-timeline-loading.test.ts tests/whitebox/timeline-v2-source-parity.test.ts`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add lib/mysql-assignments/queries.ts lib/query/server/planner-prefetch.ts tests/whitebox/planner-assignment-projection.test.ts
git commit -m "perf: use timeline-specific planner queries"
```

## Task 4: Add Planner Home Bootstrap Types And Server Composer

**Files:**
- Create: `lib/query/server/planner-home-bootstrap.ts`
- Create: `tests/whitebox/planner-home-bootstrap-source.test.ts`

- [ ] **Step 1: Write the failing bootstrap source test**

Create `tests/whitebox/planner-home-bootstrap-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap server composer", () => {
  it("defines a compact home bootstrap contract", () => {
    const source = readFileSync("lib/query/server/planner-home-bootstrap.ts", "utf8");

    expect(source).toContain("export type PlannerHomeBootstrapRequest");
    expect(source).toContain("export type PlannerHomeBootstrapResponse");
    expect(source).toContain("MinimalTimelineEmployee");
    expect(source).toContain("MinimalTimelineProject");
    expect(source).toContain("fetchPlannerHomeBootstrap");
    expect(source).toContain("fetchOrderedEmployeeSlice");
    expect(source).toContain("fetchPlannerTimeline");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-source.test.ts`

Expected: FAIL because `planner-home-bootstrap.ts` does not exist.

- [ ] **Step 3: Create the bootstrap composer**

Create `lib/query/server/planner-home-bootstrap.ts`:

```ts
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import type { SessionData } from "@/lib/auth/session";
import { fetchOrderedEmployeeSlice } from "@/lib/employees/ordered-directory";
import { fetchProjectSummaries } from "@/lib/projects/project-summary-fetcher";
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

function toMinimalBrandFromProject(project: MinimalTimelineProject): MinimalTimelineBrand | null {
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
  const client = getMySqlApiClient(async () => session.access_token);
  const fetchedAt = new Date().toISOString();

  const [employeeSlice, plannerTimeline, projectSummaryResult] = await Promise.all([
    fetchOrderedEmployeeSlice(session, {
      offset: request.employeeOffset,
      limit: request.employeeLimit,
      search: request.search?.trim() || undefined,
    }),
    fetchPlannerTimeline(session, request),
    fetchProjectSummaries({
      client,
      brandId: request.brandId || undefined,
      search: undefined,
      pageSize: 100,
      maxPagesPerSource: 3,
    }),
  ]);

  const referencedProjectIds = getReferencedProjectIds(plannerTimeline);
  const projectsById: Record<string, MinimalTimelineProject> = {};

  for (const project of projectSummaryResult.data) {
    if (referencedProjectIds.size === 0 || referencedProjectIds.has(project.id) || project.id === request.projectId) {
      projectsById[project.id] = toMinimalProject(project);
    }
  }

  const brandsById: Record<string, MinimalTimelineBrand> = {};

  for (const project of Object.values(projectsById)) {
    const brand = toMinimalBrandFromProject(project);
    if (brand) brandsById[brand.id] = brand;
  }

  return {
    request,
    employees: employeeSlice.data.map(toMinimalEmployee),
    employeeTotal: employeeSlice.total,
    employeeHasMore: employeeSlice.hasMore,
    brandsById,
    projectsById,
    plannerTimeline,
    metadataPartial: projectSummaryResult.truncated,
    freshness: {
      timeTrackFetchedAt: fetchedAt,
      plannerFetchedAt: fetchedAt,
    },
  };
}
```

- [ ] **Step 4: Run bootstrap source test**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-source.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/query/server/planner-home-bootstrap.ts tests/whitebox/planner-home-bootstrap-source.test.ts
git commit -m "feat: add planner home bootstrap composer"
```

## Task 5: Add The Home Bootstrap Route

**Files:**
- Create: `app/api/planner/home-bootstrap/route.ts`
- Create: `tests/whitebox/planner-home-bootstrap-route.test.ts`

- [ ] **Step 1: Write the failing route test**

Create `tests/whitebox/planner-home-bootstrap-route.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap route", () => {
  it("validates request params and calls the bootstrap composer", () => {
    const source = readFileSync("app/api/planner/home-bootstrap/route.ts", "utf8");

    expect(source).toContain('createRequestTiming("planner_home_bootstrap_api")');
    expect(source).toContain("fetchPlannerHomeBootstrap");
    expect(source).toContain("employeeLimit");
    expect(source).toContain("employeeOffset");
    expect(source).toContain("Buffer.byteLength");
    expect(source).toContain("metadataPartial");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Create the route**

Create `app/api/planner/home-bootstrap/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerHomeBootstrap } from "@/lib/query/server/planner-home-bootstrap";
import {
  getTimelineResolution,
  type TimelineViewMode,
} from "@/lib/timeline/planner-loading";
import { createRequestTiming } from "@/lib/observability/request-timing";

const VIEW_MODES = new Set<TimelineViewMode>([
  "week",
  "month",
  "quarter",
  "halfYear",
  "year",
]);

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: NextRequest) {
  const timing = createRequestTiming("planner_home_bootstrap_api");

  try {
    const session = await getSession();
    if (!session) {
      timing.total({ result: "unauthenticated" });
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const viewParam = request.nextUrl.searchParams.get("viewMode");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    if (!viewParam || !VIEW_MODES.has(viewParam as TimelineViewMode) || !startDate || !endDate) {
      timing.total({ result: "invalid_request" });
      return NextResponse.json(
        { error: "viewMode, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const viewMode = viewParam as TimelineViewMode;
    const employeeLimit = boundedInteger(request.nextUrl.searchParams.get("employeeLimit"), 24, 1, 100);
    const employeeOffset = boundedInteger(request.nextUrl.searchParams.get("employeeOffset"), 0, 0, 100_000);

    const data = await fetchPlannerHomeBootstrap(session, {
      viewMode,
      resolution: getTimelineResolution(viewMode),
      startDate,
      endDate,
      filters: {
        category: request.nextUrl.searchParams.get("category"),
        status: request.nextUrl.searchParams.get("status"),
      },
      employeeLimit,
      employeeOffset,
      brandId: request.nextUrl.searchParams.get("brandId"),
      department: request.nextUrl.searchParams.get("department"),
      projectId: request.nextUrl.searchParams.get("projectId"),
      search: request.nextUrl.searchParams.get("search"),
    });

    const body = { success: true, data };
    timing.phase("response_payload", {
      bytes: Buffer.byteLength(JSON.stringify(body), "utf8"),
      employees: data.employees.length,
      assignments: data.plannerTimeline.assignments.length,
      actualAssignments: data.plannerTimeline.actualAssignments.length,
      metadataPartial: data.metadataPartial,
    });
    timing.total({ result: "success" });

    return NextResponse.json(body);
  } catch (error) {
    timing.total({ result: "error" });
    console.error("[API /planner/home-bootstrap] Failed to load planner home bootstrap:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load planner home bootstrap",
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run route test**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-route.test.ts`

Expected: PASS.

- [ ] **Step 5: Run planner route tests**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-source.test.ts tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-timeline-loading.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/planner/home-bootstrap/route.ts tests/whitebox/planner-home-bootstrap-route.test.ts
git commit -m "feat: add planner home bootstrap route"
```

## Task 6: Add A Client Hook For Home Bootstrap Without Removing Existing Queries

**Files:**
- Create: `lib/query/hooks/usePlannerHomeBootstrap.ts`
- Modify: `lib/query/hooks/index.ts`
- Create: `tests/whitebox/planner-home-bootstrap-hook.test.ts`

- [ ] **Step 1: Write the failing hook test**

Create `tests/whitebox/planner-home-bootstrap-hook.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap hook", () => {
  it("fetches the compact home bootstrap endpoint", () => {
    const hookSource = readFileSync("lib/query/hooks/usePlannerHomeBootstrap.ts", "utf8");
    const indexSource = readFileSync("lib/query/hooks/index.ts", "utf8");

    expect(hookSource).toContain("/api/planner/home-bootstrap");
    expect(hookSource).toContain("usePlannerHomeBootstrap");
    expect(hookSource).toContain("keepPreviousData");
    expect(indexSource).toContain("usePlannerHomeBootstrap");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-hook.test.ts`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Create the hook**

Create `lib/query/hooks/usePlannerHomeBootstrap.ts`:

```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  PlannerHomeBootstrapRequest,
  PlannerHomeBootstrapResponse,
} from "@/lib/query/server/planner-home-bootstrap";

function getPlannerHomeBootstrapQueryKey(request: PlannerHomeBootstrapRequest) {
  return ["planner-home-bootstrap", request] as const;
}

async function fetchPlannerHomeBootstrap(
  request: PlannerHomeBootstrapRequest
): Promise<PlannerHomeBootstrapResponse> {
  const url = new URL("/api/planner/home-bootstrap", window.location.origin);
  url.searchParams.set("viewMode", request.viewMode);
  url.searchParams.set("startDate", request.startDate);
  url.searchParams.set("endDate", request.endDate);
  url.searchParams.set("employeeLimit", String(request.employeeLimit));
  url.searchParams.set("employeeOffset", String(request.employeeOffset));

  if (request.brandId) url.searchParams.set("brandId", request.brandId);
  if (request.department) url.searchParams.set("department", request.department);
  if (request.projectId) url.searchParams.set("projectId", request.projectId);
  if (request.search) url.searchParams.set("search", request.search);

  for (const [key, value] of Object.entries(request.filters ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner home bootstrap");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerHomeBootstrap(
  request?: PlannerHomeBootstrapRequest,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: request ? getPlannerHomeBootstrapQueryKey(request) : ["planner-home-bootstrap", "disabled"],
    queryFn: () => fetchPlannerHomeBootstrap(request!),
    enabled: !!request && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 4: Export the hook**

Add this line to `lib/query/hooks/index.ts`:

```ts
export * from "./usePlannerHomeBootstrap";
```

- [ ] **Step 5: Run hook test**

Run: `npm run test -- tests/whitebox/planner-home-bootstrap-hook.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/query/hooks/usePlannerHomeBootstrap.ts lib/query/hooks/index.ts tests/whitebox/planner-home-bootstrap-hook.test.ts
git commit -m "feat: add planner home bootstrap hook"
```

## Task 7: Wire Bootstrap Into Timeline V2 Behind A Feature Flag

**Files:**
- Modify: `components/timeline-v2/TimelineV2.tsx`
- Create: `tests/whitebox/timeline-v2-bootstrap-source.test.ts`

- [ ] **Step 1: Write the failing source test**

Create `tests/whitebox/timeline-v2-bootstrap-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TimelineV2 bootstrap integration", () => {
  it("can use the planner home bootstrap endpoint for initial data", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("usePlannerHomeBootstrap");
    expect(source).toContain("NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP");
    expect(source).toContain("bootstrapEmployees");
    expect(source).toContain("bootstrapPlannerTimeline");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/timeline-v2-bootstrap-source.test.ts`

Expected: FAIL because `TimelineV2` does not use the bootstrap hook.

- [ ] **Step 3: Import the bootstrap hook**

Modify the existing hook import in `components/timeline-v2/TimelineV2.tsx`:

```ts
import {
  useBrands,
  useEmployees,
  useInfiniteEmployees,
  usePlannerHomeBootstrap,
  usePlannerTimeline,
  useProjectsByBrand,
  useProjectOptions,
} from "@/lib/query/hooks";
```

- [ ] **Step 4: Add the bootstrap request**

Add this near `plannerRequest`:

```ts
const shouldUseHomeBootstrap = process.env.NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP === "true";

const bootstrapRequest = useMemo(() => {
  if (!plannerRequest) return undefined;

  return {
    ...plannerRequest,
    employeeLimit: 24,
    employeeOffset: 0,
    brandId,
    department,
    projectId,
    search: searchQuery ?? null,
  };
}, [brandId, department, plannerRequest, projectId, searchQuery]);

const {
  data: plannerHomeBootstrap,
  isLoading: isLoadingPlannerHomeBootstrap,
  isFetching: isFetchingPlannerHomeBootstrap,
} = usePlannerHomeBootstrap(bootstrapRequest, {
  enabled: shouldUseHomeBootstrap && shouldEnableTimelineAssignments(assignmentDateRange),
});
```

- [ ] **Step 5: Prefer bootstrap data when enabled**

Add these local values before row construction:

```ts
const bootstrapEmployees = shouldUseHomeBootstrap ? plannerHomeBootstrap?.employees : undefined;
const bootstrapPlannerTimeline = shouldUseHomeBootstrap ? plannerHomeBootstrap?.plannerTimeline : undefined;
```

Change employee and planner values so bootstrap can serve first paint:

```ts
const employees = bootstrapEmployees ?? (
  useCompleteEmployeeList
    ? completeEmployees
    : getLoadedTimelineEmployees(incrementalEmployeePages?.pages)
);

const plannerTimeline = bootstrapPlannerTimeline ?? queriedPlannerTimeline;
```

To make this compile, rename the current planner hook destructuring:

```ts
const {
  data: queriedPlannerTimeline,
  isFetching: isFetchingPlannerTimeline,
  isRefetchError: isPlannerTimelineRefetchError,
  isShowingPreviousData: isPlannerTimelineApplyingFilters,
} = usePlannerTimeline(plannerRequest, {
  enabled: !shouldUseHomeBootstrap && shouldEnableTimelineAssignments(assignmentDateRange),
});
```

Change initial loading:

```ts
const isInitialTimelineLoading =
  (shouldUseHomeBootstrap && isLoadingPlannerHomeBootstrap) ||
  (!shouldUseHomeBootstrap && (isLoadingEmployees || isLoadingBrandProjectLookup || rowLoadingState.showInitialSkeleton));
```

Do not remove the old queries in this task. This feature flag lets the team compare old and new loading behavior in production-like environments.

- [ ] **Step 6: Run bootstrap integration test**

Run: `npm run test -- tests/whitebox/timeline-v2-bootstrap-source.test.ts`

Expected: PASS.

- [ ] **Step 7: Run V2 tests**

Run: `npm run test -- tests/whitebox/timeline-v2-render.test.ts tests/whitebox/timeline-v2-row-model.test.ts tests/whitebox/planner-timeline-loading.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/timeline-v2/TimelineV2.tsx tests/whitebox/timeline-v2-bootstrap-source.test.ts
git commit -m "feat: gate timeline v2 home bootstrap loading"
```

## Task 8: Add Database Index Migration For Timeline Overlap Reads

**Files:**
- Create: `migrations/add_timeline_query_indexes.sql`
- Create: `tests/whitebox/timeline-query-indexes.test.ts`

- [ ] **Step 1: Write the failing index test**

Create `tests/whitebox/timeline-query-indexes.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline query indexes", () => {
  it("adds targeted indexes for date-overlap planner reads", () => {
    const source = readFileSync("migrations/add_timeline_query_indexes.sql", "utf8");

    expect(source).toContain("idx_assignments_timeline_overlap");
    expect(source).toContain("idx_actual_timeline_overlap");
    expect(source).toContain("employee_uuid");
    expect(source).toContain("end_date");
    expect(source).toContain("start_date");
    expect(source).toContain("status");
    expect(source).toContain("category");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/timeline-query-indexes.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Create the migration**

Create `migrations/add_timeline_query_indexes.sql`:

```sql
-- Migration: Add timeline query indexes
-- Purpose: speed date-overlap planner reads used by Timeline V2 and home bootstrap.

CREATE INDEX IF NOT EXISTS idx_assignments_timeline_overlap
  ON assignments (employee_uuid, end_date, start_date, status, category);

CREATE INDEX IF NOT EXISTS idx_assignments_project_timeline_overlap
  ON assignments (project_uuid, end_date, start_date)
  WHERE project_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actual_timeline_overlap
  ON actual (employee_uuid, end_date, start_date, status, category);

CREATE INDEX IF NOT EXISTS idx_actual_project_timeline_overlap
  ON actual (project_uuid, end_date, start_date)
  WHERE project_uuid IS NOT NULL;
```

If production is PostgreSQL and row counts are large, run `EXPLAIN ANALYZE` before and after this migration. If the planner still prefers sequential scans for range overlap, add a later migration using GiST range indexes:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS idx_assignments_timeline_range_gist
  ON assignments USING gist (employee_uuid, daterange(start_date, end_date, '[]'));

CREATE INDEX IF NOT EXISTS idx_actual_timeline_range_gist
  ON actual USING gist (employee_uuid, daterange(start_date, end_date, '[]'));
```

Do not add the GiST migration blindly; it should be based on measured query plans and table size.

- [ ] **Step 4: Run index test**

Run: `npm run test -- tests/whitebox/timeline-query-indexes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add migrations/add_timeline_query_indexes.sql tests/whitebox/timeline-query-indexes.test.ts
git commit -m "perf: add timeline query indexes"
```

## Task 9: Remove Home-Path Dead Code And High-Volume Debug Logs

**Files:**
- Modify: `lib/mysql-assignments/db.ts`
- Modify: `lib/mysql-assignments/queries.ts`
- Modify: `components/timeline-v2/useTimelineV2Controller.ts`
- Modify: `app/api/brands/route.ts`
- Modify: `lib/query/hooks/useBrands.ts`
- Create: `tests/whitebox/home-backend-cleanup.test.ts`

- [ ] **Step 1: Write the failing cleanup test**

Create `tests/whitebox/home-backend-cleanup.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("home backend cleanup", () => {
  it("removes dead code and high-volume debug logs from home loading paths", () => {
    const dbSource = readFileSync("lib/mysql-assignments/db.ts", "utf8");
    const queriesSource = readFileSync("lib/mysql-assignments/queries.ts", "utf8");
    const controllerSource = readFileSync("components/timeline-v2/useTimelineV2Controller.ts", "utf8");
    const brandsRouteSource = readFileSync("app/api/brands/route.ts", "utf8");
    const brandsHookSource = readFileSync("lib/query/hooks/useBrands.ts", "utf8");

    expect(dbSource).not.toContain("PostgreSQLClient");
    expect(queriesSource).not.toContain("validateAssignmentData");
    expect(queriesSource).not.toContain("[createAssignment] Input");
    expect(controllerSource).not.toContain("openMonthlyAllocationConfirm");
    expect(brandsRouteSource).not.toContain("JSON.stringify(response, null, 2)");
    expect(brandsHookSource).not.toContain("[fetchBrandsPaginated]");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/home-backend-cleanup.test.ts`

Expected: FAIL because the cleanup candidates are still present.

- [ ] **Step 3: Remove unused PostgreSQL client import**

In `lib/mysql-assignments/db.ts`, make sure the import is:

```ts
import { Pool as PostgreSQLPool } from 'pg';
```

- [ ] **Step 4: Remove unused assignment validation helper**

Delete this unused function from `lib/mysql-assignments/queries.ts`:

```ts
async function validateAssignmentData(data: {
  employee_uuid: string;
  project_uuid?: string | null;
}): Promise<void> {
  try {
    const employeeRes = await fetch(`${TIMETRACK_API_URL}/employees/${data.employee_uuid}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!employeeRes.ok) {
      throw new Error(`Employee ${data.employee_uuid} not found`);
    }

    if (data.project_uuid) {
      const projectRes = await fetch(`${TIMETRACK_API_URL}/campaigns/${data.project_uuid}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!projectRes.ok) {
        throw new Error(`Project ${data.project_uuid} not found`);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.warn('[Assignments] Validation failed, continuing:', error);
  }
}
```

Also remove `const TIMETRACK_API_URL = ...` if no remaining code in the file uses it.

- [ ] **Step 5: Remove high-volume create-assignment logs**

Remove these debug logs from `lib/mysql-assignments/queries.ts`:

```ts
console.log('[createAssignment] Input:', {
  employee_uuid: data.employee_uuid,
  start_date: data.start_date,
  end_date: data.end_date,
  hours_per_day: data.hours_per_day,
  total_hours_input: data.total_hours
});

console.log('[createAssignment] Inserted to DB, fetching result...');

console.log('[createAssignment] Result from DB:', {
  uuid: result.uuid,
  start_date: result.start_date,
  end_date: result.end_date,
  hours_per_day: result.hours_per_day,
  total_hours: result.total_hours
});
```

Keep error logs in catch blocks where they help diagnose failed requests.

- [ ] **Step 6: Remove unused timeline controller no-op**

Delete this from `components/timeline-v2/useTimelineV2Controller.ts`:

```ts
const openMonthlyAllocationConfirm = useCallback(() => setMonthlyAllocationConfirm((value) => value), []);
```

Remove `openMonthlyAllocationConfirm` from the returned object.

- [ ] **Step 7: Remove high-volume brand route logs**

In `app/api/brands/route.ts`, remove logs that dump raw TimeTrack responses or transformed samples:

```ts
console.log('[Brands API] MySQL response:', JSON.stringify(response, null, 2));
console.log('[Brands API] Processed response:', {
  dataLength: mergedBrands.length,
  total,
  currentPage,
  lastPage,
  hasMore,
  hasMeta: !!meta,
  sampleBrand: mergedBrands[0] ? Object.keys(mergedBrands[0]) : [],
});
console.log('[Brands API] Final transformed brands sample:', transformedBrands.slice(0, 3).map((b: any) => ({ id: b.id, name: b.name, original: mergedBrands.find((mb: any) => mb.brand_name === b.name)?.id || mergedBrands.find((mb: any) => mb.brand_name === b.name)?.brand_id })));
console.log('[Brands API] Cached', transformedBrands.length, 'brands');
```

Keep a single timing-based log only if `createRequestTiming` is added to the route.

- [ ] **Step 8: Remove paginated brands hook logs**

In `lib/query/hooks/useBrands.ts`, remove:

```ts
console.log('[fetchBrandsPaginated] Fetching:', { pageParam, search, url });
console.error('[fetchBrandsPaginated] Response not OK:', { status: response.status, statusText: response.statusText });
console.log('[fetchBrandsPaginated] Result:', {
  success: result.success,
  dataLength: result.data?.length,
  total: result.total,
  hasMore: result.hasMore,
  error: result.error,
});
```

Throwing `new Error("Failed to fetch brands")` is enough for TanStack Query to surface the failed state.

- [ ] **Step 9: Run cleanup test**

Run: `npm run test -- tests/whitebox/home-backend-cleanup.test.ts`

Expected: PASS.

- [ ] **Step 10: Run targeted tests**

Run: `npm run test -- tests/whitebox/timeline-v2-source-parity.test.ts tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-assignment-projection.test.ts`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/mysql-assignments/db.ts lib/mysql-assignments/queries.ts components/timeline-v2/useTimelineV2Controller.ts app/api/brands/route.ts lib/query/hooks/useBrands.ts tests/whitebox/home-backend-cleanup.test.ts
git commit -m "chore: clean home backend loading paths"
```

## Task 10: Decide Whether To Keep Or Remove Legacy Startup Prefetch

**Files:**
- Modify: `lib/query/server/planner-startup.ts`
- Modify: `tests/whitebox/planner-startup.test.ts`
- Create: `tests/whitebox/planner-startup-retirement.test.ts`

- [ ] **Step 1: Write the retirement test**

Create `tests/whitebox/planner-startup-retirement.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner startup prefetch retirement", () => {
  it("does not keep unused startup prefetch beside home bootstrap", () => {
    const startupSource = readFileSync("lib/query/server/planner-startup.ts", "utf8");
    const pageSource = readFileSync("app/page.tsx", "utf8");

    expect(pageSource).not.toContain("prefetchCriticalPlannerStartup");
    expect(startupSource).toContain("getInitialPlannerRequest");
    expect(startupSource).not.toContain("prefetchCriticalPlannerStartup");
    expect(startupSource).not.toContain("seedCriticalPlannerStartup");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-startup-retirement.test.ts`

Expected: FAIL because `planner-startup.ts` still contains the unused prefetch helpers.

- [ ] **Step 3: Remove unused startup hydration helpers**

In `lib/query/server/planner-startup.ts`, keep `getInitialPlannerRequest` only. Remove:

```ts
type PrefetchResult<T> =
  | { ok: true; data: T }
  | { ok: false };

async function safePrefetch<T>(label: string, promise: Promise<T>): Promise<PrefetchResult<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    console.error(`[Planner Startup] Failed to prefetch ${label}:`, error);
    return { ok: false };
  }
}

export function seedCriticalPlannerStartup(...)
export async function prefetchCriticalPlannerStartup(...)
```

Remove imports that become unused:

```ts
import { QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerTimeline } from "@/lib/query/server/planner-prefetch";
import {
  getPlannerTimelineQueryKey,
  type PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";
import { createRequestTiming } from "@/lib/observability/request-timing";
```

Keep imports needed by `getInitialPlannerRequest`:

```ts
import {
  DEFAULT_TIMELINE_VIEW,
  getInitialTimelineDateRange,
} from "@/lib/timeline/initial-load";
import {
  getTimelineResolution,
  type PlannerTimelineRequest,
} from "@/lib/timeline/planner-loading";
```

- [ ] **Step 4: Update startup tests**

In `tests/whitebox/planner-startup.test.ts`, remove tests that assert `prefetchCriticalPlannerStartup` behavior. Keep the `getInitialPlannerRequest` coverage:

```ts
import { describe, expect, it } from "vitest";
import { getInitialPlannerRequest } from "@/lib/query/server/planner-startup";

describe("planner startup", () => {
  it("builds the default initial planner request", () => {
    expect(getInitialPlannerRequest("2026-05-21")).toEqual({
      viewMode: "quarter",
      resolution: "month",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filters: {
        category: null,
        status: null,
      },
    });
  });
});
```

- [ ] **Step 5: Run startup tests**

Run: `npm run test -- tests/whitebox/planner-startup.test.ts tests/whitebox/planner-startup-retirement.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/query/server/planner-startup.ts tests/whitebox/planner-startup.test.ts tests/whitebox/planner-startup-retirement.test.ts
git commit -m "chore: retire unused planner startup prefetch"
```

## Task 11: Benchmark And Decide On SQL Monthly Aggregation

**Files:**
- Create: `scripts/benchmark-planner-timeline.ts`
- Create: `tests/whitebox/planner-benchmark-script.test.ts`

- [ ] **Step 1: Write the failing benchmark script test**

Create `tests/whitebox/planner-benchmark-script.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner benchmark script", () => {
  it("measures planner endpoint latency and payload size", () => {
    const source = readFileSync("scripts/benchmark-planner-timeline.ts", "utf8");

    expect(source).toContain("planner/home-bootstrap");
    expect(source).toContain("planner/timeline");
    expect(source).toContain("performance.now");
    expect(source).toContain("Buffer.byteLength");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/planner-benchmark-script.test.ts`

Expected: FAIL because the benchmark script does not exist.

- [ ] **Step 3: Create the benchmark script**

Create `scripts/benchmark-planner-timeline.ts`:

```ts
const baseUrl = process.env.PLANNER_BENCHMARK_BASE_URL || "http://localhost:3000";
const cookie = process.env.PLANNER_BENCHMARK_COOKIE || "";

const endpoints = [
  "/api/planner/timeline?viewMode=quarter&startDate=2026-04-01&endDate=2026-06-30",
  "/api/planner/home-bootstrap?viewMode=quarter&startDate=2026-04-01&endDate=2026-06-30&employeeLimit=24&employeeOffset=0",
];

async function measure(endpoint: string) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: cookie ? { cookie } : {},
  });
  const text = await response.text();
  const durationMs = Math.round(performance.now() - startedAt);

  return {
    endpoint,
    status: response.status,
    durationMs,
    bytes: Buffer.byteLength(text, "utf8"),
  };
}

async function main() {
  for (const endpoint of endpoints) {
    const result = await measure(endpoint);
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Run benchmark script test**

Run: `npm run test -- tests/whitebox/planner-benchmark-script.test.ts`

Expected: PASS.

- [ ] **Step 5: Run benchmark locally with an authenticated cookie**

Start the app:

Run: `npm run dev`

In another terminal, run:

```bash
PLANNER_BENCHMARK_COOKIE='session=replace-with-local-session-cookie' npx tsx scripts/benchmark-planner-timeline.ts
```

Expected output shape:

```json
{"endpoint":"/api/planner/timeline?viewMode=quarter&startDate=2026-04-01&endDate=2026-06-30","status":200,"durationMs":450,"bytes":180000}
{"endpoint":"/api/planner/home-bootstrap?viewMode=quarter&startDate=2026-04-01&endDate=2026-06-30&employeeLimit=24&employeeOffset=0","status":200,"durationMs":220,"bytes":60000}
```

The numeric values above are examples of the expected output format. Record the actual values in the PR description or release notes.

- [ ] **Step 6: Decide on SQL monthly aggregation**

Use the timing from Task 1:

- If `monthly_summary` is less than 15% of total request time, keep Node summarization and do not add SQL aggregation.
- If `monthly_summary` is 15% or more of total request time, create a follow-up plan to aggregate monthly buckets in SQL.
- If database query time dominates, run `EXPLAIN ANALYZE` for the timeline queries before changing application code again.

- [ ] **Step 7: Commit**

```bash
git add scripts/benchmark-planner-timeline.ts tests/whitebox/planner-benchmark-script.test.ts
git commit -m "chore: add planner timeline benchmark script"
```

## Validation Matrix

Run the smallest relevant checks after each task. Before marking the backend optimization complete, run:

```bash
npm run test -- tests/whitebox/planner-backend-observability.test.ts tests/whitebox/assignments-db-connection.test.ts tests/whitebox/planner-assignment-projection.test.ts tests/whitebox/planner-home-bootstrap-source.test.ts tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-home-bootstrap-hook.test.ts tests/whitebox/timeline-v2-bootstrap-source.test.ts tests/whitebox/timeline-query-indexes.test.ts tests/whitebox/home-backend-cleanup.test.ts tests/whitebox/planner-startup.test.ts tests/whitebox/planner-startup-retirement.test.ts tests/whitebox/planner-benchmark-script.test.ts
```

Then run:

```bash
npm run test
npm run build
```

Expected: all tests pass and production build completes.

## Rollout Strategy

- Keep `/api/planner/timeline` during the transition.
- Introduce `/api/planner/home-bootstrap` behind `NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP=true`.
- Compare response timing and payload bytes from both routes.
- Enable bootstrap first in local/staging.
- Enable bootstrap in production only after the benchmark shows lower initial latency and payload size.
- Remove old client query fan-out only after the bootstrap path has been stable through normal planning workflows.

## Stored Procedure Position

Do not start with stored procedures. The current backend can be salvaged with:

- connection pooling,
- timeline-specific SQL projections,
- pushed-down filters,
- targeted indexes,
- a compact BFF endpoint,
- measured bootstrap rollout.

Use PostgreSQL functions or stored procedures only if measured evidence shows the application layer is still spending meaningful time in monthly aggregation after the query and payload changes. If that happens, prefer a named SQL function for monthly bucket aggregation over a broad stored procedure that hides business logic and becomes difficult to test.

## Self-Review

- Spec coverage: The plan preserves split TimeTrack and Resource Planner sources, salvages the current backend, improves home page initial loading, addresses the earlier main problems, includes dead-code cleanup, and avoids premature stored procedures.
- Placeholder scan: No placeholder markers, no deferred validation language, and each task has concrete files, commands, expected results, and code snippets.
- Type consistency: `PlannerHomeBootstrapRequest`, `PlannerHomeBootstrapResponse`, `MinimalTimelineEmployee`, `MinimalTimelineProject`, and `MinimalTimelineBrand` are defined before use in route and hook tasks.
