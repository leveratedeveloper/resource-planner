import { assignmentsDb } from "@/lib/mysql-assignments/db";

export type EngagementRow = {
  assignment_uuid: string; employee_uuid: string; project_key: string;
  start_date: string; end_date: string; status: string; note: string | null;
  created_by: string | null; updated_by: string | null;
};
export type AllocationRow = { assignment_uuid: string; month: string; planned_hours: number; kind: string };

/** Fetch engagements (+ monthly allocations) in one windowed query.
 *  - employee_uuid / employee_uuids: scope by employee
 *  - project_key / project_keys: scope by project
 *  - rangeStart/rangeEnd (YYYY-MM-DD): keep only engagements overlapping the range
 *    and only allocations whose month falls in the range (omit for full set). */
export async function getEngagements(filters: {
  employee_uuid?: string;
  employee_uuids?: string[];
  project_key?: string;
  project_keys?: string[];
  rangeStart?: string;
  rangeEnd?: string;
}): Promise<{ engagements: EngagementRow[]; allocations: AllocationRow[] }> {
  const params: unknown[] = [];
  const add = (v: unknown) => { params.push(v); return `$${params.length}`; };

  const where: string[] = [];
  if (filters.employee_uuid) where.push(`e.employee_uuid = ${add(filters.employee_uuid)}`);
  if (filters.employee_uuids?.length) where.push(`e.employee_uuid IN (${filters.employee_uuids.map((u) => add(u)).join(",")})`);
  if (filters.project_key) where.push(`e.project_key = ${add(filters.project_key)}`);
  if (filters.project_keys?.length) where.push(`e.project_key IN (${filters.project_keys.map((k) => add(k)).join(",")})`);
  if (filters.rangeStart && filters.rangeEnd) {
    where.push(`e.end_date >= ${add(filters.rangeStart)}::date AND e.start_date <= ${add(filters.rangeEnd)}::date`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Allocation window lives in the JOIN condition (LEFT JOIN keeps engagements
  // with no allocation inside the window). Postgres binds $N positionally, so
  // these params being appended after the WHERE params is fine.
  const allocWindow = filters.rangeStart && filters.rangeEnd
    ? `AND a.month >= date_trunc('month', ${add(filters.rangeStart)}::date) AND a.month <= ${add(filters.rangeEnd)}::date`
    : "";

  const sql = `
    SELECT e.assignment_uuid, e.employee_uuid, e.project_key,
           to_char(e.start_date,'YYYY-MM-DD') AS start_date,
           to_char(e.end_date,'YYYY-MM-DD')   AS end_date,
           e.status, e.note, e.created_by, e.updated_by,
           to_char(a.month,'YYYY-MM-DD')       AS month,
           a.planned_hours::float              AS planned_hours,
           a.kind
    FROM planner_assignments e
    LEFT JOIN planner_assignment_allocations a
      ON a.assignment_uuid = e.assignment_uuid ${allocWindow}
    ${clause}
    ORDER BY e.assignment_uuid, a.month`;

  const [rows] = await assignmentsDb.execute(sql, params);

  const engagementsById = new Map<string, EngagementRow>();
  const allocations: AllocationRow[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    const id = r.assignment_uuid as string;
    if (!engagementsById.has(id)) {
      engagementsById.set(id, {
        assignment_uuid: id,
        employee_uuid: r.employee_uuid as string,
        project_key: r.project_key as string,
        start_date: r.start_date as string,
        end_date: r.end_date as string,
        status: r.status as string,
        note: (r.note as string | null) ?? null,
        created_by: (r.created_by as string | null) ?? null,
        updated_by: (r.updated_by as string | null) ?? null,
      });
    }
    if (r.month != null) {
      allocations.push({
        assignment_uuid: id,
        month: r.month as string,
        planned_hours: r.planned_hours as number,
        kind: r.kind as string,
      });
    }
  }
  return { engagements: [...engagementsById.values()], allocations };
}

/** Count engagements (assignments) per project_key — for the project-list cards. */
export async function getEngagementCountsByProjectKey(
  projectKeys: string[],
): Promise<Record<string, number>> {
  if (projectKeys.length === 0) return {};
  const ph = projectKeys.map((_, i) => `$${i + 1}`).join(",");
  const [rows] = await assignmentsDb.execute(
    `SELECT project_key, count(*)::int AS c
     FROM planner_assignments
     WHERE project_key IN (${ph})
     GROUP BY project_key`,
    projectKeys,
  );
  const out: Record<string, number> = {};
  for (const r of rows as Array<{ project_key: string; c: number }>) out[r.project_key] = r.c;
  return out;
}
