# TimeTrack Sync Write Batching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `full_backfill` complete reliably at current Timetrack scale by fixing the brand source mapping and splitting large planner-directory writes into safe, bounded batches.

**Architecture:** Keep the sync pipeline in three layers: fetch, normalize, and write. Normalize against the real Timetrack payload shape first, then upsert each planner-directory table in bounded chunks so PostgreSQL never receives one oversized multi-row statement. Preserve the current repository abstraction and idempotent upsert behavior; do not introduce an ORM or a COPY-based loader because the existing code already needs to work across MySQL-compatible local runs and PostgreSQL production runs.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL, MySQL compatibility layer, Vitest, existing planner-directory sync code.

---

## Current Evidence

The recent `full_backfill` run showed the real source volume we need to support:

- departments: `11`
- brands: `548`
- campaigns: `4476`
- pitches: `781`
- employees: `292`

That means project upserts can easily exceed several thousand parameters in one statement if we keep the current one-shot multi-row insert. The fix should therefore be parameter-budgeted batching, not a bigger single query.

---

## Scope Guardrails

- Do not rewrite the sync engine.
- Do not add a job queue.
- Do not introduce an ORM or a new database client.
- Do not change the sync route shape or the audit tables.
- Do not weaken the current idempotent upsert behavior.
- Keep the fix focused on the source mapping bug and the write batching bug.

---

## File Structure

- Modify: `lib/types/mysql.ts`
  - Align the brand source type with the real Timetrack payload shape by accepting `brand_id` as well as the legacy `id` field.
- Modify: `lib/planner-directory/timetrack-source.ts`
  - Fix brand normalization so it reads the real brand identifier from Timetrack.
  - Keep the source hash deterministic after the source-shape correction.
- Create: `lib/planner-directory/write-batches.ts`
  - Owns dialect-aware row batching and parameter-budget calculations for bulk upserts.
- Modify: `lib/planner-directory/repository.ts`
  - Uses the batching helper to split department, brand, project, and employee upserts into safe chunks.
  - Adds per-entity batch logs so the next failure shows where the write path stops.
- Modify: `lib/planner-directory/sync-engine.ts`
  - Adds a short summary log after normalization and before writes so the logs show the source counts and batch plan.
- Modify: `tests/whitebox/planner-directory-normalizers.test.ts`
  - Adds a regression test for the real brand payload shape.
- Create: `tests/whitebox/planner-directory-write-batches.test.ts`
  - Covers row chunking and parameter-budget calculations.
- Modify: `tests/whitebox/planner-directory-repository.test.ts`
  - Verifies large upserts are split into multiple queries instead of one giant statement.
- Modify: `tests/whitebox/planner-directory-sync-engine.test.ts`
  - Verifies the backfill summary still succeeds after the write batching change.

---

### Task 1: Fix The Brand Source Contract First

**Why this task exists:** the logs already show `brandIssues: 548`, which means every brand record is being treated as malformed. Before changing batching, the source mapping must understand the real Timetrack payload shape so the repository receives valid rows.

**Files:**
- Modify: `lib/types/mysql.ts`
- Modify: `lib/planner-directory/timetrack-source.ts`
- Modify: `tests/whitebox/planner-directory-normalizers.test.ts`

- [x] **Step 1: Write the failing regression test for real brand payloads**

Add a test that proves `normalizeBrandSource` can handle a Timetrack brand object that uses `brand_id` instead of `id`.

```ts
import { describe, expect, it } from "vitest";
import { normalizeBrandSource } from "@/lib/planner-directory/timetrack-source";

describe("planner directory normalizers", () => {
  it("normalizes brands from the real Timetrack payload shape", () => {
    const result = normalizeBrandSource({
      brand_id: 579,
      uuid: "d89fbfdf-7e32-4d02-865d-da53a9b05483",
      company_name: "PT Johnson & Johnson Indonesia",
      client_code: 1294,
      brand_name: "Neutrogena",
      brand_address: "K-LINK TOWER, Jakarta",
      pic_brand_name: "Margaretha Harjanti",
      pic_email: "mharja01@kenvue.com",
      brand_website: "-",
      pic_title: "Procurement",
      pic_brand_phone: "081311118457",
      pic_finance_name: "",
      pic_finance_phone: null,
      industry_category: "",
      description: "",
      logo: "",
      flag: "active",
      tax_account: "",
      top: null,
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z",
    } as never);

    expect(result?.brandId).toBe("579");
    expect(result?.sourceBrandId).toBe("579");
    expect(result?.sourceUuid).toBe("d89fbfdf-7e32-4d02-865d-da53a9b05483");
    expect(result?.name).toBe("Neutrogena");
  });
});
```

