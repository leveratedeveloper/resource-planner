/**
 * Verify actual_assignments table structure
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set!');
}

const sql = postgres(connectionString);

async function verifyTable() {
  console.log('Verifying actual_assignments table...\n');

  try {
    // Get table columns
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'actual_assignments'
      ORDER BY ordinal_position
    `;

    console.log('Table columns:');
    console.log('================');
    for (const col of columns) {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    }

    // Get foreign keys
    const fks = await sql`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'actual_assignments'
    `;

    console.log('\nForeign keys:');
    console.log('============');
    for (const fk of fks) {
      console.log(`  ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }

    // Count rows
    const count = await sql`SELECT COUNT(*) as count FROM actual_assignments`;
    console.log(`\nTotal rows: ${count[0].count}`);

  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

verifyTable().catch(console.error);
