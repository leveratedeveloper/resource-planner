/**
 * Database Connection - Environment Specific
 * - Local (development): MySQL with pool
 * - Vercel (production): PostgreSQL with single client per request
 */

import { createPool, type Pool as MySQLPool } from 'mysql2/promise';
import { Pool as PostgreSQLPool, Client as PostgreSQLClient } from 'pg';

// Type for database connection
export type DbClient = 'mysql' | 'postgresql';

// Detect database type from environment
export const getDbClient = (): DbClient => {
  // If DATABASE_URL is set (Vercel Postgres), use PostgreSQL
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    return 'postgresql';
  }
  // Default to MySQL for local development
  return 'mysql';
};

const dbClient = getDbClient();

// MySQL Pool (for local development)
const mysqlPool: MySQLPool = createPool({
  host: process.env.MYSQL_ASSIGNMENTS_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_ASSIGNMENTS_PORT || '3306'),
  user: process.env.MYSQL_ASSIGNMENTS_USER || 'root',
  password: process.env.MYSQL_ASSIGNMENTS_PASSWORD || '',
  database: process.env.MYSQL_ASSIGNMENTS_DATABASE || 'resource_planner_assignments',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
  dateStrings: true,
});

// PostgreSQL client for serverless - ALWAYS create new connection to avoid stale connections
async function getPostgresClient(): Promise<PostgreSQLClient> {
  const client = new PostgreSQLClient({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    statement_timeout: 15000, // 15 seconds - prevent runaway queries
  });
  await client.connect();
  return client;
}

// Unified database interface
export const assignmentsDb = {
  async query(sql: string, params?: any[]): Promise<any> {
    if (dbClient === 'postgresql') {
      const client = await getPostgresClient();
      try {
        const pgSql = convertMySQLToPostgreSQL(sql);
        const result = await client.query(pgSql, params);
        // Return array format [rows, fields] to match MySQL
        return [
          result.rows,
          result.fields,
        ];
      } finally {
        await client.end();
      }
    } else {
      return mysqlPool.query(sql, params);
    }
  },

  async execute(sql: string, params?: any[]): Promise<any> {
    if (dbClient === 'postgresql') {
      const client = await getPostgresClient();
      try {
        const pgSql = convertMySQLToPostgreSQL(sql);
        const result = await client.query(pgSql, params);
        // Return array format [rows, fields] to match MySQL
        return [
          result.rows,
          result.fields,
        ];
      } finally {
        await client.end();
      }
    } else {
      return mysqlPool.execute(sql, params);
    }
  },

  async getConnection() {
    if (dbClient === 'postgresql') {
      const client = await getPostgresClient();
      return {
        query: async (sql: string, params?: any[]) => {
          const pgSql = convertMySQLToPostgreSQL(sql);
          const result = await client.query(pgSql, params);
          return result;
        },
        execute: async (sql: string, params?: any[]) => {
          const pgSql = convertMySQLToPostgreSQL(sql);
          const result = await client.query(pgSql, params);
          return result;
        },
        release: async () => {
          await client.end();
        },
        ping: async () => client.query('SELECT 1'),
      };
    }
    return mysqlPool.getConnection();
  },

  async end() {
    // No-op for PostgreSQL serverless (connections auto-close)
    // MySQL pool still needs to be closed
    if (dbClient === 'mysql') {
      await mysqlPool.end();
    }
  },
};

/**
 * Convert MySQL SQL syntax to PostgreSQL
 */
function convertMySQLToPostgreSQL(sql: string): string {
  return sql
    // Replace backticks with double quotes
    .replace(/`([^`]+)`/g, '"$1"')
    // Replace ? with $1, $2, etc for parameterized queries
    .replace(/\?/g, (match, offset) => {
      // Count parameters before this position
      const before = sql.substring(0, offset);
      const paramCount = (before.match(/\?/g) || []).length;
      return `$${paramCount + 1}`;
    })
    // Replace AUTO_INCREMENT with SERIAL or BIGSERIAL
    .replace(/AUTO_INCREMENT/gi, 'SERIAL')
    // Replace TINYINT to SMALLINT
    .replace(/TINYINT/gi, 'SMALLINT')
    // Replace ENGINE=InnoDB syntax (PostgreSQL doesn't use it)
    .replace(/ENGINE=\w+/gi, '')
    // Replace DEFAULT CHARSET=utf8mb4 (PostgreSQL uses UTF-8 by default)
    .replace(/DEFAULT CHARSET=\w+/gi, '')
    // Replace backslash escapes in strings
    .replace(/\\'/g, "''");
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await assignmentsDb.getConnection();
    await connection.ping();
    await connection.release();
    console.log(`[Assignments DB] Connected using ${dbClient}`);
    return true;
  } catch (error) {
    console.error('[Assignments DB] Connection test failed:', error);
    return false;
  }
}

// Export MySQL pool for direct access (PostgreSQL no longer exports client as it's created per-request)
export { mysqlPool };
