/**
 * MIGRASI ASSIGNMENTS KE SUPABASE (Dengan Dummy Employees)
 *
 * Karena employees tidak ada di MySQL, kita buat dummy records dulu
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createPool } from 'mysql2/promise';
import postgres from 'postgres';

const mysqlDb = createPool({
  host: process.env.MYSQL_ASSIGNMENTS_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_ASSIGNMENTS_PORT || '3306'),
  user: process.env.MYSQL_ASSIGNMENTS_USER || 'root',
  password: process.env.MYSQL_ASSIGNMENTS_PASSWORD || '',
  database: process.env.MYSQL_ASSIGNMENTS_DATABASE || 'resource_planner_assignments',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
});

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL tidak di-set!');
const supabaseClient = postgres(connectionString, { max: 10 });

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

async function main() {
  console.log('========================================');
  console.log('MIGRASI ASSIGNMENTS (DUMMY EMPLOYEES)');
  console.log('========================================');

  // 1. Ambil semua employee_uuid dari assignments dan actual
  console.log('\n=== MENGUMPULKAN EMPLOYEE UUIDS ===');

  const [assignRows] = await mysqlDb.execute('SELECT DISTINCT employee_uuid FROM assignments WHERE employee_uuid IS NOT NULL');
  const [actualRows] = await mysqlDb.execute('SELECT DISTINCT employee_uuid FROM actual WHERE employee_uuid IS NOT NULL');

  const employeeUuids = new Set<string>();
  for (const row of assignRows as any[]) employeeUuids.add(row.employee_uuid);
  for (const row of actualRows as any[]) employeeUuids.add(row.employee_uuid);

  console.log(`Menemukan ${employeeUuids.size} unique employee_uuids`);

  // 2. Ambil semua project_uuid untuk mapping
  console.log('\n=== MENGUMPULKAN PROJECT UUIDS ===');

  const [assignProjectRows] = await mysqlDb.execute('SELECT DISTINCT project_uuid FROM assignments WHERE project_uuid IS NOT NULL');
  const [actualProjectRows] = await mysqlDb.execute('SELECT DISTINCT project_uuid FROM actual WHERE project_uuid IS NOT NULL');

  const projectUuids = new Set<string>();
  for (const row of assignProjectRows as any[]) projectUuids.add(row.project_uuid);
  for (const row of actualProjectRows as any[]) projectUuids.add(row.project_uuid);

  console.log(`Menemukan ${projectUuids.size} unique project_uuids`);

  // 3. Buat dummy employees
  console.log('\n=== MEMBUAT DUMMY EMPLOYEES ===');

  let empSuccess = 0;
  let empFailed = 0;

  for (const uuid of employeeUuids) {
    try {
      await supabaseClient.unsafe(
        `INSERT INTO employees (id, full_name, position, employment_status, visibility, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [uuid, `Employee ${uuid.substr(0, 8)}`, 'TBD', 'active', 'active']
      );
      empSuccess++;
    } catch (error: any) {
      console.error(`Gagal buat dummy employee ${uuid}:`, error.message);
      empFailed++;
    }
  }

  console.log(`✓ Employees: ${empSuccess} berhasil, ${empFailed} gagal`);

  // 4. Buat dummy projects
  console.log('\n=== MEMBUAT DUMMY PROJECTS ===');

  let projSuccess = 0;
  let projFailed = 0;

  // Butuh dummy brand dulu untuk project
  const dummyBrandId = '00000000-0000-0000-0000-000000000001';
  try {
    await supabaseClient.unsafe(
      `INSERT INTO brands (id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [dummyBrandId, 'Dummy Brand', 'active']
    );
  } catch (e) {
    // ignore
  }

  for (const uuid of projectUuids) {
    try {
      await supabaseClient.unsafe(
        `INSERT INTO projects (id, brand_id, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [uuid, dummyBrandId, `Project ${uuid.substr(0, 8)}`, 'active']
      );
      projSuccess++;
    } catch (error: any) {
      console.error(`Gagal buat dummy project ${uuid}:`, error.message);
      projFailed++;
    }
  }

  console.log(`✓ Projects: ${projSuccess} berhasil, ${projFailed} gagal`);

  // 5. Migrasi assignments
  console.log('\n=== MIGRASI ASSIGNMENTS ===');

  const [assignments] = await mysqlDb.execute('SELECT * FROM assignments');
  console.log(`Menemukan ${(assignments as any[]).length} assignments`);

  let assignSuccess = 0;
  let assignFailed = 0;

  for (const row of assignments as any[]) {
    try {
      await supabaseClient.unsafe(
        `INSERT INTO assignments (
          id, employee_id, project_id, task_id, start_date, end_date,
          hours_per_day, allocation_percentage, is_time_off, time_off_type_id,
          category, is_billable, status, note, created_by_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO NOTHING`,
        [
          row.uuid,
          row.employee_uuid,
          row.project_uuid,
          row.task_uuid,
          parseDate(row.start_date),
          parseDate(row.end_date),
          parseFloat(row.hours_per_day) || 0,
          row.allocation_percentage,
          Boolean(row.is_time_off),
          row.time_off_type_uuid,
          row.category,
          Boolean(row.is_billable),
          row.status,
          row.note,
          row.created_by_uuid,
          parseDate(row.created_at),
          parseDate(row.updated_at),
        ]
      );
      assignSuccess++;
    } catch (error: any) {
      console.error(`Gagal ${row.uuid}:`, error.message);
      assignFailed++;
    }
  }

  console.log(`✓ Assignments: ${assignSuccess} berhasil, ${assignFailed} gagal`);

  // 6. Migrasi actual assignments
  console.log('\n=== MIGRASI ACTUAL ASSIGNMENTS ===');

  const [actuals] = await mysqlDb.execute('SELECT * FROM actual');
  console.log(`Menemukan ${(actuals as any[]).length} actual assignments`);

  let actualSuccess = 0;
  let actualFailed = 0;

  for (const row of actuals as any[]) {
    try {
      await supabaseClient.unsafe(
        `INSERT INTO assignments (
          id, employee_id, project_id, task_id, start_date, end_date,
          hours_per_day, allocation_percentage, is_time_off, time_off_type_id,
          category, is_billable, status, note, created_by_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO NOTHING`,
        [
          row.uuid,
          row.employee_uuid,
          row.project_uuid,
          row.task_uuid,
          parseDate(row.start_date),
          parseDate(row.end_date),
          parseFloat(row.hours_per_day) || 0,
          row.allocation_percentage,
          Boolean(row.is_time_off),
          row.time_off_type_uuid,
          row.category,
          Boolean(row.is_billable),
          'completed',
          row.note,
          row.created_by_uuid,
          parseDate(row.created_at),
          parseDate(row.updated_at),
        ]
      );
      actualSuccess++;
    } catch (error: any) {
      console.error(`Gagal ${row.uuid}:`, error.message);
      actualFailed++;
    }
  }

  console.log(`✓ Actual Assignments: ${actualSuccess} berhasil, ${actualFailed} gagal`);

  // 7. Validasi
  console.log('\n=== VALIDASI ===');

  const [empCount] = await supabaseClient.unsafe('SELECT COUNT(*) as count FROM employees');
  const [projCount] = await supabaseClient.unsafe('SELECT COUNT(*) as count FROM projects');
  const [assignCount] = await supabaseClient.unsafe('SELECT COUNT(*) as count FROM assignments');

  console.log(`Employees: ${empCount[0].count}`);
  console.log(`Projects: ${projCount[0].count}`);
  console.log(`Assignments: ${assignCount[0].count}`);

  console.log('\n========================================');
  console.log('MIGRASI SELESAI');
  console.log('========================================');

  await mysqlDb.end();
  await supabaseClient.end();
}

main().catch(console.error);