- [x] **Step 2: Run the test and verify it fails before the fix**

Run: `npm run test -- tests/whitebox/planner-directory-normalizers.test.ts`

Expected: FAIL because the current brand normalization still assumes the wrong identifier field.

- [x] **Step 3: Update the Timetrack brand type and normalization**

Change the source type so it accepts the real payload shape, then normalize from the actual Timetrack field:

```ts
export interface MySqlBrand {
  id?: number;
  brand_id?: number;
  uuid: string;
  company_name: string;
  client_code: string | number;
  brand_name: string;
  brand_address: string;
  pic_brand_name: string;
  pic_email: string;
  brand_website: string;
  pic_title: string;
  pic_brand_phone: string;
  pic_finance_name: string;
  pic_finance_phone: string | null;
  industry_category: string;
  description: string;
  logo: string;
  flag: "active" | "inactive";
  tax_account: string;
  top: string | null;
  created_at: string;
  updated_at: string;
}
```

```ts
const sourceBrandId = nullableString(record.brand_id ?? record.id);
if (!sourceBrandId) return null;

return {
  brandId: sourceBrandId,
  sourceBrandId,
  sourceUuid: nullableString(record.uuid),
  name: asString(record.brand_name || record.company_name || sourceBrandId),
  companyName: nullableString(record.company_name),
  color: nullableString(record.color),
  status: asString(record.flag || "active"),
  sourceUpdatedAt: nullableString(record.updated_at),
  sourceHash: hashRecord({
    brand_id: sourceBrandId,
    id: record.id ?? null,
    uuid: record.uuid ?? null,
    brand_name: record.brand_name ?? null,
    company_name: record.company_name ?? null,
    flag: record.flag ?? null,
    updated_at: record.updated_at ?? null,
  }),
  syncedAt: nowIso(),
  lastSeenAt: nowIso(),
  archivedAt: null,
};
```

- [x] **Step 4: Run the normalizer test and verify it passes**

Run: `npm run test -- tests/whitebox/planner-directory-normalizers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the source-contract fix**

```bash
git add lib/types/mysql.ts lib/planner-directory/timetrack-source.ts tests/whitebox/planner-directory-normalizers.test.ts
git commit -m "fix: normalize timetrack brand payloads"
```

---

### Task 2: Add Dialect-Aware Write Batching

**Why this task exists:** the current repository builds one multi-row insert per entity. That is fine for small tables, but it becomes brittle for the current Timetrack scale, especially for projects. The safer approach is a small helper that chunks rows based on column count and a conservative parameter budget, then lets the repository reuse the existing upsert logic per chunk.

**Files:**
- Create: `lib/planner-directory/write-batches.ts`
- Modify: `lib/planner-directory/repository.ts`
- Create: `tests/whitebox/planner-directory-write-batches.test.ts`
- Modify: `tests/whitebox/planner-directory-repository.test.ts`

- [x] **Step 1: Write the failing batching test**

Add a test that proves the batch helper limits rows per query based on the number of columns and the SQL dialect.

```ts
import { describe, expect, it } from "vitest";
import { chunkRowsForBatching, getPlannerDirectoryBatchSize } from "@/lib/planner-directory/write-batches";

