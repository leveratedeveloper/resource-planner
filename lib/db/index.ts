// Load environment variables first (before any other imports that use them)
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// For query purposes
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Export schema for use elsewhere
export * from './schema';
