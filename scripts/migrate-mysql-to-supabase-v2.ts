/**
 * MIGRASI MYSQL KE SUPABASE V2
 * Menggunakan raw SQL untuk menghindari masalah type conversion
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createPool } from 'mysql2/promise';
import postgres from 'postgres';

// ============================================================
// KONEKSI DATABASE
// ============================================================

// MySQL Connection (Source)
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

// Supabase Connection (Target)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set!');
}

const supabaseClient = postgres(connectionString, { max: 10 });

// ============================================================
// FUNGSI MIGRASI
// ============================================================

/**
 * Migrasi tabel assignments menggunakan raw SQL
 */
async function migrateAssignments() {
  console.log('\n=== MIGRASI ASSIGNMENTS ===');

  try {
    const [rows] = await mysqlDb.execute('SELECT * FROM assignments');
    const assignments = rows as any[];

    console.log(`Menemukan ${assignments.length} assignments di MySQL`);

    if (assignments.length === 0) {
      console.log('Tidak ada data untuk dimigrasi');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const row of assignments) {
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
            row.start_date, // Date object from MySQL
            row.end_date,
            parseFloat(row.hours_per_day) || 0,
            row.allocation_percentage,
            Boolean(row.is_time_off),
            row.time_off_type_uuid,
            row.category,
            Boolean(row.is_billable),
            row.status,
            row.note,
            row.created_by_uuid,
            row.created_at,
            row.updated_at,
          ]
        );
        success++;
      } catch (error) {
        console.error(`Gagal migrasi assignment ${row.uuid}:`, (error as any).message);
        failed++;
      }
    }

    console.log(`✓ Assignments: ${success} berhasil, ${failed} gagal`);
  } catch (error) {
    console.error('Error migrasi assignments:', error);
  }
}

/**
 * Migrasi tabel actual menggunakan raw SQL
 */
async function migrateActual() {
  console.log('\n=== MIGRASI ACTUAL ASSIGNMENTS ===');

  try {
    const [rows] = await mysqlDb.execute('SELECT * FROM actual');
    const actuals = rows as any[];

    console.log(`Menemukan ${actuals.length} actual assignments di MySQL`);

    if (actuals.length === 0) {
      console.log('Tidak ada data untuk dimigrasi');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const row of actuals) {
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
            row.start_date,
            row.end_date,
            parseFloat(row.hours_per_day) || 0,
            row.allocation_percentage,
            Boolean(row.is_time_off),
            row.time_off_type_uuid,
            row.category,
            Boolean(row.is_billable),
            'completed', // Actual assignments ditandai sebagai completed
            row.note,
            row.created_by_uuid,
            row.created_at,
            row.updated_at,
          ]
        );
        success++;
      } catch (error) {
        console.error(`Gagal migrasi actual ${row.uuid}:`, (error as any).message);
        failed++;
      }
    }

    console.log(`✓ Actual Assignments: ${success} berhasil, ${failed} gagal`);
  } catch (error) {
    console.error('Error migrasi actual:', error);
  }
}

/**
 * Validasi data setelah migrasi
 */
async function validateMigration() {
  console.log('\n=== VALIDASI MIGRASI ===');

  try {
    const result = await supabaseClient.unsafe('SELECT COUNT(*) as count FROM assignments');
    console.log(`Total assignments di Supabase: ${result[0].count}`);

    const [mysqlRows] = await mysqlDb.execute('SELECT COUNT(*) as count FROM assignments');
    const mysqlCount = (mysqlRows as any)[0].count;
    console.log(`Total assignments di MySQL: ${mysqlCount}`);

    if (result[0].count === Number(mysqlCount)) {
      console.log('✓ Jumlah data cocok!');
    } else {
      console.log(`⚠ Perbedaan jumlah: ${Math.abs(Number(mysqlCount) - result[0].count)} records`);
    }
  } catch (error) {
    console.error('Error validasi:', error);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('========================================');
  console.log('MIGRASI MYSQL KE SUPABASE V2 (Raw SQL)');
  console.log('========================================');

  await migrateAssignments();
  await migrateActual();
  await validateMigration();

  console.log('\n========================================');
  console.log('MIGRASI SELESAI');
  console.log('========================================');

  await mysqlDb.end();
  await supabaseClient.end();
}

main().catch(console.error);
