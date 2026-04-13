/**
 * Database Connection - Environment Specific
 * - Local (development): MySQL
 * - Vercel (production): PostgreSQL
 */

import { createPool, type Pool as MySQLPool } from 'mysql2/promise';
import { Pool as PostgreSQLPool } from 'pg';

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

// PostgreSQL Pool (for Vercel production)
// Use lazy initialization for serverless compatibility
let postgresPool: PostgreSQLPool | null = null;

function getPostgresPool(): PostgreSQLPool {
  if (!postgresPool) {
    postgresPool = new PostgreSQLPool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1, // Single connection per serverless function
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout after 10s
    });
  }
  return postgresPool;
}

// Unified database interface
export const assignmentsDb = {
  async query(sql: string, params?: any[]): Promise<any> {
    if (dbClient === 'postgresql') {
      const pool = getPostgresPool();
      const pgSql = convertMySQLToPostgreSQL(sql);
      const result = await pool.query(pgSql, params);
      // Return array format [rows, fields] to match MySQL
      return [
        result.rows,
        result.fields,
      ];
    } else {
      return mysqlPool.query(sql, params);
    }
  },

  async execute(sql: string, params?: any[]): Promise<any> {
    if (dbClient === 'postgresql') {
      const pool = getPostgresPool();
      const pgSql = convertMySQLToPostgreSQL(sql);
      const result = await pool.query(pgSql, params);
      // Return array format [rows, fields] to match MySQL
      return [
        result.rows,
        result.fields,
      ];
    } else {
      return mysqlPool.execute(sql, params);
    }
  },

  async getConnection() {
    if (dbClient === 'postgresql') {
      const pool = getPostgresPool();
      return {
        query: (sql: string, params?: any[]) => pool.query(convertMySQLToPostgreSQL(sql), params),
        execute: (sql: string, params?: any[]) => pool.query(convertMySQLToPostgreSQL(sql), params),
        release: () => {},
        ping: async () => pool.query('SELECT 1'),
      };
    }
    return mysqlPool.getConnection();
  },

  async end() {
    if (dbClient === 'postgresql') {
      if (postgresPool) {
        await postgresPool.end();
        postgresPool = null;
      }
    } else {
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
    connection.release();
    console.log(`[Assignments DB] Connected using ${dbClient}`);
    return true;
  } catch (error) {
    console.error('[Assignments DB] Connection test failed:', error);
    return false;
  }
}

// Export for direct access if needed
export { mysqlPool, getPostgresPool };
