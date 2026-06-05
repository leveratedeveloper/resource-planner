# TimeTrack Sync Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a non-blocking TimeTrack-to-Resource-Planner sync pipeline that keeps the Resource Planner local directory fresh without making login or planner startup feel heavy.

**Architecture:** TimeTrack stays the source of truth. Resource Planner keeps a planner-facing local directory snapshot for employees, departments, brands, and projects, and every planner read path uses that snapshot first. Sync work is separated into three modes: a full backfill for the first population, an incremental refresh for routine drift, and a targeted repair path for missing records. A single lease prevents duplicate sync runs when multiple users log in at the same time, and every run records freshness and issues so the UI can stay responsive even when TimeTrack is slow or temporarily unavailable. No database provisioning is in scope here; assume the RP tables already exist.

**Tech Stack:** Next.js App Router, TypeScript, existing TimeTrack API client, existing Resource Planner database layer, route handlers, Vitest.

---

## Scope Guardrails

- Do not create or migrate Resource Planner tables in this plan.
- Assume these tables already exist and are writable: `planner_departments`, `planner_brands`, `planner_projects`, `planner_employees`, `planner_directory_sync_runs`, `planner_directory_sync_issues`.
- Do not add synchronous TimeTrack metadata fetches to the login or planner startup critical path.
- Keep the current planner route contracts stable where possible, then swap the backing data source to the local directory snapshot.
- Prefer small, reversible changes over a rewrite of the whole planner.

---

## File Structure

- Create: `lib/planner-directory/types.ts`
  - Owns local directory record types, sync modes, sync status values, and metadata freshness shapes.
- Create: `lib/planner-directory/timetrack-source.ts`
  - Owns TimeTrack fetch functions and paginated source collection for departments, brands, projects, and employees.
- Create: `lib/planner-directory/normalizers.ts`
  - Converts raw TimeTrack records into planner directory rows and computes deterministic project keys.
- Create: `lib/planner-directory/repository.ts`
  - Owns local RP reads, upserts, archive handling, sync run writes, and sync issue writes.
- Create: `lib/planner-directory/freshness.ts`
  - Calculates freshness state from local timestamps and sync runs.
- Create: `lib/planner-directory/sync-lease.ts`
  - Owns the single-active-sync guard so concurrent triggers do not duplicate work.
- Create: `lib/planner-directory/sync-engine.ts`
  - Runs full backfill, incremental refresh, and targeted repair flows.
- Create: `lib/planner-directory/sync-trigger.ts`
  - Turns freshness checks into queued or skipped sync requests without blocking the caller.
- Create: `lib/planner-directory/repair.ts`
  - Handles targeted repair requests for missing employees, departments, brands, or projects.
- Create: `app/api/admin/planner-directory-sync/route.ts`
  - Exposes a manual trigger for admins or scheduled jobs to start sync safely.
- Modify: `app/api/auth/login/route.ts`
  - Replaces any idea of live metadata refresh on login with a cheap freshness check and a non-blocking sync request.
- Modify: `lib/query/server/planner-home-bootstrap.ts`
  - Switches bootstrap metadata assembly to the local directory snapshot.
- Modify: `app/api/employees/route.ts`
  - Reads from the local planner employee directory instead of TimeTrack for planner-facing employee lists.
- Modify: `app/api/brands/route.ts`
  - Reads from the local planner brand directory instead of TimeTrack for planner-facing brand lists.
- Modify: `app/api/projects/route.ts`
  - Reads local planner projects for project listing and pagination.
- Modify: `app/api/projects/summary/route.ts`
  - Reads local planner projects for summary options and brand/project filters.
- Modify: `lib/employees/ordered-directory.ts`
  - Stops building planner employee slices directly from live TimeTrack metadata when the local directory is available.
- Modify: `lib/projects/project-summary-fetcher.ts`
  - Stops treating TimeTrack as the default source for summary metadata when the local directory already has the data.
- Modify: `tests/whitebox/planner-startup.test.ts`
  - Guards the startup contract so planner bootstrap stays free of live metadata fanout.
- Modify: `tests/whitebox/planner-home-bootstrap-route.test.ts`
  - Guards the bootstrap route so it uses the new local-directory-backed composer.
