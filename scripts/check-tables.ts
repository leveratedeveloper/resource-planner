// Check what tables exist in the database
// Run with: npx tsx scripts/check-tables.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString);

async function checkTables() {
  try {
    console.log('🔍 Checking existing tables in database...\n');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log('📋 Existing tables:');
    tables.forEach((row: any) => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log(`\nTotal: ${tables.length} tables\n`);

    // Check for expected tables
    const expectedTables = [
      'business_units',
      'departments',
      'brands',
      'employees',
      'employee_brand_assignments',
      'projects',
      'assignments'
    ];

    console.log('📊 Expected tables status:');
    for (const tableName of expectedTables) {
      const exists = tables.some((row: any) => row.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

checkTables();
