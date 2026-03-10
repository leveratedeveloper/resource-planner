// Load environment variables first (before any other imports that use them)
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection
const connectionString = process.env.DATABASE_URL;

// Singleton pattern for Next.js hot reloading
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  db: any;
};

// Only create PostgreSQL connection if DATABASE_URL is set and is postgresql://
if (connectionString && connectionString.startsWith('postgresql://')) {
  const client = globalForDb.conn ?? postgres(connectionString, { max: 10 });

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.conn = client;
  }

  globalForDb.db = drizzle(client, { schema });
} else {
  console.warn('PostgreSQL not configured - using MySQL REST API instead');
}

export const db = globalForDb.db;

// Export schema for use elsewhere
export * from './schema';