- Create: `tests/whitebox/planner-directory-types.test.ts`
  - Covers deterministic directory types and helper contracts.
- Create: `tests/whitebox/planner-directory-normalizers.test.ts`
  - Covers TimeTrack-to-directory normalization.
- Create: `tests/whitebox/planner-directory-repository.test.ts`
  - Covers local reads, upserts, archive semantics, and issue writes.
- Create: `tests/whitebox/planner-directory-sync-engine.test.ts`
  - Covers full backfill, incremental refresh, and repair execution.
- Create: `tests/whitebox/planner-directory-lease.test.ts`
  - Covers the single-active-sync guard.
- Create: `tests/whitebox/planner-directory-trigger.test.ts`
  - Covers non-blocking trigger behavior.
- Create: `tests/blackbox/planner-directory-read-path.test.ts`
  - Covers the planner-facing API contract after the read path switches to the local directory snapshot.

---

## Task 1: Define The Planner Directory Contract First

**Why this task exists:** the sync engine, the repository, the bootstrap composer, and the planner routes all need the same idea of what a local directory row is. If this contract is unstable, later tasks will drift and force rewrites.

**Files:**
- Create: `lib/planner-directory/types.ts`
- Create: `tests/whitebox/planner-directory-types.test.ts`

- [x] **Step 1: Write failing tests for the directory contract**

Add tests that prove the following contract decisions:

- `planner_projects` uses a deterministic `projectKey` derived from `sourceType + sourceId`.
- `sourceType` is limited to `campaign` and `pitch`.
- `syncMode` is limited to `full_backfill`, `incremental_refresh`, and `targeted_repair`.
- `syncStatus` is limited to `queued`, `running`, `succeeded`, `failed`, and `skipped`.
- `freshnessState` is limited to `healthy`, `stale`, `syncing`, and `unavailable`.

Example shape:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPlannerProjectKey,
  isPlannerProjectSourceType,
  isPlannerSyncMode,
} from "@/lib/planner-directory/types";

describe("planner directory types", () => {
  it("builds deterministic project keys", () => {
    expect(buildPlannerProjectKey("campaign", "abc-123")).toBe("campaign:abc-123");
    expect(buildPlannerProjectKey("pitch", "abc-123")).toBe("pitch:abc-123");
  });
});
```

- [x] **Step 2: Run the new type tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-types.test.ts
```

Expected: FAIL because the type helpers do not exist yet.

- [x] **Step 3: Implement the minimal contract in `types.ts`**

Add the exact exported types and helpers the later tasks will reuse. Keep this file small and boring. Do not place database logic here.

```ts
export type PlannerDirectorySourceType = "campaign" | "pitch";
export type PlannerSyncMode = "full_backfill" | "incremental_refresh" | "targeted_repair";
export type PlannerSyncStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type PlannerFreshnessState = "healthy" | "stale" | "syncing" | "unavailable";

export function buildPlannerProjectKey(sourceType: PlannerDirectorySourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}
```

- [x] **Step 4: Run the type tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-types.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit the contract layer**

Use a small commit so the rest of the pipeline can build on a stable type boundary.

```bash
git add lib/planner-directory/types.ts tests/whitebox/planner-directory-types.test.ts
git commit -m "feat: define planner directory contract"
```

---

## Task 2: Normalize TimeTrack Data Into Planner Rows

**Why this task exists:** the sync engine should not know TimeTrack field quirks. It should receive normalized planner rows and only deal with upserts, archiving, and issues. That keeps the sync logic maintainable and makes source changes easier to absorb later.

**Files:**
- Create: `lib/planner-directory/timetrack-source.ts`
- Create: `lib/planner-directory/normalizers.ts`
- Create: `tests/whitebox/planner-directory-normalizers.test.ts`

- [x] **Step 1: Write failing tests for source normalization**

Cover these cases:

