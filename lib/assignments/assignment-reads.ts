import { assignmentsDb } from "@/lib/mysql-assignments/db";

export type EngagementRow = {
  assignment_uuid: string; employee_uuid: string; project_key: string;
  start_date: string; end_date: string; status: string; note: string | null;
  created_by: string | null; updated_by: string | null;
};
export type AllocationRow = { assignment_uuid: string; month: string; planned_hours: number; kind: string };

/** Fetch engagements (optionally filtered) plus all their monthly allocation rows. */
export async function getEngagements(filters: {
  employee_uuid?: string; project_key?: string; project_keys?: string[];
}): Promise<{ engagements: EngagementRow[]; allocations: AllocationRow[] }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.employee_uuid) { params.push(filters.employee_uuid); where.push(`employee_uuid = $${params.length}`); }
  if (filters.project_key) { params.push(filters.project_key); where.push(`project_key = $${params.length}`); }
  if (filters.project_keys?.length) {
    const start = params.length;
    filters.project_keys.forEach((k) => params.push(k));
    where.push(`project_key IN (${filters.project_keys.map((_, i) => `$${start + i + 1}`).join(",")})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  // Dates are returned as YYYY-MM-DD text (not Date/ISO) so the client never has
  // to fight timezone-shifted timestamps; planned_hours is cast to float so it
  // arrives as a real number (Postgres numeric otherwise serializes as a string).
  const [engagements] = await assignmentsDb.execute(
    `SELECT assignment_uuid, employee_uuid, project_key,
            to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date,
            status, note, created_by, updated_by
     FROM planner_assignments ${clause}`,
    params
  );
  const ids = (engagements as EngagementRow[]).map((e) => e.assignment_uuid);
  let allocations: AllocationRow[] = [];
  if (ids.length) {
    const ph = ids.map((_, i) => `$${i + 1}`).join(",");
    const [allocs] = await assignmentsDb.execute(
      `SELECT assignment_uuid,
              to_char(month, 'YYYY-MM-DD') AS month,
              planned_hours::float AS planned_hours,
              kind
       FROM planner_assignment_allocations WHERE assignment_uuid IN (${ph}) ORDER BY month`,
      ids
    );
    allocations = allocs as AllocationRow[];
  }
  return { engagements: engagements as EngagementRow[], allocations };
}
