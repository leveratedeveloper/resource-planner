/**
 * MIGRASI LENGKAP MYSQL KE SUPABASE
 * Urutan yang benar untuk foreign key constraints
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createPool } from 'mysql2/promise';
import postgres from 'postgres';

// ============================================================
// KONEKSI DATABASE
// ============================================================

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

// ============================================================
// FUNGSI BANTUAN
// ============================================================

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

async function insertWithRetry(table: string, data: any, conflictColumn = 'id') {
  try {
    await supabaseClient.unsafe(
      `INSERT INTO ${table} ($1) VALUES ($2) ON CONFLICT (${conflictColumn}) DO NOTHING`,
      [Object.keys(data), Object.values(data)]
    );
    return true;
  } catch (error: any) {
    console.error(`  Error inserting ${table}:`, error.message);
    return false;
  }
}

// ============================================================
// MIGRASI TABLES (Urutan Penting untuk Foreign Keys)
// ============================================================

// 1. Business Units
async function migrateBusinessUnits() {
  console.log('\n=== 1. MIGRASI BUSINESS UNITS ===');
  try {
    // Cek apakah tabel business_units ada di MySQL
    const [rows] = await mysqlDb.execute('SHOW TABLES LIKE "business_units"');
    if ((rows as any[]).length === 0) {
      console.log('  Tabel business_units tidak ada di MySQL, skip');
      return;
    }

    const [data] = await mysqlDb.execute('SELECT * FROM business_units');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} business_units`);

    let success = 0;
    for (const row of items) {
      const result = await insertWithRetry('business_units', {
        id: row.uuid || row.id,
        name: row.name,
        code: row.code,
        color: row.color,
        description: row.description,
        is_active: Boolean(row.is_active ?? row.isActive ?? 1),
        created_at: parseDate(row.created_at ?? row.createdAt),
        updated_at: parseDate(row.updated_at ?? row.updatedAt),
      });
      if (result) success++;
    }
    console.log(`  ✓ ${success} berhasil`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// 2. Departments
async function migrateDepartments() {
  console.log('\n=== 2. MIGRASI DEPARTMENTS ===');
  try {
    const [rows] = await mysqlDb.execute('SHOW TABLES LIKE "departments"');
    if ((rows as any[]).length === 0) {
      console.log('  Tabel departments tidak ada di MySQL, skip');
      return;
    }

    const [data] = await mysqlDb.execute('SELECT * FROM departments');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} departments`);

    let success = 0;
    for (const row of items) {
      const result = await insertWithRetry('departments', {
        id: row.uuid || row.id,
        business_unit_id: row.business_unit_uuid || row.businessUnitId || row.business_unit_id,
        name: row.name,
        code: row.code,
        color: row.color,
        description: row.description,
        is_active: Boolean(row.is_active ?? row.isActive ?? 1),
        created_at: parseDate(row.created_at ?? row.createdAt),
        updated_at: parseDate(row.updated_at ?? row.updatedAt),
      });
      if (result) success++;
    }
    console.log(`  ✓ ${success} berhasil`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// 3. Employees
async function migrateEmployees() {
  console.log('\n=== 3. MIGRASI EMPLOYEES ===');
  try {
    const [rows] = await mysqlDb.execute('SHOW TABLES LIKE "employees"');
    if ((rows as any[]).length === 0) {
      console.log('  Tabel employees tidak ada di MySQL, skip');
      return;
    }

    const [data] = await mysqlDb.execute('SELECT * FROM employees');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} employees`);

    let success = 0;
    for (const row of items) {
      const result = await insertWithRetry('employees', {
        id: row.uuid || row.id,
        employee_number: row.employee_number || row.employeeNumber,
        full_name: row.full_name || row.fullName || row.name,
        nickname: row.nickname,
        email: row.email,
        photo: row.photo,
        position: row.position,
        department_id: row.department_uuid || row.departmentId || row.department_id,
        business_unit_id: row.business_unit_uuid || row.businessUnitId || row.business_unit_id,
        direct_supervisor_id: row.direct_supervisor_uuid || row.directSupervisorId || row.direct_supervisor_id,
        weekly_capacity: row.weekly_capacity || row.weeklyCapacity || 40,
        work_start_date: parseDate(row.work_start_date || row.workStartDate),
        date_of_birth: parseDate(row.date_of_birth || row.dateOfBirth),
        employment_status: row.employment_status || row.employmentStatus || 'active',
        visibility: row.visibility || 'active',
        created_at: parseDate(row.created_at ?? row.createdAt),
        updated_at: parseDate(row.updated_at ?? row.updatedAt),
      });
      if (result) success++;
    }
    console.log(`  ✓ ${success} berhasil`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// 4. Brands
async function migrateBrands() {
  console.log('\n=== 4. MIGRASI BRANDS ===');
  try {
    const [rows] = await mysqlDb.execute('SHOW TABLES LIKE "brands"');
    if ((rows as any[]).length === 0) {
      console.log('  Tabel brands tidak ada di MySQL, skip');
      return;
    }

    const [data] = await mysqlDb.execute('SELECT * FROM brands');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} brands`);

    let success = 0;
    for (const row of items) {
      const result = await insertWithRetry('brands', {
        id: row.uuid || row.id,
        business_unit_id: row.business_unit_uuid || row.businessUnitId || row.business_unit_id,
        name: row.name,
        client_code: row.client_code || row.clientCode,
        color: row.color,
        logo: row.logo,
        website: row.website,
        contact_name: row.contact_name || row.contactName,
        contact_title: row.contact_title || row.contactTitle,
        contact_email: row.contact_email || row.contactEmail,
        contact_phone: row.contact_phone || row.contactPhone,
        industry_category: row.industry_category || row.industryCategory,
        description: row.description,
        status: row.status || 'active',
        created_at: parseDate(row.created_at ?? row.createdAt),
        updated_at: parseDate(row.updated_at ?? row.updatedAt),
      });
      if (result) success++;
    }
    console.log(`  ✓ ${success} berhasil`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// 5. Projects
async function migrateProjects() {
  console.log('\n=== 5. MIGRASI PROJECTS ===');
  try {
    const [rows] = await mysqlDb.execute('SHOW TABLES LIKE "projects"');
    if ((rows as any[]).length === 0) {
      console.log('  Tabel projects tidak ada di MySQL, skip');
      return;
    }

    const [data] = await mysqlDb.execute('SELECT * FROM projects');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} projects`);

    let success = 0;
    for (const row of items) {
      const result = await insertWithRetry('projects', {
        id: row.uuid || row.id,
        brand_id: row.brand_uuid || row.brandId || row.brand_id,
        business_unit_id: row.business_unit_uuid || row.businessUnitId || row.business_unit_id,
        name: row.name,
        project_number: row.project_number || row.projectNumber,
        description: row.description,
        color: row.color,
        budget: row.budget,
        currency: row.currency || 'USD',
        start_date: parseDate(row.start_date || row.startDate),
        end_date: parseDate(row.end_date || row.endDate),
        status: row.status || 'active',
        created_by_id: row.created_by_uuid || row.createdById || row.created_by_id,
        notes: row.notes,
        created_at: parseDate(row.created_at ?? row.createdAt),
        updated_at: parseDate(row.updated_at ?? row.updatedAt),
      });
      if (result) success++;
    }
    console.log(`  ✓ ${success} berhasil`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// 6. Assignments
async function migrateAssignments() {
  console.log('\n=== 6. MIGRASI ASSIGNMENTS ===');
  try {
    const [data] = await mysqlDb.execute('SELECT * FROM assignments');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} assignments`);

    let success = 0;
    let failed = 0;

    for (const row of items) {
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
        success++;
      } catch (error: any) {
        console.error(`  Gagal ${row.uuid}:`, error.message);
        failed++;
      }
    }
    console.log(`  ✓ ${success} berhasil, ${failed} gagal`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// 7. Actual Assignments
async function migrateActualAssignments() {
  console.log('\n=== 7. MIGRASI ACTUAL ASSIGNMENTS ===');
  try {
    const [data] = await mysqlDb.execute('SELECT * FROM actual');
    const items = data as any[];
    console.log(`  Menemukan ${items.length} actual assignments`);

    let success = 0;
    let failed = 0;

    for (const row of items) {
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
        success++;
      } catch (error: any) {
        console.error(`  Gagal ${row.uuid}:`, error.message);
        failed++;
      }
    }
    console.log(`  ✓ ${success} berhasil, ${failed} gagal`);
  } catch (error) {
    console.error('  Error:', error);
  }
}

// ============================================================
// VALIDASI
// ============================================================

async function validateMigration() {
  console.log('\n=== VALIDASI MIGRASI ===');

  const tables = ['employees', 'brands', 'projects', 'assignments'];

  for (const table of tables) {
    try {
      const result = await supabaseClient.unsafe(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ${table}: ${result[0].count} records`);
    } catch (error) {
      console.log(`  ${table}: Error - ${error}`);
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('========================================');
  console.log('MIGRASI LENGKAP MYSQL KE SUPABASE');
  console.log('========================================');

  await migrateBusinessUnits();
  await migrateDepartments();
  await migrateEmployees();
  await migrateBrands();
  await migrateProjects();
  await migrateAssignments();
  await migrateActualAssignments();

  await validateMigration();

  console.log('\n========================================');
  console.log('MIGRASI SELESAI');
  console.log('========================================');

  await mysqlDb.end();
  await supabaseClient.end();
}

main().catch(console.error);