- Departments map `id`, `department_name`, `flag`, `created_at`, and `updated_at` into planner rows.
- Brands map `id`, `uuid`, `brand_name`, `company_name`, `flag`, and `updated_at` into planner rows.
- Campaigns and pitches both become planner projects, but they keep different `sourceType` values and different `projectKey` values.
- Employees map `uuid`, `full_name`, `nickname`, `position`, `dept_id`, `status`, `flag`, `photo`, `work_start_date`, and `updated_at` into planner rows.
- Missing brand references produce an issue object instead of crashing the entire normalization pass.
- Duplicate source IDs are rejected early so the repository never gets ambiguous data.

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { normalizeProjectRecord } from "@/lib/planner-directory/normalizers";

describe("planner directory normalizers", () => {
  it("normalizes campaign and pitch records into distinct project keys", () => {
    expect(normalizeProjectRecord({ sourceType: "campaign", sourceId: "42", name: "A", brandId: "9" }).projectKey)
      .toBe("campaign:42");
    expect(normalizeProjectRecord({ sourceType: "pitch", sourceId: "42", name: "A", brandId: "9" }).projectKey)
      .toBe("pitch:42");
  });
});
```

- [x] **Step 2: Run the normalizer tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-normalizers.test.ts
```

Expected: FAIL because the normalizer helpers do not exist yet.

- [x] **Step 3: Implement the TimeTrack source fetchers**

Add fetchers in `timetrack-source.ts` that collect the source data with pagination and keep the fetch layer separate from the normalization layer.

The fetch layer should:

- page through departments, brands, campaigns, pitches, and employees
- keep retry behavior isolated here if the current TimeTrack client already supports it
- avoid any RP database writes
- return raw source records plus `fetchedAt`

- [x] **Step 4: Implement the normalizers**

Add `normalizeDepartmentRecord`, `normalizeBrandRecord`, `normalizeProjectRecord`, and `normalizeEmployeeRecord` in `normalizers.ts`.

The normalizers should:

- coerce empty or missing optional fields to `null`
- preserve source timestamps
- derive planner-local keys deterministically
- report soft issues for missing relationships instead of throwing on the first bad row

- [x] **Step 5: Run the normalizer tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-normalizers.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit the source-normalization layer**

```bash
git add lib/planner-directory/timetrack-source.ts lib/planner-directory/normalizers.ts tests/whitebox/planner-directory-normalizers.test.ts
git commit -m "feat: normalize timetrack directory data"
```

---

## Task 3: Build The Sync Engine For Full, Incremental, And Repair Modes

**Why this task exists:** the local directory must be populated once, kept current afterward, and repaired when a planner read discovers a missing record. If these three paths are split across unrelated code, the system will be hard to reason about and harder to debug.

**Files:**
- Create: `lib/planner-directory/repository.ts`
- Create: `lib/planner-directory/sync-engine.ts`
- Create: `lib/planner-directory/repair.ts`
- Create: `tests/whitebox/planner-directory-repository.test.ts`
- Create: `tests/whitebox/planner-directory-sync-engine.test.ts`

- [x] **Step 1: Write failing repository tests**

Cover these repository behaviors:

- `upsertDepartments`, `upsertBrands`, `upsertProjects`, and `upsertEmployees` update existing rows instead of duplicating them.
- `markMissingAsArchived` marks records not seen in the current run rather than deleting them.
- `createSyncRun` writes a run record with the expected `syncMode`, `status`, and counts.
- `addSyncIssue` stores issue severity, source id, and payload.
- `getLatestSuccessfulSync` returns the newest successful run and its timestamp.

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { createSyncRun } from "@/lib/planner-directory/repository";

describe("planner directory repository", () => {
  it("creates a queued sync run with zero counts", async () => {
    const run = await createSyncRun({ syncMode: "full_backfill", triggerSource: "manual" });

    expect(run.status).toBe("queued");
    expect(run.syncMode).toBe("full_backfill");
    expect(run.employeesSeen).toBe(0);
  });
});
```

- [x] **Step 2: Run the repository tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-repository.test.ts
```

Expected: FAIL because the repository functions do not exist yet.

- [x] **Step 3: Implement the repository layer**

Add the actual RP database access in `repository.ts`.

The repository should own:

- read methods for planner directory lists and lookup-by-id operations
- bulk upserts for departments, brands, projects, and employees
- run record writes
- issue record writes
- archive/stale marking
- freshness timestamps