describe("planner directory write batching", () => {
  it("caps PostgreSQL batches using a parameter budget", () => {
    expect(getPlannerDirectoryBatchSize({ columnCount: 20, dialect: "postgresql" })).toBeLessThanOrEqual(250);
    expect(getPlannerDirectoryBatchSize({ columnCount: 20, dialect: "postgresql" })).toBeGreaterThan(0);
  });

  it("splits large row sets into stable chunks", () => {
    const rows = Array.from({ length: 600 }, (_, index) => ({ id: index + 1 }));
    const chunks = chunkRowsForBatching(rows, 250);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(250);
    expect(chunks[1]).toHaveLength(250);
    expect(chunks[2]).toHaveLength(100);
  });
});
```

- [x] **Step 2: Run the batching test and verify it fails before the helper exists**

Run: `npm run test -- tests/whitebox/planner-directory-write-batches.test.ts`

Expected: FAIL because the batching helper does not exist yet.

- [x] **Step 3: Implement the batching helper**

Create a small helper that computes a safe batch size and splits rows into chunks. Keep the logic boring and explicit.

```ts
export type PlannerDirectoryDialect = "mysql" | "postgresql";

const DEFAULT_MAX_ROWS_PER_BATCH = 250;
const DEFAULT_MAX_PARAMS_PER_BATCH = 5000;

export function getPlannerDirectoryBatchSize(input: {
  columnCount: number;
  dialect: PlannerDirectoryDialect;
  maxRowsPerBatch?: number;
  maxParamsPerBatch?: number;
}): number {
  const maxRowsPerBatch = input.maxRowsPerBatch ?? DEFAULT_MAX_ROWS_PER_BATCH;
  const maxParamsPerBatch = input.maxParamsPerBatch ?? DEFAULT_MAX_PARAMS_PER_BATCH;
  const paramLimitedRows = Math.max(1, Math.floor(maxParamsPerBatch / input.columnCount));
  return Math.max(1, Math.min(maxRowsPerBatch, paramLimitedRows));
}

export function chunkRowsForBatching<T>(rows: T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    throw new Error("batchSize must be greater than zero");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }
  return chunks;
}
```

- [x] **Step 4: Wire the repository upserts through the helper**

Change each bulk writer to:

1. map source rows into DB rows
2. calculate a safe batch size from the number of columns
3. split the rows into chunks
4. build one `INSERT ... ON CONFLICT` statement per chunk
5. execute each chunk sequentially
6. sum the affected rows and return the total

Use the same pattern for departments, brands, projects, and employees so one large table never blocks the others.

```ts
const columnCount = Object.keys(mapProjectRow(rows[0])).length;
const batchSize = getPlannerDirectoryBatchSize({
  columnCount,
  dialect,
});
const batches = chunkRowsForBatching(rows.map(mapProjectRow), batchSize);

