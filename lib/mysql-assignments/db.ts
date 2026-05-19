/**
 * Database Connection - Environment Specific
 * - Local (development): MySQL with pool
 * - Vercel (production): PostgreSQL with single client per request
 */

import { Pool as PostgreSQLPool, Client as PostgreSQLClient } from 'pg';
import type { Pool as MySQLPool } from 'mysql2/promise';

// Type for database connection
export type DbClient = 'mysql' | 'postgresql';

// Detect database type from environment
export const getDbClient = (): DbClient => {
  // If DATABASE_URL is set, use PostgreSQL (production)
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    return 'postgresql';
  }
  // Default to MySQL for local development
  return 'mysql';
};

const dbClient = getDbClient();

// MySQL Pool (lazy — only loaded when dbClient === 'mysql', so the Workers
// bundler does not pull in mysql2 on the production Postgres path).
let _mysqlPool: MySQLPool | null = null;
async function getMysqlPool(): Promise<MySQLPool> {
  if (_mysqlPool) return _mysqlPool;
  const { createPool } = await import('mysql2/promise');
  _mysqlPool = createPool({
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
  return _mysqlPool;
}

// PostgreSQL client for serverless - ALWAYS create new connection to avoid stale connections
async function getPostgresClient(): Promise<PostgreSQLClient> {
  const client = new PostgreSQLClient({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
      const pool = await getMysqlPool();
      return pool.query(sql, params);
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
      const pool = await getMysqlPool();
      return pool.execute(sql, params);
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
    const pool = await getMysqlPool();
    return pool.getConnection();
  },

  async end() {
    // No-op for PostgreSQL serverless (connections auto-close)
    // MySQL pool still needs to be closed if it was ever opened
    if (dbClient === 'mysql' && _mysqlPool) {
      await _mysqlPool.end();
      _mysqlPool = null;
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