Keep the SQL close to the repository. Do not let the sync engine build SQL strings directly.

- [x] **Step 4: Write failing sync-engine tests**

Cover these cases:

- full backfill upserts every normalized source record and archives unseen rows
- incremental refresh only updates changed rows when source timestamps or hashes differ
- repair mode only touches the requested entity scope
- one bad source record produces a sync issue but does not abort the whole run
- repeated runs are idempotent

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { runPlannerDirectorySync } from "@/lib/planner-directory/sync-engine";

describe("planner directory sync engine", () => {
  it("returns a successful run summary for a full backfill", async () => {
    const result = await runPlannerDirectorySync({ syncMode: "full_backfill", triggerSource: "manual" });

    expect(result.status).toBe("succeeded");
    expect(result.employeesUpserted).toBeGreaterThanOrEqual(0);
  });
});
```

- [x] **Step 5: Run the sync-engine tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-sync-engine.test.ts
```

Expected: FAIL because the engine does not exist yet.

- [x] **Step 6: Implement the sync engine**

Add `runPlannerDirectorySync` with a shape like this:

```ts
type RunPlannerDirectorySyncInput = {
  syncMode: "full_backfill" | "incremental_refresh" | "targeted_repair";
  triggerSource: "manual" | "login" | "bootstrap" | "schedule";
  scope?: {
    employeeUuid?: string;
    brandId?: string;
    projectKey?: string;
    departmentId?: string;
  };
};
```

The engine should:

- create a `queued` run record first, then transition it to `running`
- fetch raw source data only after the run exists
- normalize before writing
- write issue rows for bad source records
- commit or finalize counts only after all bulk writes finish
- mark the run `succeeded` even when some non-fatal issues were recorded
- mark the run `failed` only when the engine itself cannot continue

- [x] **Step 7: Implement repair mode**

Add a targeted repair path that can fetch one employee, brand, project, or department when a planner read encounters a missing reference.

The repair path should:

- re-use the same normalization code
- write a focused sync run with `syncMode = targeted_repair`
- never block the caller from rendering the rest of the planner

- [x] **Step 8: Run the sync-engine tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-repository.test.ts tests/whitebox/planner-directory-sync-engine.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit the engine layer**

```bash
git add lib/planner-directory/repository.ts lib/planner-directory/sync-engine.ts lib/planner-directory/repair.ts tests/whitebox/planner-directory-repository.test.ts tests/whitebox/planner-directory-sync-engine.test.ts
git commit -m "feat: add planner directory sync engine"
```

---

## Task 4: Prevent Duplicate Sync Runs And Keep Login Non-Blocking

**Why this task exists:** the user specifically cares about the experience not feeling heavier. If login can start sync work directly, two simultaneous logins can stampede the pipeline and turn a background maintenance task into a visible user-facing slowdown. The fix is a cheap freshness check plus a single active lease.

**Files:**
- Create: `lib/planner-directory/sync-lease.ts`
- Create: `lib/planner-directory/sync-trigger.ts`
- Create: `app/api/admin/planner-directory-sync/route.ts`
- Modify: `app/api/auth/login/route.ts`
- Create: `tests/whitebox/planner-directory-lease.test.ts`
- Create: `tests/whitebox/planner-directory-trigger.test.ts`

- [x] **Step 1: Write failing lease tests**

Cover these behaviors:

- if a lease is already held, a second acquisition returns `already_running`
- the lease expires after its TTL
- a released lease can be acquired again

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { acquirePlannerDirectoryLease } from "@/lib/planner-directory/sync-lease";

describe("planner directory lease", () => {
  it("prevents a second sync from starting while the first lease is active", async () => {
    const first = await acquirePlannerDirectoryLease("manual");
    const second = await acquirePlannerDirectoryLease("login");

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(second.reason).toBe("already_running");
  });
});
```

- [x] **Step 2: Run the lease tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-lease.test.ts
```

Expected: FAIL because the lease helper does not exist yet.

- [x] **Step 3: Implement the single-active-sync lease**

Use a database-backed lease with a TTL, not an in-memory singleton. In-memory guarding is not enough if the app runs in more than one process.

The lease should:

