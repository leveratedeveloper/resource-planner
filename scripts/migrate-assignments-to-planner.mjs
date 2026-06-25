// One-time migration: translate legacy `assignments` rows into the new
// `planner_assignments` (engagement) + `planner_assignment_allocations` (monthly)
// model. No per-month source data exists, so each engagement's total is split
// EQUALLY across the months its span touches. Lossy by design (rounding +
// collapse of multi-row engagements). Transactional; re-running fails on the
// UNIQUE(employee_uuid, project_key) guard rather than duplicating.
import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// Dates pulled as text to avoid JS Date timezone drift. project_key resolved via
// the join (source_project_id is unique per project here — verified 0 fan-out).
const { rows } = await c.query(`
  SELECT a.employee_uuid,
         p.project_key,
         to_char(a.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(a.end_date,   'YYYY-MM-DD') AS end_date,
         a.total_hours, a.is_adjustment, a.status, a.note, a.created_by_uuid
  FROM assignments a
  JOIN planner_projects p ON p.source_project_id = a.project_uuid
  WHERE COALESCE(a.is_time_off, 0) = 0
`);

const byEngagement = new Map();
for (const r of rows) {
  const key = `${r.employee_uuid}::${r.project_key}`;
  if (!byEngagement.has(key)) byEngagement.set(key, []);
  byEngagement.get(key).push(r);
}

// Inclusive list of 'YYYY-MM-01' month-starts between two 'YYYY-MM-DD' strings.
const monthsBetween = (startStr, endStr) => {
  const [sy, sm] = startStr.split('-').map(Number);
  const [ey, em] = endStr.split('-').map(Number);
  const out = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
};
const round2 = (n) => Math.round(n * 100) / 100;

let engagements = 0, allocs = 0, totalIn = 0, totalOut = 0;
try {
  await c.query('BEGIN');
  for (const [, group] of byEngagement) {
    const employee_uuid = group[0].employee_uuid;
    const project_key = group[0].project_key;
    const startDate = group.map((g) => g.start_date).sort()[0];
    const endDate = group.map((g) => g.end_date).sort().at(-1);
    const status = group.some((g) => g.status === 'confirmed') ? 'confirmed' : (group[0].status || 'draft');
    const note = group.find((g) => g.note)?.note ?? null;
    const created_by = group.find((g) => g.created_by_uuid)?.created_by_uuid ?? null;
    const assignment_uuid = randomUUID();

    await c.query(
      `INSERT INTO planner_assignments
         (assignment_uuid, employee_uuid, project_key, start_date, end_date, status, note, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8, now(), now())`,
      [assignment_uuid, employee_uuid, project_key, startDate, endDate, status, note, created_by]
    );
    engagements++;

    for (const kind of ['plan', 'adjustment']) {
      const kindRows = group.filter((g) => (g.is_adjustment ? 'adjustment' : 'plan') === kind);
      const total = kindRows.reduce((s, g) => s + Number(g.total_hours ?? 0), 0);
      if (total <= 0) continue;
      totalIn += total;
      const months = monthsBetween(startDate, endDate);
      const per = round2(total / months.length);
      for (const m of months) {
        await c.query(
          `INSERT INTO planner_assignment_allocations (assignment_uuid, month, planned_hours, kind)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (assignment_uuid, month, kind) DO UPDATE SET planned_hours = EXCLUDED.planned_hours`,
          [assignment_uuid, m, per, kind]
        );
        allocs++; totalOut += per;
      }
    }
  }
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ROLLED BACK:', e);
  process.exit(1);
}

console.log({ engagements, allocs, totalIn: round2(totalIn), totalOut: round2(totalOut), drift: round2(totalOut - totalIn) });
await c.end();
