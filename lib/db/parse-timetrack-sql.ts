import * as fs from 'fs';
import * as readline from 'readline';

// Types for parsed data
export interface ParsedEmployee {
  id: number;
  uuid: string;
  nik: string;
  full_name: string;
  nickname: string | null;
  position: string;
  dept_id: number | null;
  dob: string | null;
  work_start_date: string | null;
  photo: string | null;
  status: string;
  flag: string;
  direct_supervisor: number | null;
  gender: string | null;
}

export interface ParsedBrand {
  id: number;
  uuid: string;
  company_name: string | null;
  client_code: string | null;
  brand_name: string;
  brand_address: string | null;
  pic_brand_name: string | null;
  pic_brand_phone: string | null;
  pic_finance_name: string | null;
  pic_finance_phone: string | null;
  pic_title: string | null;
  pic_email: string | null;
  tax_account: string | null;
  industry_category: string | null;
  brand_website: string | null;
  logo: string | null;
  description: string | null;
  flag: string;
}

export interface ParsedCampaign {
  id: number;
  uuid: string;
  brand_id: number;
  company_id: number | null;
  business_unit_id: number | null;
  io_number: string | null;
  campaign_name: string;
  currency: string;
  budget: number;
  asf: number;
  grand_total: number;
  io_file: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: number | null;
  state: string;
  flag: string;
  quotation_reference: string | null;
}

export interface ParsedDepartment {
  id: number;
  department_name: string;
  flag: string;
}

export interface ParsedData {
  employees: ParsedEmployee[];
  brands: ParsedBrand[];
  campaigns: ParsedCampaign[];
  departments: ParsedDepartment[];
  businessUnitIds: Set<number>;
}

/**
 * Parse a value from SQL INSERT statement
 */
function parseValue(value: string): string | number | null {
  value = value.trim();

  // NULL
  if (value === 'NULL') {
    return null;
  }

  // String (quoted)
  if (value.startsWith("'") && value.endsWith("'")) {
    // Remove quotes and unescape
    return value
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value.includes('.') ? parseFloat(value) : parseInt(value, 10);
  }

  // Return as-is if can't parse
  return value;
}

/**
 * Parse a VALUES row from SQL INSERT
 * Format: (val1, val2, 'string with, comma', val3)
 */
function parseValuesRow(row: string): (string | number | null)[] {
  const values: (string | number | null)[] = [];
  let current = '';
  let inString = false;
  let escapeNext = false;
  let parenDepth = 0;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escapeNext = true;
      continue;
    }

    if (char === "'" && !escapeNext) {
      inString = !inString;
      current += char;
      continue;
    }

    if (!inString) {
      if (char === '(') {
        parenDepth++;
        if (parenDepth > 1) current += char;
        continue;
      }

      if (char === ')') {
        parenDepth--;
        if (parenDepth > 0) current += char;
        continue;
      }

      if (char === ',' && parenDepth === 1) {
        values.push(parseValue(current));
        current = '';
        continue;
      }
    }

    current += char;
  }

  // Push last value
  if (current.trim()) {
    values.push(parseValue(current));
  }

  return values;
}

/**
 * Parse INSERT INTO statement to extract column names and values
 */
