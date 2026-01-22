// Migration script to apply Drizzle migrations to the database
// Run with: npx tsx scripts/migrate.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Starting database migration...');

  // Create connection for migration
  const migrationClient = postgres(connectionString!, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Database is ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
