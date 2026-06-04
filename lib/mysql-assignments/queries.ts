/**
 * MySQL Assignments Queries
 * CRUD operations for assignments with validation and security
 */

import { assignmentsDb } from './db';
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

// Timetrack API base URL for validation
const TIMETRACK_API_URL = process.env.TIMETRACK_API_URL || 'http://127.0.0.1:8000/api/v1';

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

/**
 * Validate employee and project existence in MySQL API
 */
async function validateAssignmentData(data: {
  employee_uuid: string;
  project_uuid?: string | null;
}): Promise<void> {
  try {
    // Cek employee
    const employeeRes = await fetch(`${TIMETRACK_API_URL}/employees/${data.employee_uuid}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!employeeRes.ok) {
      throw new Error(`Employee ${data.employee_uuid} not found`);
    }

    // Cek project (jika ada)
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
    // Continue even if validation fails - the MySQL API might be down
  }
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
  let query = 'SELECT * FROM assignments WHERE 1=1';
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

  console.log('[createAssignment] Input:', {
    employee_uuid: data.employee_uuid,
    start_date: data.start_date,
    end_date: data.end_date,
    hours_per_day: data.hours_per_day,
    total_hours_input: data.total_hours
  });

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

  console.log('[createAssignment] Inserted to DB, fetching result...');
  const result = await getAssignment(uuid);

  console.log('[createAssignment] Result from DB:', {
    uuid: result.uuid,
    start_date: result.start_date,
    end_date: result.end_date,
    hours_per_day: result.hours_per_day,
    total_hours: result.total_hours
  });

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
  let query = 'SELECT * FROM actual WHERE 1=1';
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
