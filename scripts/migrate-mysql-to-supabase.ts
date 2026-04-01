/**
 * MIGRASI MYSQL KE SUPABASE
 *
 * Script ini memigrasi data dari MySQL ke Supabase (PostgreSQL)
 *
 * Usage:
 *   npx tsx scripts/migrate-mysql-to-supabase.ts
 *
 * Prerequisites:
 *   - Supabase project sudah dibuat
 *   - DATABASE_URL sudah di-set di .env.local
 *   - MySQL masih berjalan
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/db/schema';
import type { NewAssignment, NewActualAssignment } from '../lib/db/schema';

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
  // Jangan pakai dateStrings: true, biarkan MySQL return Date objects
});

// Supabase Connection (Target)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set! Silakan set di .env.local');
}

const supabaseClient = postgres(connectionString, { max: 10 });
const db = drizzle(supabaseClient, { schema });

// ============================================================
// FUNGSI MIGRASI
// ============================================================

/**
 * Convert date to ISO string for PostgreSQL
 * postgres.js (used by Drizzle) needs ISO strings, not Date objects
 */
function parseDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

/**
 * Convert MySQL row ke format Supabase (snake_case → camelCase)
 */
function convertToCamelCase<T>(row: any): T {
  const converted: any = {};

  // List field yang berupa date/timestamp (return as Date object, not string)
  const dateFields = ['start_date', 'end_date', 'created_at', 'updated_at', 'work_start_date', 'date_of_birth', 'submit_date'];

  for (const [key, value] of Object.entries(row)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Mapping khusus untuk field yang berbeda
    if (key === 'uuid') {
      converted.id = value;
    } else if (key === 'employee_uuid') {
      converted.employeeId = value;
    } else if (key === 'project_uuid') {
      converted.projectId = value;
    } else if (key === 'task_uuid') {
      converted.taskId = value;
    } else if (key === 'time_off_type_uuid') {
      converted.timeOffTypeId = value;
    } else if (key === 'created_by_uuid') {
      converted.createdById = value;
    } else if (key === 'is_time_off') {
      converted.isTimeOff = value;
    } else if (key === 'time_off_type_id') {
      converted.timeOffTypeId = value;
    } else if (key === 'is_billable') {
      converted.isBillable = value;
    } else if (key === 'hours_per_day') {
      converted.hoursPerDay = value;
    } else if (key === 'allocation_percentage') {
      converted.allocationPercentage = value;
    } else if (dateFields.includes(key)) {
      // Convert date fields to Date object (Drizzle needs Date, not string)
      converted[camelKey] = parseDate(value);
    } else {
      converted[camelKey] = value;
    }
  }

  return converted as T;
}

/**
 * Migrasi tabel assignments
 */
async function migrateAssignments() {
  console.log('\n=== MIGRASI ASSIGNMENTS ===');

  try {
    // Ambil semua data dari MySQL
    const [rows] = await mysqlDb.execute('SELECT * FROM assignments');
    const assignments = rows as any[];

    console.log(`Menemukan ${assignments.length} assignments di MySQL`);

    // Debug: print first assignment to see data types
    if (assignments.length > 0) {
      console.log('Sample data:', JSON.stringify(assignments[0], null, 2));
      console.log('start_date type:', typeof assignments[0].start_date, assignments[0].start_date instanceof Date);
      console.log('end_date type:', typeof assignments[0].end_date, assignments[0].end_date instanceof Date);
    }

    if (assignments.length === 0) {
      console.log('Tidak ada data untuk dimigrasi');
      return;
    }

    // Insert ke Supabase
    let success = 0;
    let failed = 0;

    for (const row of assignments) {
      try {
        const converted = convertToCamelCase<NewAssignment>(row);

        // Debug: print converted data for first row
        if (success === 0 && failed === 0) {
          console.log('Converted data:', JSON.stringify(converted, (key, value) => {
            if (value instanceof Date) {
              return { type: 'Date', value: value.toISOString(), toString: value.toString() };
            }
            return value;
          }, 2));
        }

        await db.insert(schema.assignments).values(converted);
        success++;
      } catch (error) {
        console.error(`Gagal migrasi assignment ${row.uuid}:`, error);
        failed++;
      }
    }

    console.log(`✓ Assignments: ${success} berhasil, ${failed} gagal`);
  } catch (error) {
    console.error('Error migrasi assignments:', error);
  }
}

