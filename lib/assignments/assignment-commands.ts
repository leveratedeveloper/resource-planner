import { assignmentsDb } from "@/lib/mysql-assignments/db";
import { randomUUID } from "crypto";
import { splitTotalAcrossMonths } from "./split";

export type AllocRow = { month: string; plannedHours: number; kind: "plan" | "adjustment" };

export function buildAllocationRows(monthlyHours: Record<string, number>, kind: "plan" | "adjustment"): AllocRow[] {
  return Object.entries(monthlyHours)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, plannedHours]) => ({ month, plannedHours, kind }));
}

export type UpsertAssignmentInput = {
  employeeUuid: string;
  projectKey: string;
  span: { startDate: string; endDate: string };
  monthlyHours: Record<string, number>;
  status?: "draft" | "confirmed";
  note?: string | null;
  kind?: "plan" | "adjustment";
  mode?: "replace" | "merge";
  actingUserUuid: string | null;
};

/** THE write primitive. Upserts the engagement header + its monthly allocations, transactionally. */
export async function upsertAssignment(input: UpsertAssignmentInput): Promise<string> {
  const { employeeUuid, projectKey, span, monthlyHours, actingUserUuid } = input;
  const kind = input.kind ?? "plan";
  const mode = input.mode ?? "replace";
  const status = input.status ?? "draft";
  const rows = buildAllocationRows(monthlyHours, kind);

  const client = await assignmentsDb.getConnection();
  // Cast to the Postgres-flavoured shape: client.query() returns { rows: any[] }
  const pgClient = client as { query(sql: string, params?: any[]): Promise<{ rows: any[] }>; release(): Promise<void> };
  try {
    await pgClient.query("BEGIN");
    const existing = await pgClient.query(
      `SELECT assignment_uuid FROM planner_assignments WHERE employee_uuid=$1 AND project_key=$2`,
      [employeeUuid, projectKey]
    );
    let assignmentUuid: string;
    if (existing.rows[0]) {
      assignmentUuid = existing.rows[0].assignment_uuid;
      await pgClient.query(
        `UPDATE planner_assignments SET start_date=$1, end_date=$2, status=$3, note=$4, updated_by=$5, updated_at=now() WHERE assignment_uuid=$6`,
        [span.startDate, span.endDate, status, input.note ?? null, actingUserUuid, assignmentUuid]
      );
    } else {
      assignmentUuid = randomUUID();
      await pgClient.query(
        `INSERT INTO planner_assignments (assignment_uuid, employee_uuid, project_key, start_date, end_date, status, note, created_by, updated_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8, now(), now())`,
        [assignmentUuid, employeeUuid, projectKey, span.startDate, span.endDate, status, input.note ?? null, actingUserUuid]
      );
    }
    if (mode === "replace") {
      await pgClient.query(`DELETE FROM planner_assignment_allocations WHERE assignment_uuid=$1 AND kind=$2`, [assignmentUuid, kind]);
    }
    for (const r of rows) {
      await pgClient.query(
        `INSERT INTO planner_assignment_allocations (assignment_uuid, month, planned_hours, kind) VALUES ($1,$2,$3,$4) ON CONFLICT (assignment_uuid, month, kind) DO UPDATE SET planned_hours = EXCLUDED.planned_hours`,
        [assignmentUuid, r.month, r.plannedHours, r.kind]
      );
    }
    await pgClient.query("COMMIT");
    return assignmentUuid;
  } catch (e) {
    await pgClient.query("ROLLBACK");
    throw e;
  } finally {
    await pgClient.release();
  }
}

/** Bulk = the primitive over a cartesian. Total per project split equally across the project span's months. */
export async function assignToProjects(input: {
  employeeUuids: string[];
  projects: { projectKey: string; startDate: string; endDate: string }[];
  hoursPerProject: number;
  actingUserUuid: string | null;
}): Promise<{ created: number }> {
  let created = 0;
  for (const employeeUuid of input.employeeUuids) {
    for (const p of input.projects) {
      const monthly = Object.fromEntries(
        splitTotalAcrossMonths(input.hoursPerProject, p.startDate, p.endDate).map((m) => [m.month, m.plannedHours])
      );
      await upsertAssignment({
        employeeUuid, projectKey: p.projectKey, span: { startDate: p.startDate, endDate: p.endDate },
        monthlyHours: monthly, status: "draft", kind: "plan", mode: "merge", actingUserUuid: input.actingUserUuid,
      });
      created++;
    }
  }
  return { created };
}

/** Single-month edit (timeline editor). */
export async function setMonthHours(input: {
  employeeUuid: string; projectKey: string; span: { startDate: string; endDate: string };
  month: string; hours: number; kind?: "plan" | "adjustment"; actingUserUuid: string | null;
}): Promise<string> {
  return upsertAssignment({
    employeeUuid: input.employeeUuid, projectKey: input.projectKey, span: input.span,
    monthlyHours: { [input.month]: input.hours }, kind: input.kind ?? "plan", mode: "merge",
    actingUserUuid: input.actingUserUuid,
  });
}

export async function removeAssignment(employeeUuid: string, projectKey: string): Promise<void> {
  await assignmentsDb.execute(
    `DELETE FROM planner_assignments WHERE employee_uuid=$1 AND project_key=$2`, [employeeUuid, projectKey]);
}
