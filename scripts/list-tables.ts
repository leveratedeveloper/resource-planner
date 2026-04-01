/**
 * List all tables in Supabase
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set!');
}

const sql = postgres(connectionString);

async function listTables() {
  console.log('Tables in Supabase database:\n');

  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('Total tables:', tables.length);
    for (const t of tables) {
      console.log(`  - ${t.table_name}`);
    }

  } catch (error) {
    console.error('Failed to list tables:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

listTables().catch(console.error);
