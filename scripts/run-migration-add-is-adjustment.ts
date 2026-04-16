/**
 * Migration Script: Add is_adjustment column to assignments table
 * Run: npm run migration:add-is-adjustment
 */

import { assignmentsDb } from '../lib/mysql-assignments/db';
import { readFileSync } from 'fs';
import { join } from 'path';

interface DbError extends Error {
  code?: string;
}

async function runMigration(): Promise<void> {
  console.log('🚀 Starting migration: Add is_adjustment column...\n');

  try {
    // Read the SQL migration file
    const sqlMigration = readFileSync(join(process.cwd(), 'migrations/add_is_adjustment_column.sql'), 'utf-8');

    // Split by semicolon to get individual statements
    const statements = sqlMigration
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}:`);
        console.log(statement.substring(0, 100) + '...');

        await assignmentsDb.execute(statement);
        console.log('✅ Success\n');
      } catch (err) {
        const error = err as DbError;
        // Check if error is about duplicate column (already migrated)
        if (
          error.code === 'ER_DUP_FIELDNAME' ||
          error.message.includes('duplicate column') ||
          error.message.includes('already exists')
        ) {
          console.log('⚠️  Column already exists (skipping)\n');
        } else {
          console.error('❌ Error:', error.message);
          throw error;
        }
      }
    }

    console.log('\n✨ Migration completed successfully!');
    console.log('\n📊 What changed:');
    console.log('  - Added is_adjustment column to assignments table');
    console.log('  - Created index idx_assignments_adjustment\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
