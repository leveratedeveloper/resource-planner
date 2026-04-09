/**
 * Migration Script: Add total_hours column to assignments and actual tables
 * Run: npm run migration:add-total-hours
 */

import { assignmentsDb } from '../lib/mysql-assignments/db';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MySqlError extends Error {
  code?: string;
}

async function runMigration(): Promise<void> {
  console.log('🚀 Starting migration: Add total_hours column...\n');

  try {
    // Read the SQL migration file
    const sqlMigration = readFileSync(join(process.cwd(), 'migrations/add_total_hours_column.sql'), 'utf-8');

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
        const error = err as MySqlError;
        // Check if error is about duplicate column (already migrated)
        if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('duplicate column')) {
          console.log('⚠️  Column already exists (skipping)\n');
        } else {
          console.error('❌ Error:', error.message);
          throw error;
        }
      }
    }

    console.log('\n✨ Migration completed successfully!');
    console.log('\n📊 What changed:');
    console.log('  - Added total_hours column to assignments table');
    console.log('  - Added total_hours column to actual table');
    console.log('  - Calculated total_hours for existing records');
    console.log('  - total_hours will auto-calculate for new/updated assignments\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
