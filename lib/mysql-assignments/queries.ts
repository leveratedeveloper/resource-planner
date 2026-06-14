/**
 * MySQL Assignments Queries
 * CRUD operations for assignments with validation and security
 */

import { assignmentsDb, getDbClient } from './db';
import { randomUUID } from 'crypto';

// Whitelist untuk update - mencegah SQL injection
const ALLOWED_UPDATE_COLUMNS = [
  'start_date',
  'end_date',
  'hours_per_day',
  'total_hours',
  'is_time_off',
  'is_adjustment',
  'category',
  'is_billable',
  'status',
  'note',
  'time_off_type_uuid',
  'allocation_percentage',
] as const;

type AllowedUpdateColumn = typeof ALLOWED_UPDATE_COLUMNS[number];

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
  employee_uuids?: string[];
  project_uuid?: string;
  project_uuids?: string[];
  start_date: string;
  end_date: string;
  status?: string | null;
  category?: string | null;
};

// Employee scoping for timeline queries. A uuid list (the bootstrap's employee
// page) supersedes the single-uuid restricted-user filter; empty inputs add no
// clause. Pure so the SQL/params contract is unit-testable.
export function buildEmployeeScopeClause(
  filters: Pick<TimelineAssignmentFilters, "employee_uuid" | "employee_uuids">
): { sql: string; params: string[] } {
  if (filters.employee_uuids && filters.employee_uuids.length > 0) {
    const placeholders = filters.employee_uuids.map(() => "?").join(",");
    return { sql: ` AND employee_uuid IN (${placeholders})`, params: [...filters.employee_uuids] };
  }
  if (filters.employee_uuid) {
    return { sql: " AND employee_uuid = ?", params: [filters.employee_uuid] };
  }
  return { sql: "", params: [] };
}

/**
 * Get assignments with optional filters
 */
export async function getAssignments(filters?: {
  employee_uuid?: string;
  project_uuid?: string;
  project_uuids?: string[];
  start_date?: string;
  end_date?: string;
  status?: string;
}) {
  let query = 'SELECT * FROM assignments WHERE COALESCE(is_time_off, 0) = 0';
  const params: any[] = [];

  if (filters?.employee_uuid) {
    query += ' AND employee_uuid = ?';
    params.push(filters.employee_uuid);
  }
  if (filters?.project_uuid) {
    query += ' AND project_uuid = ?';
    params.push(filters.project_uuid);
  }
  if (filters?.project_uuids && filters.project_uuids.length > 0) {
    // Filter by multiple project UUIDs (for brand filtering)
    const placeholders = filters.project_uuids.map(() => '?').join(',');
    query += ` AND project_uuid IN (${placeholders})`;
    params.push(...filters.project_uuids);
  }
  if (filters?.start_date) {
    query += ' AND end_date >= ?';
    params.push(filters.start_date);
  }
  if (filters?.end_date) {
    query += ' AND start_date <= ?';
    params.push(filters.end_date);
  }
  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY created_at DESC';

  const [rows] = await assignmentsDb.execute(query, params);
  return rows;
}