for (const batch of batches) {
  const statement = buildUpsertStatement("planner_projects", batch, ["project_key"], dialect);
  await db.query(statement.sql, statement.params);
}
```

- [x] **Step 5: Add repository regression tests for multi-query upserts**

Extend the repository test so a large project payload produces multiple `db.query` calls instead of one giant insert.

```ts
it("splits large project upserts into multiple queries", async () => {
  const db = createMockDb();
  const repository = createPlannerDirectoryRepository({
    db,
    now: () => "2026-06-05T00:00:00.000Z",
    syncRunIdFactory: () => "run-1",
    issueIdFactory: () => "issue-1",
  });

  const rows = Array.from({ length: 600 }, (_, index) => ({
    projectKey: `campaign:${index + 1}`,
    sourceProjectId: String(index + 1),
    sourceType: "campaign" as const,
    name: `Campaign ${index + 1}`,
    brandId: "9",
    color: null,
    status: "active",
    startDate: null,
    endDate: null,
    sourceUpdatedAt: "2026-06-05T00:00:00Z",
    sourceHash: `hash-${index + 1}`,
    syncedAt: "2026-06-05T00:00:00Z",
    lastSeenAt: "2026-06-05T00:00:00Z",
    archivedAt: null,
  }));

  await repository.upsertProjects(rows);

  const insertCalls = db.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO planner_projects"));
  expect(insertCalls.length).toBeGreaterThan(1);
});
```

- [x] **Step 6: Run the batching and repository tests and verify they pass**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-write-batches.test.ts tests/whitebox/planner-directory-repository.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the batching layer**

```bash
git add lib/planner-directory/write-batches.ts lib/planner-directory/repository.ts tests/whitebox/planner-directory-write-batches.test.ts tests/whitebox/planner-directory-repository.test.ts
git commit -m "fix: batch planner directory writes safely"
```

---

### Task 3: Verify The Real Full-Backfill Path Against Production-Scale Data

**Why this task exists:** the unit fixes need one end-to-end check against the real sync path. The goal is to prove that the source mapping fix and the write batching fix work together on the current Timetrack dataset size without the bind error returning.

**Files:**
- Modify: `tests/whitebox/planner-directory-sync-engine.test.ts`
- Modify: `lib/planner-directory/sync-engine.ts`

- [x] **Step 1: Add a sync-engine regression that uses Timetrack-like volumes**

Extend the sync-engine test with a source fixture that looks like the real dataset scale:

```ts
it("completes a full backfill at Timetrack scale", async () => {
  const source = createSource({
    departments: 11,
    brands: 548,
    campaigns: 4476,
    pitches: 781,
    employees: 292,
  });

  const { repository } = createRepository();
  const result = await runPlannerDirectorySync(
    {
      session: mockSession,
      syncMode: "full_backfill",
      triggerSource: "admin_route",
      triggeredBy: "employee-1",
    },
    { repository, source }
  );

  expect(result.status).toBe("succeeded");
  expect(result.brandsSeen).toBe(548);
  expect(result.projectsSeen).toBe(5257);
  expect(result.issueCount).toBe(0);
});
```

- [x] **Step 2: Add a short write-path summary log**

Log the normalized counts before writes so the next operator can see whether the problem is fetch, normalize, or write:

```ts
console.info("[Planner Directory Sync] Full backfill normalized counts", {
  departments: departments.rows.length,
  brands: brands.rows.length,
  campaigns: campaignSource.records.length,
  pitches: pitchSource.records.length,
  employees: employees.rows.length,
});
```

- [x] **Step 3: Run the sync-engine regression and the full whitebox suite**

Run:

```bash
npm run test -- tests/whitebox/planner-directory-sync-engine.test.ts tests/whitebox/planner-directory-normalizers.test.ts tests/whitebox/planner-directory-write-batches.test.ts tests/whitebox/planner-directory-repository.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the real full backfill through the admin API**

Call:

```http
POST /api/admin/planner-directory-sync
Content-Type: application/json

{
  "syncMode": "full_backfill"
}
```

Expected result:

- `departmentsSeen` should be non-zero
- `brandsSeen` should be non-zero
- `projectsSeen` should be `5257` if the source snapshot matches the log sample
- `issueCount` should drop from `548` brand issues to `0` or near-zero
- the PostgreSQL bind error should not return

- [ ] **Step 5: Verify the destination tables directly**

Run these checks in DBeaver after the API call succeeds:

```sql
SELECT COUNT(*) AS departments_count FROM planner_departments;
SELECT COUNT(*) AS brands_count FROM planner_brands;
SELECT COUNT(*) AS projects_count FROM planner_projects;
SELECT COUNT(*) AS employees_count FROM planner_employees;

SELECT status, employees_seen, departments_seen, brands_seen, projects_seen, issue_count
FROM planner_directory_sync_runs
ORDER BY started_at DESC
LIMIT 5;
```

- [ ] **Step 6: Commit the end-to-end validation**

```bash
git add lib/planner-directory/sync-engine.ts tests/whitebox/planner-directory-sync-engine.test.ts
git commit -m "test: cover large timetrack full backfill"
```

---

## Risks And Follow-Ups

- If PostgreSQL still fails after batching, the next likely issue is a type mismatch in one of the mapped columns, not the batch size itself.
- If brands still produce issues after the source fix, the next step is to inspect the actual `brand_id` and `uuid` values in the raw TimeTrack payload and compare them against the normalized row.
- If the full backfill succeeds but the planner UI still looks incomplete, then the missing data is likely in the planner read model, not the sync pipeline.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-timetrack-sync-write-batching.md`.

Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans with checkpoints.

Which approach?