- record owner, source, and expiry
- refuse a new acquisition while the lease is valid
- allow a new acquisition after expiry
- always release in a `finally` block when the sync completes

- [x] **Step 4: Write failing trigger tests**

Cover these behaviors:

- a stale freshness check queues a sync request instead of running the sync inline
- a fresh directory skips the sync request
- the trigger returns immediately and does not await the full engine result

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { requestPlannerDirectorySyncIfStale } from "@/lib/planner-directory/sync-trigger";

describe("planner directory trigger", () => {
  it("queues a sync request without running the engine inline", async () => {
    const result = await requestPlannerDirectorySyncIfStale({ freshnessState: "stale" });

    expect(result.action).toBe("queued");
    expect(result.waitedForSync).toBe(false);
  });
});
```

- [x] **Step 5: Run the trigger tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-trigger.test.ts
```

Expected: FAIL because the trigger helper does not exist yet.

- [x] **Step 6: Implement the trigger and admin route**

Add a non-blocking trigger helper that:

- checks freshness first
- creates or updates a queued sync record if the snapshot is stale
- returns immediately if a sync is already running
- never executes the full sync engine inline in the login request

Expose a manual admin route so scheduled jobs or operators can drain the queue.

The login route should only:

- finish authentication
- create the session
- perform a cheap freshness check
- enqueue a sync request if stale
- return the login response without waiting for sync completion

Do not let the login route become the place where the sync work actually happens.

- [x] **Step 7: Run the lease and trigger tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-lease.test.ts tests/whitebox/planner-directory-trigger.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit the coordination layer**

```bash
git add lib/planner-directory/sync-lease.ts lib/planner-directory/sync-trigger.ts app/api/admin/planner-directory-sync/route.ts app/api/auth/login/route.ts tests/whitebox/planner-directory-lease.test.ts tests/whitebox/planner-directory-trigger.test.ts
git commit -m "feat: add non-blocking planner directory sync trigger"
```

---

## Task 5: Switch Planner Reads To The Local Directory Snapshot

**Why this task exists:** syncing data is not enough if the planner still asks TimeTrack for the same metadata at startup. This is the point where the user experience benefit becomes real.

**Files:**
- Modify: `lib/query/server/planner-home-bootstrap.ts`
- Modify: `app/api/employees/route.ts`
- Modify: `app/api/brands/route.ts`
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/summary/route.ts`
- Modify: `lib/employees/ordered-directory.ts`
- Modify: `lib/projects/project-summary-fetcher.ts`
- Modify: `tests/whitebox/planner-home-bootstrap-route.test.ts`
- Modify: `tests/whitebox/planner-startup.test.ts`
- Create: `tests/blackbox/planner-directory-read-path.test.ts`

- [x] **Step 1: Write failing tests for the read-path switch**

Cover these checks:

- home bootstrap assembles employees, brands, and projects from the local directory repository
- the planner-facing employee route no longer depends on live TimeTrack metadata for the normal case
- the planner-facing brand and project routes do not fan out to TimeTrack when the local directory already has the rows
- the startup path no longer requires a live TimeTrack metadata round trip before it can render the planner shell

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("planner home bootstrap route", () => {
  it("uses the local directory composer in the bootstrap path", () => {
    const source = readFileSync("app/api/planner/home-bootstrap/route.ts", "utf8");

    expect(source).toContain("fetchPlannerHomeBootstrap");
    expect(source).not.toContain("fetchProjectSummaries({");
  });
});
```