function parseInsertStatement(
  insertLine: string,
  valuesLines: string[]
): { columns: string[], rows: (string | number | null)[][] } {
  // Extract table name and columns
  const columnsMatch = insertLine.match(/INSERT INTO `(\w+)` \(([^)]+)\)/);
  if (!columnsMatch) {
    throw new Error(`Failed to parse INSERT statement: ${insertLine}`);
  }

  const columns = columnsMatch[2]
    .split(',')
    .map(col => col.trim().replace(/`/g, ''));

  // Parse VALUES rows
  const rows: (string | number | null)[][] = [];
  let currentRow = '';

  for (const line of valuesLines) {
    currentRow += line;

    // Check if this completes a row (ends with ),)
    if (currentRow.match(/\)\s*,?\s*$/)) {
      const row = parseValuesRow(currentRow);
      if (row.length === columns.length) {
        rows.push(row);
      }
      currentRow = '';
    }
  }

  return { columns, rows };
}

/**
 * Map parsed row to typed object
 */
function mapRow<T>(columns: string[], values: (string | number | null)[]): T {
  const obj: any = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = values[i];
  }
  return obj as T;
}

/**
 * Parse Timetrack SQL dump file
 */
export async function parseTimetrackSql(
  filePath: string,
  options: {
    onlyActive?: boolean;
    limitEmployees?: number;
    limitBrands?: number;
    limitCampaigns?: number;
    verbose?: boolean;
  } = {}
): Promise<ParsedData> {
  const {
    onlyActive = true,
    limitEmployees,
    limitBrands,
    limitCampaigns,
    verbose = false
  } = options;

  const employees: ParsedEmployee[] = [];
  const brands: ParsedBrand[] = [];
  const campaigns: ParsedCampaign[] = [];
  const departments: ParsedDepartment[] = [];
  const businessUnitIds = new Set<number>();

  let currentTable: string | null = null;
  let currentInsertLine = '';
  let valuesLines: string[] = [];
  let lineCount = 0;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  if (verbose) console.log('🔍 Parsing SQL dump...');

  for await (const line of rl) {
    lineCount++;

    if (lineCount % 10000 === 0 && verbose) {
      console.log(`  📄 Processed ${lineCount} lines...`);
    }

    // Detect INSERT INTO statement
    if (line.match(/^INSERT INTO `(employees|brands|campaigns|departments)`/)) {
      const tableMatch = line.match(/^INSERT INTO `(\w+)`/);
      if (tableMatch) {
        currentTable = tableMatch[1];
        currentInsertLine = line;
        valuesLines = [];
      }
      continue;
    }

    // Collect VALUES lines
    if (currentTable && line.trim().startsWith('VALUES')) {
      valuesLines.push(line.replace(/^VALUES\s*/, ''));
      continue;
    }

    // Continue collecting multi-line VALUES
    if (currentTable && valuesLines.length > 0) {
      const trimmed = line.trim();

      // End of VALUES block
      if (trimmed === '' || trimmed.startsWith('/*!') || trimmed.startsWith('UNLOCK')) {
        try {
          const { columns, rows } = parseInsertStatement(currentInsertLine, valuesLines);

          // Process rows based on table
          if (currentTable === 'employees') {
            for (const row of rows) {
              const emp = mapRow<ParsedEmployee>(columns, row);
              if (!onlyActive || emp.flag === 'active') {
                employees.push(emp);
                if (limitEmployees && employees.length >= limitEmployees) break;
              }
            }
          } else if (currentTable === 'brands') {
            for (const row of rows) {
              const brand = mapRow<ParsedBrand>(columns, row);
              if (!onlyActive || brand.flag === 'active') {
                brands.push(brand);
                if (limitBrands && brands.length >= limitBrands) break;
              }
            }
          } else if (currentTable === 'campaigns') {
            for (const row of rows) {
              const campaign = mapRow<ParsedCampaign>(columns, row);
              if (!onlyActive || campaign.flag === 'active') {
                campaigns.push(campaign);
                if (campaign.business_unit_id) {
                  businessUnitIds.add(campaign.business_unit_id);
                }
                if (limitCampaigns && campaigns.length >= limitCampaigns) break;
              }
            }
          } else if (currentTable === 'departments') {
            for (const row of rows) {
              const dept = mapRow<ParsedDepartment>(columns, row);
              departments.push(dept);
            }
          }
        } catch (error) {
          if (verbose) {
            console.warn(`⚠️  Failed to parse ${currentTable} at line ${lineCount}:`, error);
          }
        }

        currentTable = null;
        currentInsertLine = '';
        valuesLines = [];
      } else {
        // Continue collecting VALUES
        valuesLines.push(line);
      }
    }
  }

  if (verbose) {
    console.log(`✅ Parsing complete!`);
    console.log(`   Employees: ${employees.length}`);
    console.log(`   Brands: ${brands.length}`);
    console.log(`   Campaigns: ${campaigns.length}`);
    console.log(`   Departments: ${departments.length}`);
    console.log(`   Business Units: ${businessUnitIds.size}`);
  }

  return {
    employees,
    brands,
    campaigns,
    departments,
    businessUnitIds
  };
}
