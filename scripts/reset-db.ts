// Database reset script - drops old tables and runs the new migration
// Run with: npx tsx scripts/reset-db.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const sql = postgres(connectionString);

async function resetDatabase() {
  console.log('🗑️  Dropping existing tables...');
  
  // Drop old tables in reverse order of dependencies
  const dropStatements = [
    'DROP TABLE IF EXISTS "assignments" CASCADE',
    'DROP TABLE IF EXISTS "projects" CASCADE',
    'DROP TABLE IF EXISTS "resources" CASCADE',
    'DROP TABLE IF EXISTS "brands" CASCADE',
    'DROP TABLE IF EXISTS "employee_brand_assignments" CASCADE',
    'DROP TABLE IF EXISTS "employees" CASCADE',
    'DROP TABLE IF EXISTS "departments" CASCADE',
    'DROP TABLE IF EXISTS "business_units" CASCADE',
    'DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE',
    // Drop enums too
    'DROP TYPE IF EXISTS "assignment_status" CASCADE',
    'DROP TYPE IF EXISTS "brand_status" CASCADE',
    'DROP TYPE IF EXISTS "employment_status" CASCADE',
    'DROP TYPE IF EXISTS "project_status" CASCADE',
    'DROP TYPE IF EXISTS "visibility" CASCADE',
  ];

  for (const statement of dropStatements) {
    try {
      await sql.unsafe(statement);
      console.log(`  ✓ ${statement.split(' ')[4] || statement.split(' ')[3]}`);
    } catch (error) {
      // Ignore errors for tables that don't exist
    }
  }

  console.log('\n📄 Reading migration file...');
  const migrationPath = join(__dirname, '../drizzle/0000_romantic_naoko.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  
  console.log('🚀 Applying migration...');
  // Split by statement-breakpoint and execute each statement
  const statements = migrationSql.split('-->');
  
  for (const statement of statements) {
    const cleanStatement = statement
      .replace('statement-breakpoint', '')
      .trim();
    
    if (cleanStatement) {
      try {
        await sql.unsafe(cleanStatement);
        // Extract table/type name for logging
        const match = cleanStatement.match(/CREATE (?:TABLE|TYPE) (?:"public"\.)?"([^"]+)"/);
        const alterMatch = cleanStatement.match(/ALTER TABLE "([^"]+)"/);
        if (match) {
          console.log(`  ✓ Created ${match[1]}`);
        } else if (alterMatch) {
          console.log(`  ✓ Added FK to ${alterMatch[1]}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed:`, error.message);
        throw error;
      }
    }
  }

  console.log('\n✅ Database reset complete!');
  console.log('\nNext step: Run "npx tsx lib/db/seed.ts" to populate with sample data');
  
  await sql.end();
  process.exit(0);
}

resetDatabase().catch((error) => {
  console.error('❌ Reset failed:', error);
  process.exit(1);
});