- [x] **Step 2: Run the read-path tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-startup.test.ts tests/blackbox/planner-directory-read-path.test.ts
```

Expected: FAIL until the server-side reads are moved onto the local snapshot.

- [x] **Step 3: Implement the local-directory-backed bootstrap composer**

Update `lib/query/server/planner-home-bootstrap.ts` so it reads from the repository layer instead of fetching employee slices, brand summaries, and project summaries from live TimeTrack for the normal path.

The bootstrap response should keep the same high-level shape, but the source behind it should change:

- employees from `planner_employees`
- brands from `planner_brands`
- projects from `planner_projects`
- metadata freshness from the local sync state

Only fall back to live TimeTrack data when the local record is missing and the repair path has not yet filled the gap.

- [x] **Step 4: Switch the planner-facing API routes to the local snapshot**

Update the employee, brand, project, and project-summary routes so they read from the local directory tables first.

Keep the public response shape stable so the React hooks do not need a large refactor.

If a route needs fallback behavior:

- render the local rows immediately
- record a sync issue
- kick off targeted repair
- do not block the response

- [x] **Step 5: Remove the direct TimeTrack dependency from the common planner startup path**

Update the planner startup helpers so the first usable render no longer waits on metadata fetches that could have been cached locally.

This is the point where the user stops paying the cost of the sync system during normal use.

- [x] **Step 6: Run the read-path tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-startup.test.ts tests/blackbox/planner-directory-read-path.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit the read-path switch**

```bash
git add lib/query/server/planner-home-bootstrap.ts app/api/employees/route.ts app/api/brands/route.ts app/api/projects/route.ts app/api/projects/summary/route.ts lib/employees/ordered-directory.ts lib/projects/project-summary-fetcher.ts tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-startup.test.ts tests/blackbox/planner-directory-read-path.test.ts
git commit -m "feat: read planner metadata from local directory snapshot"
```

---

## Task 6: Add Freshness Reporting And Targeted Repair Without Blocking The UI

**Why this task exists:** the planner needs to know whether it is reading healthy local metadata, stale metadata, or actively syncing. The user should still get a usable page either way. Missing rows should self-heal in the background instead of breaking the timeline.

**Files:**
- Create: `lib/planner-directory/freshness.ts`
- Modify: `lib/query/server/planner-home-bootstrap.ts`
- Modify: `app/api/planner/home-bootstrap/route.ts`
- Modify: `components/timeline-v2/TimelineDataStatusV2.tsx`
- Create: `tests/whitebox/planner-directory-freshness.test.ts`
- Create: `tests/whitebox/planner-directory-repair.test.ts`

- [x] **Step 1: Write failing freshness tests**

Cover these cases:

- a recent successful run is `healthy`
- a stale last-successful timestamp becomes `stale`
- a currently running sync becomes `syncing`
- no successful run yet becomes `unavailable`

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { classifyPlannerDirectoryFreshness } from "@/lib/planner-directory/freshness";

describe("planner directory freshness", () => {
  it("marks an old snapshot as stale", () => {
    expect(
      classifyPlannerDirectoryFreshness({
        lastSuccessfulSyncAt: "2026-06-05T00:00:00.000Z",
        now: "2026-06-05T00:20:00.000Z",
      }).state
    ).toBe("stale");
  });
});
```

- [x] **Step 2: Run the freshness tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-freshness.test.ts
```

Expected: FAIL because the freshness helper does not exist yet.

- [x] **Step 3: Implement freshness classification**

Add a threshold-based freshness helper that can tell the bootstrap response and the UI whether the directory is healthy, stale, syncing, or unavailable.

Use the helper to populate metadata fields in the bootstrap response rather than inventing a second freshness model in the UI.

- [x] **Step 4: Write failing repair tests**

Cover these cases:

- missing employee/project/brand/dept references write a repair request instead of blocking the planner
- repair requests are idempotent for the same source id
- a repair request does not overwrite a good local row with null data

Example shape:

```ts
import { describe, expect, it } from "vitest";
import { requestPlannerDirectoryRepair } from "@/lib/planner-directory/repair";

describe("planner directory repair", () => {
  it("queues a targeted repair for a missing project reference", async () => {
    const result = await requestPlannerDirectoryRepair({ entityType: "project", sourceId: "abc-123" });

    expect(result.status).toBe("queued");
  });
});
```

- [x] **Step 5: Run the repair tests and verify they fail**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-repair.test.ts
```

Expected: FAIL because the repair helper does not exist yet.

- [x] **Step 6: Implement repair and freshness plumbing**

Add the repair helper and wire it into the repository and sync engine so missing references can heal themselves without breaking the page.

Expose freshness in the bootstrap response so the UI can show a small status message like `syncing`, `stale`, or `showing saved planner data` without blocking the rest of the shell.

- [x] **Step 7: Update the status UI only if the new freshness states need a new label**

