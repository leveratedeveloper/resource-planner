/**
 * PostgreSQL Assignments Database Connection (Supabase)
 * Separate connection for assignments storage
 * Note: Folder name kept as mysql-assignments for backward compatibility
 */

import { Pool } from 'pg';

export const assignmentsDb = new Pool({
  host: process.env.MYSQL_ASSIGNMENTS_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_ASSIGNMENTS_PORT || '5432'),
  user: process.env.MYSQL_ASSIGNMENTS_USER || 'postgres',
  password: process.env.MYSQL_ASSIGNMENTS_PASSWORD || '',
  database: process.env.MYSQL_ASSIGNMENTS_DATABASE || 'postgres',
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await assignmentsDb.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[Assignments DB] Connection test failed:', error);
    return false;
  }
}
