import { readFileSync } from 'fs';

/**
 * Utility to parse MySQL dump file and extract data from INSERT statements
 */

interface ParsedRow {
  [key: string]: any;
}

interface ParsedTable {
  columns: string[];
  rows: ParsedRow[];
}

/**
 * Parse a single value from MySQL INSERT statement
 */
function parseValue(value: string): any {
  // Handle NULL
  if (value === 'NULL') {
    return null;
  }

  // Handle strings (single-quoted)
  if (value.startsWith("'")) {
    // Remove surrounding quotes and unescape
    return value
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }

  // Handle numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value.includes('.') ? parseFloat(value) : parseInt(value, 10);
  }

  return value;
}

/**
 * Parse VALUES clause from INSERT statement
 * Handles multi-row inserts like: VALUES (1,'a'),(2,'b'),(3,'c')
 */
function parseValues(valuesStr: string): any[][] {
  const rows: any[][] = [];
  let current = '';
  let inString = false;
  let escaped = false;
  let depth = 0;
  let currentRow: any[] = [];

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "'" && !escaped) {
      inString = !inString;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      continue;
    }

    // Outside strings
    if (char === '(') {
      depth++;
      if (depth === 1) {
        // Start of new row
        currentRow = [];
        current = '';
        continue;
      }
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        // End of row
        if (current.trim()) {
          currentRow.push(parseValue(current.trim()));
        }
        rows.push(currentRow);
        current = '';
        continue;
      }
    } else if (char === ',' && depth === 1) {
      // Value separator within row
      currentRow.push(parseValue(current.trim()));
      current = '';
      continue;
    }

    if (depth > 0) {
      current += char;
    }
  }

  return rows;
}

/**
 * Extract column names from INSERT statement
 */
function extractColumns(insertLine: string): string[] {
  const match = insertLine.match(/INSERT INTO `[^`]+` \(([^)]+)\)/);
  if (!match) {
    throw new Error('Could not extract column names from INSERT statement');
  }

  return match[1]
    .split(',')
    .map(col => col.trim().replace(/`/g, ''));
}

/**
 * Parse a complete INSERT statement (may span multiple lines)
 */
export function parseInsertStatement(tableName: string, sqlDump: string): ParsedTable {
  // Find the INSERT statement for this table
  const insertRegex = new RegExp(`INSERT INTO \\\`${tableName}\\\` \\([^)]+\\)[\\s\\S]*?VALUES[\\s\\S]*?;`, 'i');
  const match = sqlDump.match(insertRegex);

  if (!match) {
    console.warn(`No INSERT statement found for table: ${tableName}`);
    return { columns: [], rows: [] };
  }

  const fullStatement = match[0];

  // Extract columns
  const columns = extractColumns(fullStatement);

  // Extract VALUES clause
  const valuesMatch = fullStatement.match(/VALUES\s+([\s\S]*);/i);
  if (!valuesMatch) {
    console.warn(`No VALUES clause found for table: ${tableName}`);
    return { columns, rows: [] };
  }

  // Parse all rows
  const rowArrays = parseValues(valuesMatch[1]);

  // Convert to objects
  const rows: ParsedRow[] = rowArrays.map(rowArray => {
    const row: ParsedRow = {};
    columns.forEach((col, idx) => {
      row[col] = rowArray[idx];
    });
    return row;
  });

  return { columns, rows };
}

/**
 * Load and cache the SQL dump file
 */
let cachedSqlDump: string | null = null;

export function loadSqlDump(filePath: string): string {
  if (!cachedSqlDump) {
    console.log(`Loading SQL dump from: ${filePath}`);
    cachedSqlDump = readFileSync(filePath, 'utf-8');
    console.log(`Loaded ${cachedSqlDump.length} characters`);
  }
  return cachedSqlDump;
}

/**
 * Main parsing function for all tables
 */
export function parseTable(tableName: string, sqlDumpPath: string): ParsedTable {
  const sqlDump = loadSqlDump(sqlDumpPath);
  return parseInsertStatement(tableName, sqlDump);
}

/**
 * Filter rows by condition
 */
export function filterRows(rows: ParsedRow[], condition: (row: ParsedRow) => boolean): ParsedRow[] {
  return rows.filter(condition);
}

/**
 * Sort rows by field
 */
export function sortRows(rows: ParsedRow[], field: string, order: 'asc' | 'desc' = 'asc'): ParsedRow[] {
  return rows.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Limit rows
 */
export function limitRows(rows: ParsedRow[], limit: number, offset: number = 0): ParsedRow[] {
  return rows.slice(offset, offset + limit);
}