If the current `TimelineDataStatusV2` labels already cover the new states, leave it alone. If not, update the labels minimally so the planner can communicate that local data is healthy or stale without making the page feel heavier.

- [x] **Step 8: Run the freshness and repair tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-freshness.test.ts tests/whitebox/planner-directory-repair.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit the freshness and repair layer**

```bash
git add lib/planner-directory/freshness.ts lib/planner-directory/repair.ts lib/query/server/planner-home-bootstrap.ts app/api/planner/home-bootstrap/route.ts components/timeline-v2/TimelineDataStatusV2.tsx tests/whitebox/planner-directory-freshness.test.ts tests/whitebox/planner-directory-repair.test.ts
git commit -m "feat: add planner directory freshness and repair"
```

---

## Task 7: Verify That Sync Does Not Disturb The User Experience

**Why this task exists:** the whole point of the change is to keep the UI fast and stable. This is the proof step. If the sync pipeline is technically correct but still makes login or first render feel heavy, the plan failed.

**Files:**
- Modify: `tests/whitebox/planner-directory-trigger.test.ts`
- Modify: `tests/whitebox/planner-home-bootstrap-route.test.ts`
- Modify: `tests/whitebox/planner-startup.test.ts`
- Create: `tests/whitebox/planner-directory-performance-contract.test.ts`

- [x] **Step 1: Write a contract test for non-blocking login behavior**

Cover the source-level guarantee that the login route does not await the full sync engine.

Example shape:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner directory performance contract", () => {
  it("does not await the sync engine in the login route", () => {
    const source = readFileSync("app/api/auth/login/route.ts", "utf8");

    expect(source).toContain("requestPlannerDirectorySyncIfStale");
    expect(source).not.toContain("await runPlannerDirectorySync");
  });
});
```

- [x] **Step 2: Run the contract test and verify it fails if the login route still blocks**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-performance-contract.test.ts
```

Expected: FAIL until the login route uses the non-blocking trigger only.

- [x] **Step 3: Add a bootstrap contract test for local directory reads**

The bootstrap composer should be forced to use the local directory repository in its normal path, so a future refactor does not quietly reintroduce TimeTrack reads.

- [x] **Step 4: Run the full targeted sync test set**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-types.test.ts tests/whitebox/planner-directory-normalizers.test.ts tests/whitebox/planner-directory-repository.test.ts tests/whitebox/planner-directory-sync-engine.test.ts tests/whitebox/planner-directory-lease.test.ts tests/whitebox/planner-directory-trigger.test.ts tests/whitebox/planner-directory-freshness.test.ts tests/whitebox/planner-directory-repair.test.ts tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-startup.test.ts tests/whitebox/planner-directory-performance-contract.test.ts
```

Expected: PASS.

- [x] **Step 5: Run the app-level validation**

Run:

```bash
npm run build
```

Expected: PASS.

If the app has a fast local smoke path, also verify the planner loads normally after login and the directory status stays non-blocking while the sync runs in the background.

- [x] **Step 6: Commit the verification layer**

```bash
git add tests/whitebox/planner-directory-performance-contract.test.ts tests/whitebox/planner-home-bootstrap-route.test.ts tests/whitebox/planner-startup.test.ts
git commit -m "test: lock planner directory non-blocking contract"
```

---

## Definition Of Done

- The planner can render from the local directory snapshot without waiting on live TimeTrack metadata in the normal path.
- Login can request or queue sync work without waiting for the sync to finish.
- Two users logging in at the same time do not start two competing sync runs.
- Full backfill, incremental refresh, and targeted repair all use the same normalization and repository layers.
- Missing or stale metadata does not break the planner; it is either repaired or rendered with a clear freshness state.
- The targeted tests and the build pass.

---

## Main Risks

- If TimeTrack does not support `updated_since`, incremental sync will fall back to paginated scans plus `updated_at` or source hash comparison.
- If the deployment is serverless without a durable background worker, the trigger layer must stay isolated so a future cron or worker can drive it without changing the sync engine.
- If any planner route still reads TimeTrack directly, the user will still feel the old bottleneck, so the read-path switch must land together with the sync engine.

