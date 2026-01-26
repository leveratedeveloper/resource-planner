// Direct SQL migration runner
// Run with: npx tsx scripts/run-migration.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

async function runMigration() {
  console.log('🚀 Running database migration...\n');

  const sql = postgres(connectionString, { max: 1 });

  try {
    // Read the migration SQL file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'supabase-migration.sql'),
      'utf-8'
    );

    // Split by statement separator and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('--')) continue;

      try {
        await sql.unsafe(statement);

        // Log progress for key operations
        if (statement.includes('CREATE TYPE')) {
          const match = statement.match(/CREATE TYPE.*"(\w+)"/);
          if (match) console.log(`✅ Created enum: ${match[1]}`);
        } else if (statement.includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE\s+"(\w+)"/);
          if (match) console.log(`✅ Created table: ${match[1]}`);
        } else if (statement.includes('ALTER TABLE') && statement.includes('ADD CONSTRAINT')) {
          const match = statement.match(/ALTER TABLE\s+"(\w+)"/);
          if (match) console.log(`✅ Added constraint to: ${match[1]}`);
        } else if (statement.includes('INSERT INTO')) {
          const match = statement.match(/INSERT INTO\s+"(\w+)"/);
          if (match) console.log(`✅ Seeded data: ${match[1]}`);
        }
      } catch (error: any) {
        // Ignore "already exists" errors for idempotency
        if (error.message?.includes('already exists') ||
            error.code === '42P07' || // duplicate table
            error.code === '42710' || // duplicate object
            error.code === '23505') {  // unique violation (for INSERT)
          console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
          continue;
        }

        console.error(`❌ Error executing statement:`, statement.substring(0, 100));
        throw error;
      }
    }

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Run: npx tsx lib/db/seed.ts');
    console.log('2. Verify in Supabase dashboard');
    console.log('3. Continue with API implementation\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
