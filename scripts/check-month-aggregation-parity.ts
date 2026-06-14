/**
 * READ-ONLY parity check for Phase 8 SQL month aggregation.
 *
 * Runs fetchPlannerTimeline twice against the real DB — once with the TS
 * summarize path (PLANNER_SQL_MONTH_AGG=0), once with the SQL aggregation
 * path — and diffs the resulting month blocks. Pure SELECTs, no writes.
 *
 * Usage: npx tsx scripts/check-month-aggregation-parity.ts
 */
import { readFileSync } from "node:fs";

// DATABASE_URL must be set before the db module is imported.
if (!process.env.DATABASE_URL) {
  const env = readFileSync(".env.local", "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("DATABASE_URL not found in .env.local");
  process.env.DATABASE_URL = url;
}

const RANGE = { startDate: "2026-04-01", endDate: "2026-06-30" };
const TOLERANCE = 0.1 + 1e-9;

type Block = {
  id: string;
  totalHours: number | null;
  hoursPerDay: string;
  detailCount: number;
  startDate: string;
  endDate: string;
};

async function main() {
  const { fetchPlannerTimeline } = await import("../lib/query/server/planner-prefetch");
  const session = {
    access: { can_view_all: true },
    employee: { uuid: "parity-check" },
  } as never;
  const request = {
    viewMode: "quarter",
    resolution: "month",
    startDate: RANGE.startDate,
    endDate: RANGE.endDate,
    filters: { category: null, status: null },
  } as const;

  process.env.PLANNER_SQL_MONTH_AGG = "0";
  const t0 = performance.now();
  const tsResult = await fetchPlannerTimeline(session, request as never);
  const tsMs = Math.round(performance.now() - t0);

  process.env.PLANNER_SQL_MONTH_AGG = "1";
  const t1 = performance.now();
  const sqlResult = await fetchPlannerTimeline(session, request as never);
  const sqlMs = Math.round(performance.now() - t1);

  console.log(`TS path:  ${tsResult.assignments.length} blocks, ${tsResult.actualAssignments.length} actual blocks in ${tsMs} ms`);
  console.log(`SQL path: ${sqlResult.assignments.length} blocks, ${sqlResult.actualAssignments.length} actual blocks in ${sqlMs} ms`);

  diff("assignments", tsResult.assignments as unknown as Block[], sqlResult.assignments as unknown as Block[]);
  diff(
    "actuals",
    (tsResult.actualAssignments as never[]).map(toActualBlock),
    (sqlResult.actualAssignments as never[]).map(toActualBlock)
  );

  const { assignmentsDb } = await import("../lib/mysql-assignments/db");
  await assignmentsDb.end();
}

function toActualBlock(actual: { uuid: string; hoursPerDay: number; detailCount: number; startDate: string; endDate: string }): Block {
  return {
    id: actual.uuid,
    totalHours: actual.hoursPerDay,
    hoursPerDay: String(actual.hoursPerDay),
    detailCount: actual.detailCount,
    startDate: actual.startDate,
    endDate: actual.endDate,
  };
}

function diff(label: string, tsBlocks: Block[], sqlBlocks: Block[]) {
  const tsById = new Map(tsBlocks.map((b) => [b.id, b]));
  const sqlById = new Map(sqlBlocks.map((b) => [b.id, b]));

  const missing = [...tsById.keys()].filter((id) => !sqlById.has(id));
  const extra = [...sqlById.keys()].filter((id) => !tsById.has(id));

  let countMismatches = 0;
  let dateMismatches = 0;
  let maxDelta = 0;
  let overTolerance = 0;
  const samples: string[] = [];

  for (const [id, ts] of tsById) {
    const sql = sqlById.get(id);
    if (!sql) continue;
    if (ts.detailCount !== sql.detailCount) {
      countMismatches += 1;
      if (samples.length < 5) samples.push(`detailCount ${id}: ts=${ts.detailCount} sql=${sql.detailCount}`);
    }
    if (ts.startDate !== sql.startDate || ts.endDate !== sql.endDate) {
      dateMismatches += 1;
      if (samples.length < 5) samples.push(`dates ${id}: ts=${ts.startDate}..${ts.endDate} sql=${sql.startDate}..${sql.endDate}`);
    }
    const delta = Math.abs((ts.totalHours ?? 0) - (sql.totalHours ?? 0));
    maxDelta = Math.max(maxDelta, delta);
    if (delta > TOLERANCE) {
      overTolerance += 1;
      if (samples.length < 5) samples.push(`totalHours ${id}: ts=${ts.totalHours} sql=${sql.totalHours}`);
    }
  }

  console.log(`\n[${label}] matched ${tsById.size - missing.length}/${tsById.size} keys`);
  console.log(`  missing from SQL: ${missing.length}${missing.length ? ` e.g. ${missing.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`  extra in SQL:     ${extra.length}${extra.length ? ` e.g. ${extra.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`  detailCount mismatches: ${countMismatches}; date mismatches: ${dateMismatches}`);
  console.log(`  max totalHours delta: ${maxDelta.toFixed(4)} (over ±0.1: ${overTolerance})`);
  for (const sample of samples) console.log(`    ${sample}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
