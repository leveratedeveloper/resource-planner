/**
 * Check data in Supabase
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set!');
}

const sql = postgres(connectionString);

async function checkData() {
  console.log('Checking Supabase data...\n');

  try {
    // Check assignments
    const assignments = await sql`
      SELECT COUNT(*) as count,
             COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
             COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM assignments
    `;
    console.log('Assignments:');
    console.log(`  Total: ${assignments[0].count}`);
    console.log(`  - Draft: ${assignments[0].draft}`);
    console.log(`  - Confirmed: ${assignments[0].confirmed}`);
    console.log(`  - Completed: ${assignments[0].completed}`);

    // Check actual_assignments
    const actuals = await sql`
      SELECT COUNT(*) as count,
             COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
             COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM actual_assignments
    `;
    console.log('\nActual Assignments:');
    console.log(`  Total: ${actuals[0].count}`);
    console.log(`  - Draft: ${actuals[0].draft}`);
    console.log(`  - Confirmed: ${actuals[0].confirmed}`);
    console.log(`  - Completed: ${actuals[0].completed}`);

    // Sample data
    const sampleAssignments = await sql`
      SELECT id, employee_id, project_id, start_date, end_date, status
      FROM assignments
      LIMIT 3
    `;
    console.log('\nSample Assignments:');
    for (const row of sampleAssignments) {
      console.log(`  ${row.id}: ${row.start_date} to ${row.end_date} (${row.status})`);
    }

    const sampleActuals = await sql`
      SELECT id, employee_id, project_id, start_date, end_date, status
      FROM actual_assignments
      LIMIT 3
    `;
    console.log('\nSample Actual Assignments:');
    for (const row of sampleActuals) {
      console.log(`  ${row.id}: ${row.start_date} to ${row.end_date} (${row.status})`);
    }

  } catch (error) {
    console.error('Failed to check data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkData().catch(console.error);