/**
 * Migrasi tabel actual ke actual_assignments
 */
async function migrateActual() {
  console.log('\n=== MIGRASI ACTUAL ASSIGNMENTS ===');

  try {
    // Ambil semua data dari MySQL
    const [rows] = await mysqlDb.execute('SELECT * FROM actual');
    const actuals = rows as any[];

    console.log(`Menemukan ${actuals.length} actual assignments di MySQL`);

    if (actuals.length === 0) {
      console.log('Tidak ada data untuk dimigrasi');
      return;
    }

    // Insert ke Supabase actual_assignments table
    let success = 0;
    let failed = 0;

    for (const row of actuals) {
      try {
        const converted = convertToCamelCase<NewActualAssignment>(row);

        // Debug: print converted data for first row
        if (success === 0 && failed === 0) {
          console.log('Converted actual data:', JSON.stringify(converted, (key, value) => {
            if (value instanceof Date) {
              return { type: 'Date', value: value.toISOString(), toString: value.toString() };
            }
            return value;
          }, 2));
        }

        // Insert ke tabel actual_assignments dengan status 'completed'
        await db.insert(schema.actualAssignments).values({
          ...converted,
          status: 'completed', // Actual assignments default to completed
        });
        success++;
      } catch (error) {
        console.error(`Gagal migrasi actual ${row.uuid}:`, error);
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
    // Validasi assignments
    const supabaseAssignments = await db.select().from(schema.assignments);
    console.log(`Total assignments di Supabase: ${supabaseAssignments.length}`);

    const [mysqlRows] = await mysqlDb.execute('SELECT COUNT(*) as count FROM assignments');
    const mysqlCount = (mysqlRows as any)[0].count;
    console.log(`Total assignments di MySQL: ${mysqlCount}`);

    if (supabaseAssignments.length === mysqlCount) {
      console.log('✓ Jumlah data assignments cocok!');
    } else {
      console.log(`⚠ Perbedaan jumlah assignments: ${Math.abs(mysqlCount - supabaseAssignments.length)} records`);
    }

    // Validasi actual_assignments
    const supabaseActuals = await db.select().from(schema.actualAssignments);
    console.log(`Total actual_assignments di Supabase: ${supabaseActuals.length}`);

    const [mysqlActualRows] = await mysqlDb.execute('SELECT COUNT(*) as count FROM actual');
    const mysqlActualCount = (mysqlActualRows as any)[0].count;
    console.log(`Total actual di MySQL: ${mysqlActualCount}`);

    if (supabaseActuals.length === mysqlActualCount) {
      console.log('✓ Jumlah data actual_assignments cocok!');
    } else {
      console.log(`⚠ Perbedaan jumlah actual_assignments: ${Math.abs(mysqlActualCount - supabaseActuals.length)} records`);
    }

    // Total summary
    const totalSupabase = supabaseAssignments.length + supabaseActuals.length;
    const totalMysql = mysqlCount + mysqlActualCount;
    console.log(`\nTotal records di Supabase: ${totalSupabase} (assignments: ${supabaseAssignments.length}, actual_assignments: ${supabaseActuals.length})`);
    console.log(`Total records di MySQL: ${totalMysql} (assignments: ${mysqlCount}, actual: ${mysqlActualCount})`);

    if (totalSupabase === totalMysql) {
      console.log('✓ Semua data berhasil dimigrasi!');
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
  console.log('MIGRASI MYSQL KE SUPABASE');
  console.log('========================================');

  console.log('\nMySQL:', process.env.MYSQL_ASSIGNMENTS_DATABASE);
  console.log('Supabase:', connectionString?.replace(/:[^:]+@/, ':****@'));

  // Jalankan migrasi
  await migrateAssignments();
  await migrateActual();

  // Validasi
  await validateMigration();

  console.log('\n========================================');
  console.log('MIGRASI SELESAI');
  console.log('========================================');

  // Cleanup
  await mysqlDb.end();
  await supabaseClient.end();
}

// Jalankan
main().catch(console.error);