export async function getTimelineAssignments(filters: TimelineAssignmentFilters) {
  let query = `SELECT ${TIMELINE_ASSIGNMENT_COLUMNS} FROM assignments WHERE end_date >= ? AND start_date <= ? AND COALESCE(is_time_off, 0) = 0`;
  const params: any[] = [filters.start_date, filters.end_date];

  const employeeScope = buildEmployeeScopeClause(filters);
  query += employeeScope.sql;
  params.push(...employeeScope.params);
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

/**
 * Get a single assignment by UUID
 */
export async function getAssignment(uuid: string) {
  const [rows] = await assignmentsDb.execute(
    'SELECT * FROM assignments WHERE uuid = ?',
    [uuid]
  );

  const assignments = rows as any[];
  if (assignments.length === 0) {
    throw new Error(`Assignment ${uuid} not found`);
  }

  return assignments[0];
}

/**
 * Create a new assignment
 */
export async function createAssignment(data: {
  employee_uuid: string;
  project_uuid?: string | null;
  task_uuid?: string | null;
  start_date: string;
  end_date: string;
  hours_per_day?: string | number;
  total_hours?: number | null;
  allocation_percentage?: number | null;
  is_time_off?: boolean;
  is_adjustment?: boolean;
  time_off_type_uuid?: string | null;
  category?: string | null;
  is_billable?: boolean;
  status?: string;
  note?: string | null;
  created_by_uuid?: string | null;
}) {
  // Skip validation for now - MySQL API requires authentication
  // TODO: Add proper authentication or use mysql-bridge for validation

  const uuid = randomUUID();

  // Calculate total_hours if not provided
  const hoursPerDay = parseFloat(String(data.hours_per_day || '8.00'));
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const calculatedTotalHours = data.total_hours ?? (hoursPerDay * daysDiff);

  // Get current timestamp for created_at and updated_at (required for PostgreSQL)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const query = `
    INSERT INTO assignments (
      uuid, employee_uuid, project_uuid, task_uuid, start_date, end_date,
      hours_per_day, total_hours, allocation_percentage, is_time_off, is_adjustment, time_off_type_uuid,
      category, is_billable, status, note, created_by_uuid, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await assignmentsDb.execute(query, [
    uuid,
    data.employee_uuid,
    data.project_uuid ?? null,
    data.task_uuid ?? null,
    data.start_date,
    data.end_date,
    data.hours_per_day ?? '8.00',
    calculatedTotalHours,
    data.allocation_percentage ?? null,
    // Use explicit nullish check since 0 is a valid value for booleans in PostgreSQL
    data.is_time_off ?? 0,
    data.is_adjustment ?? 0,
    data.time_off_type_uuid ?? null,
    data.category ?? null,
    data.is_billable ?? 1,
    data.status ?? 'confirmed',
    data.note ?? null,
    data.created_by_uuid ?? null,
    now,  // created_at
    now,  // updated_at
  ]);

  const result = await getAssignment(uuid);

  return result;
}

/**
 * Update an existing assignment
 */
export async function updateAssignment(
  uuid: string,
  data: Partial<{
    start_date: string;
    end_date: string;
    hours_per_day: string | number;
    total_hours: number;
    allocation_percentage: number;
    is_time_off: boolean;
    time_off_type_uuid: string;
    category: string;
    is_billable: boolean;
    status: string;
    note: string;
    project_uuid: string;
  }>
) {
  const setClause: string[] = [];
  const params: any[] = [];

  // Whitelist - hanya kolom yang diizinkan yang bisa di-update
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_UPDATE_COLUMNS.includes(key as AllowedUpdateColumn) && value !== undefined) {
      setClause.push(`${key} = ?`);
      params.push(value);
    }
  }

  // Auto-calculate total_hours if start_date, end_date, or hours_per_day changed
  if (data.start_date || data.end_date || data.hours_per_day) {
    // Get current assignment to calculate total_hours
    const current = await getAssignment(uuid);
    const startDate = new Date(data.start_date || current.start_date);
    const endDate = new Date(data.end_date || current.end_date);
    const hoursPerDay = parseFloat(String(data.hours_per_day || current.hours_per_day));
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const calculatedTotalHours = hoursPerDay * daysDiff;

    setClause.push(`total_hours = ?`);
    params.push(calculatedTotalHours);
  }

  if (setClause.length === 0) {
    throw new Error('No valid columns to update');
  }

  // Add updated_at timestamp
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  setClause.push(`updated_at = ?`);
  params.push(now);

  params.push(uuid);

  await assignmentsDb.execute(
    `UPDATE assignments SET ${setClause.join(', ')} WHERE uuid = ?`,
    params
  );

  return getAssignment(uuid);
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(uuid: string) {
  const [result] = await assignmentsDb.execute(
    'DELETE FROM assignments WHERE uuid = ?',
    [uuid]
  );

  // Cek apakah ada baris yang dihapus
  if ((result as any).affectedRows === 0) {
    throw new Error(`Assignment ${uuid} not found`);
  }
}

/**
 * Get assignments count by employee
 */
export async function getAssignmentsCountByEmployee(employeeUuid: string): Promise<number> {
  const [rows] = await assignmentsDb.execute(
    'SELECT COUNT(*) as count FROM assignments WHERE employee_uuid = ?',
    [employeeUuid]
  );

  const result = rows as any[];
  return result[0]?.count || 0;
}

/**
 * Get assignments by date range
 */
export async function getAssignmentsByDateRange(startDate: string, endDate: string) {
  const query = `
    SELECT * FROM assignments
    WHERE start_date <= ? AND end_date >= ?
    ORDER BY start_date, employee_uuid
  `;

  const [rows] = await assignmentsDb.execute(query, [endDate, startDate]);
  return rows;
}

// ============================================================================
// ACTUAL ASSIGNMENTS (from 'actual' table)
// Struktur sama dengan tabel assignments
// ============================================================================

// Whitelist untuk update actual - sama dengan assignments
const ALLOWED_ACTUAL_UPDATE_COLUMNS = [
  'start_date',
  'end_date',
  'hours_per_day',
  'total_hours',
  'is_time_off',
  'category',
  'is_billable',
  'status',
  'note',
  'time_off_type_uuid',
  'task_uuid',
  'allocation_percentage',
  'project_uuid',
] as const;

type AllowedActualUpdateColumn = typeof ALLOWED_ACTUAL_UPDATE_COLUMNS[number];

/**
 * Get actual assignments with filters
 */
export async function getActualAssignments(filters?: {
  employee_uuid?: string;
  project_uuid?: string;
  start_date?: string;
  end_date?: string;
}) {
  let query = 'SELECT * FROM actual WHERE COALESCE(is_time_off, 0) = 0';
  const params: any[] = [];

  if (filters?.employee_uuid) {
    query += ' AND employee_uuid = ?';
    params.push(filters.employee_uuid);
  }
  if (filters?.project_uuid) {
    query += ' AND project_uuid = ?';
    params.push(filters.project_uuid);
  }
  if (filters?.start_date) {
    query += ' AND end_date >= ?';
    params.push(filters.start_date);
  }
  if (filters?.end_date) {
    query += ' AND start_date <= ?';
    params.push(filters.end_date);
  }

  query += ' ORDER BY start_date DESC';
  const [rows] = await assignmentsDb.execute(query, params);
  return rows;
}

export async function getTimelineActualAssignments(filters: TimelineAssignmentFilters) {
  let query = `SELECT ${TIMELINE_ACTUAL_COLUMNS} FROM actual WHERE end_date >= ? AND start_date <= ? AND COALESCE(is_time_off, 0) = 0`;
  const params: any[] = [filters.start_date, filters.end_date];

  const employeeScope = buildEmployeeScopeClause(filters);
  query += employeeScope.sql;
  params.push(...employeeScope.params);
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

/**
 * Get a single actual assignment by UUID
 */
export async function getActual(uuid: string) {
  const [rows] = await assignmentsDb.execute(
    'SELECT * FROM actual WHERE uuid = ?',
    [uuid]
  );

  const actuals = rows as any[];
  if (actuals.length === 0) {
    throw new Error(`Actual ${uuid} not found`);
  }

  return actuals[0];
}

/**
 * Create a new actual assignment
 * Struktur sama dengan assignments
 */
export async function createActualAssignment(data: {
  employee_uuid: string;
  project_uuid?: string | null;
  task_uuid?: string | null;
  start_date: string;
  end_date: string;
  hours_per_day?: string | number;
  total_hours?: number | null;
  allocation_percentage?: number | null;
  is_time_off?: boolean;
  time_off_type_uuid?: string | null;
  category?: string | null;
  is_billable?: boolean;
  status?: string;
  note?: string | null;
  created_by_uuid?: string | null;
}) {
  const uuid = randomUUID();

  // Calculate total_hours if not provided
  const hoursPerDay = parseFloat(String(data.hours_per_day || '8.00'));
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const calculatedTotalHours = data.total_hours ?? (hoursPerDay * daysDiff);

  // Get current timestamp for created_at and updated_at (required for PostgreSQL)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const query = `
    INSERT INTO actual (
      uuid, employee_uuid, project_uuid, task_uuid, start_date, end_date,
      hours_per_day, total_hours, allocation_percentage, is_time_off, time_off_type_uuid,
      category, is_billable, status, note, created_by_uuid, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await assignmentsDb.execute(query, [
    uuid,
    data.employee_uuid,
    data.project_uuid ?? null,
    data.task_uuid ?? null,
    data.start_date,
    data.end_date,
    data.hours_per_day ?? '8.00',
    calculatedTotalHours,
    data.allocation_percentage ?? null,
    // Use explicit nullish check since 0 is a valid value for booleans in PostgreSQL
    data.is_time_off ?? 0,
    data.time_off_type_uuid ?? null,
    data.category ?? null,
    data.is_billable ?? 1,
    data.status ?? 'confirmed',
    data.note ?? null,
    data.created_by_uuid ?? null,
    now,  // created_at
    now,  // updated_at
  ]);

  return getActual(uuid);
}

/**
 * Update an existing actual assignment
 * Struktur sama dengan assignments
 */
export async function updateActualAssignment(
  uuid: string,
  data: Partial<{
    start_date: string;
    end_date: string;
    hours_per_day: string | number;
    total_hours: number;
    allocation_percentage: number;
    is_time_off: boolean;
    time_off_type_uuid: string;
    category: string;
    is_billable: boolean;
    status: string;
    note: string;
    project_uuid: string;
    task_uuid: string;
  }>
) {
  const setClause: string[] = [];
  const params: any[] = [];

  // Whitelist - hanya kolom yang diizinkan yang bisa di-update
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_ACTUAL_UPDATE_COLUMNS.includes(key as AllowedActualUpdateColumn) && value !== undefined) {
      setClause.push(`${key} = ?`);
      params.push(value);
    }
  }

  // Auto-calculate total_hours if start_date, end_date, or hours_per_day changed
  if (data.start_date || data.end_date || data.hours_per_day) {
    // Get current assignment to calculate total_hours
    const current = await getActual(uuid);
    const startDate = new Date(data.start_date || current.start_date);
    const endDate = new Date(data.end_date || current.end_date);
    const hoursPerDay = parseFloat(String(data.hours_per_day || current.hours_per_day));
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const calculatedTotalHours = hoursPerDay * daysDiff;

    setClause.push(`total_hours = ?`);
    params.push(calculatedTotalHours);
  }

  if (setClause.length === 0) {
    throw new Error('No valid columns to update');
  }

  // Add updated_at timestamp
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  setClause.push(`updated_at = ?`);
  params.push(now);

  params.push(uuid);

  await assignmentsDb.execute(
    `UPDATE actual SET ${setClause.join(', ')} WHERE uuid = ?`,
    params
  );

  return getActual(uuid);
}

/**
 * Delete an actual assignment
 */
export async function deleteActualAssignment(uuid: string) {
  const [result] = await assignmentsDb.execute(
    'DELETE FROM actual WHERE uuid = ?',
    [uuid]
  );

  if ((result as any).affectedRows === 0) {
    throw new Error(`Actual ${uuid} not found`);
  }
}

// ---------------------------------------------------------------------------
// Month aggregation (Phase 8). Month-resolution views collapse day-level rows
// into per-month blocks; doing the collapse in SQL avoids pulling ~26k rows
// per quarter just to summarize them server-side (measured 825 ms of the
// bootstrap TTFB). The arithmetic mirrors summarizeMonthly* in
// lib/planner/planner-loading.ts: weekday-only day counts (Sat/Sun excluded,
// floored at 1), per-row hours = total_hours / weekdays(full span) when
// total_hours is set, else hours_per_day.
//
// Dialect note: these queries bypass convertMySQLToPostgreSQL's intent (it
// only rewrites backticks/placeholders/DDL keywords), so each dialect gets
// native SQL with `?` placeholders — the converter renumbers them for
// Postgres. The MySQL branch is untested in this environment (both dev and
// prod resolve DATABASE_URL → Postgres) and exists for the no-DATABASE_URL
// fallback only.

type SqlDialect = 'postgresql' | 'mysql';

// Time-off exclusion predicate that survives `is_time_off` being declared
// either integer (live DB) or boolean (schema.postgres.sql). `boolean::integer`
// yields 0/1 in Postgres and a no-op cast on an integer column, so COALESCE
// keeps NULL → not-time-off → included. MySQL's TINYINT(1) already coalesces
// against 0. (Pre-existing day-resolution queries keep the integer-only form;
// this hardens only the Phase 8 SQL.)
export function buildTimeOffExclusionPredicate(dialect: SqlDialect, columnRef: string): string {
  return dialect === 'postgresql'
    ? `COALESCE(${columnRef}::integer, 0) = 0`
    : `COALESCE(${columnRef}, 0) = 0`;
}

// Integer days since 1900-01-01 (a Monday).
function daysSinceMondayEpochExpr(dialect: SqlDialect, dateExpr: string): string {
  return dialect === 'postgresql'
    ? `((${dateExpr})::date - DATE '1900-01-01')`
    : `DATEDIFF(${dateExpr}, '1900-01-01')`;
}

// Weekdays in [1900-01-01 .. dateExpr]: for m days starting a Monday,
// weekdays = 5*floor(m/7) + least(m mod 7, 5).
function weekdaysFromEpochExpr(dialect: SqlDialect, dateExpr: string): string {
  const m = `(${daysSinceMondayEpochExpr(dialect, dateExpr)} + 1)`;
  return `(5 * FLOOR(${m} / 7.0) + LEAST(MOD(${m}, 7), 5))`;
}

// Inclusive weekday count between two date expressions, floored at 1 —
// the SQL twin of countWeekdays in lib/planner/planner-loading.ts.
export function buildWeekdayCountExpr(dialect: SqlDialect, startExpr: string, endExpr: string): string {
  const dayBeforeStart = dialect === 'postgresql'
    ? `((${startExpr})::date - 1)`
    : `DATE_SUB(${startExpr}, INTERVAL 1 DAY)`;
  return `GREATEST(${weekdaysFromEpochExpr(dialect, endExpr)} - ${weekdaysFromEpochExpr(dialect, dayBeforeStart)}, 1)`;
}

export type MonthlyAggregateQuery = { sql: string; params: unknown[] };

function buildSharedAggregateFilters(filters: TimelineAssignmentFilters): { sql: string; params: unknown[] } {
  const scope = buildEmployeeScopeClause(filters);
  let sql = scope.sql;
  const params: unknown[] = [...scope.params];

  if (filters.status) {
    sql += ' AND a.status = ?';
    params.push(filters.status);
  }
  if (filters.category) {
    sql += ' AND a.category = ?';
    params.push(filters.category);
  }

  return { sql: sql.replace(/ AND employee_uuid/g, ' AND a.employee_uuid'), params };
}

// Month slices clamped to the request range, as a CTE named `m` with columns
// month_start / slice_start / slice_end. Range params appear in the order
// [start, end, start, end] in BOTH dialects.
function buildMonthSlicesCte(dialect: SqlDialect): string {
  if (dialect === 'postgresql') {
    return `WITH m AS (
      SELECT gs::date AS month_start,
             GREATEST(gs::date, (?)::date) AS slice_start,
             LEAST((gs + interval '1 month' - interval '1 day')::date, (?)::date) AS slice_end
      FROM generate_series(date_trunc('month', (?)::date), date_trunc('month', (?)::date), interval '1 month') AS gs
    )`;
  }
  return `WITH RECURSIVE month_starts AS (
      SELECT DATE_FORMAT(?, '%Y-%m-01') AS month_start
      UNION ALL
      SELECT DATE_FORMAT(DATE_ADD(month_start, INTERVAL 1 MONTH), '%Y-%m-01') FROM month_starts
      WHERE month_start < DATE_FORMAT(?, '%Y-%m-01')
    ), m AS (
      SELECT DATE(month_start) AS month_start,
             GREATEST(DATE(month_start), DATE(?)) AS slice_start,
             LEAST(LAST_DAY(month_start), DATE(?)) AS slice_end
      FROM month_starts
    )`;
}

export function buildMonthlyAssignmentAggregateQuery(
  dialect: SqlDialect,
  filters: TimelineAssignmentFilters
): MonthlyAggregateQuery {
  const wdFullSpan = buildWeekdayCountExpr(dialect, 'a.start_date', 'a.end_date');
  const overlapStart = dialect === 'postgresql' ? 'GREATEST((a.start_date)::date, m.slice_start)' : 'GREATEST(DATE(a.start_date), m.slice_start)';
  const overlapEnd = dialect === 'postgresql' ? 'LEAST((a.end_date)::date, m.slice_end)' : 'LEAST(DATE(a.end_date), m.slice_end)';
  const wdOverlap = buildWeekdayCountExpr(dialect, overlapStart, overlapEnd);
  const startCol = dialect === 'postgresql' ? '(a.start_date)::date' : 'DATE(a.start_date)';
  const endCol = dialect === 'postgresql' ? '(a.end_date)::date' : 'DATE(a.end_date)';
  const shared = buildSharedAggregateFilters(filters);

  const sql = `${buildMonthSlicesCte(dialect)}
    SELECT a.employee_uuid, a.project_uuid, m.month_start,
           a.note, a.category, a.status, a.is_billable, a.is_adjustment,
           SUM((CASE WHEN a.total_hours IS NOT NULL
                 THEN a.total_hours / ${wdFullSpan}
                 ELSE a.hours_per_day END) * ${wdOverlap}) AS total_hours,
           COUNT(*) AS detail_count,
           MIN(a.created_at) AS created_at,
           MAX(a.updated_at) AS updated_at
    FROM assignments a
    JOIN m ON ${startCol} <= m.slice_end AND ${endCol} >= m.slice_start
    WHERE a.end_date >= ? AND a.start_date <= ? AND ${buildTimeOffExclusionPredicate(dialect, 'a.is_time_off')}${shared.sql}
    GROUP BY a.employee_uuid, a.project_uuid, m.month_start, a.note, a.category, a.status, a.is_billable, a.is_adjustment`;

  return {
    sql,
    params: [
      filters.start_date, filters.end_date,
      filters.start_date, filters.end_date,
      filters.start_date, filters.end_date,
      ...shared.params,
    ],
  };
}

export function buildMonthlyActualAggregateQuery(
  dialect: SqlDialect,
  filters: TimelineAssignmentFilters
): MonthlyAggregateQuery {
  const overlapStart = dialect === 'postgresql' ? 'GREATEST((a.start_date)::date, m.slice_start)' : 'GREATEST(DATE(a.start_date), m.slice_start)';
  const overlapEnd = dialect === 'postgresql' ? 'LEAST((a.end_date)::date, m.slice_end)' : 'LEAST(DATE(a.end_date), m.slice_end)';
  const wdOverlap = buildWeekdayCountExpr(dialect, overlapStart, overlapEnd);
  const startCol = dialect === 'postgresql' ? '(a.start_date)::date' : 'DATE(a.start_date)';
  const endCol = dialect === 'postgresql' ? '(a.end_date)::date' : 'DATE(a.end_date)';
  const shared = buildSharedAggregateFilters(filters);

  // Actuals key has no adjustment segment and uses hours_per_day directly —
  // mirrors summarizeMonthlyActualAssignments.
  const sql = `${buildMonthSlicesCte(dialect)}
    SELECT a.employee_uuid, a.project_uuid, m.month_start,
           a.note, a.category, a.status, a.is_billable,
           SUM(a.hours_per_day * ${wdOverlap}) AS month_hours,
           COUNT(*) AS detail_count,
           MIN(a.created_at) AS created_at,
           MAX(a.updated_at) AS updated_at
    FROM actual a
    JOIN m ON ${startCol} <= m.slice_end AND ${endCol} >= m.slice_start
    WHERE a.end_date >= ? AND a.start_date <= ? AND ${buildTimeOffExclusionPredicate(dialect, 'a.is_time_off')}${shared.sql}
    GROUP BY a.employee_uuid, a.project_uuid, m.month_start, a.note, a.category, a.status, a.is_billable`;

  return {
    sql,
    params: [
      filters.start_date, filters.end_date,
      filters.start_date, filters.end_date,
      filters.start_date, filters.end_date,
      ...shared.params,
    ],
  };
}

export async function getTimelineMonthlyAssignmentAggregates(filters: TimelineAssignmentFilters) {
  const { sql, params } = buildMonthlyAssignmentAggregateQuery(getDbClient(), filters);
  const [rows] = await assignmentsDb.execute(sql, params);
  return rows;
}

export async function getTimelineMonthlyActualAggregates(filters: TimelineAssignmentFilters) {
  const { sql, params } = buildMonthlyActualAggregateQuery(getDbClient(), filters);
  const [rows] = await assignmentsDb.execute(sql, params);
  return rows;
}
