/**
 * MySQL Assignments Database Connection
 * Separate connection for assignments storage
 */

import { createPool } from 'mysql2/promise';

export const assignmentsDb = createPool({
  host: process.env.MYSQL_ASSIGNMENTS_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_ASSIGNMENTS_PORT || '3306'),
  user: process.env.MYSQL_ASSIGNMENTS_USER || 'root',
  password: process.env.MYSQL_ASSIGNMENTS_PASSWORD || '',
  database: process.env.MYSQL_ASSIGNMENTS_DATABASE || 'resource_planner_assignments',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00', // Use UTC to avoid timezone conversion issues
  dateStrings: true, // Return dates as strings, not Date objects
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await assignmentsDb.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('[Assignments DB] Connection test failed:', error);
    return false;
  }
}
