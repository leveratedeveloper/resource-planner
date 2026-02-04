import { parseTable, filterRows, sortRows, limitRows } from './parse-mysql-dump';
import { writeFileSync } from 'fs';
import { db } from '../lib/db';
import {
  businessUnits,
  departments,
  brands,
  employees,
  projects,
  assignments,
  projectCategories
} from '../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Real Data Migration: MySQL → Supabase PostgreSQL
 *
 * Migrates production data from MySQL dump to Supabase with:
 * - ID mapping (MySQL int → PostgreSQL UUID)
 * - Data transformation
 * - Relationship preservation
 * - Phase-by-phase execution
 */

const SQL_DUMP_PATH = './timetrack_prd_db_neptune14-00012026.sql';

// ============ ID MAPPING SYSTEM ============

interface IdMappings {
  business_units: Map<number, string>;
  departments: Map<number, string>;
  brands: Map<number, string>;
  employees: Map<number, string>;
  campaigns: Map<number, string>;
  pitches: Map<number, string>;
  tasks: Map<number, string>;
  project_categories: Map<string, string>; // name → uuid
}

const idMappings: IdMappings = {
  business_units: new Map(),
  departments: new Map(),
  brands: new Map(),
  employees: new Map(),
  campaigns: new Map(),
  pitches: new Map(),
  tasks: new Map(),
  project_categories: new Map(),
};

function generateUuid(): string {
  return crypto.randomUUID();
}

function mapId(table: keyof IdMappings, mysqlId: number, uuid?: string): string {
  const mapping = idMappings[table] as Map<number, string>;

  if (mapping.has(mysqlId)) {
    return mapping.get(mysqlId)!;
  }

  const newUuid = uuid || generateUuid();
  mapping.set(mysqlId, newUuid);
  return newUuid;
}

function getMapping(table: keyof IdMappings, mysqlId: number): string | undefined {
  const mapping = idMappings[table] as Map<number, string>;
  return mapping.get(mysqlId);
}

// ============ HELPER FUNCTIONS ============

/**
 * Generate department code from name
 */
function generateDepartmentCode(name: string, index: number): string {
  const words = name.split(' ').filter(w => w.length > 0);
  let code = '';
  if (words.length === 1) {
    code = words[0].substring(0, 3).toUpperCase();
  } else {
    code = words.map(w => w[0]).join('').toUpperCase();
  }
  // Add index suffix to ensure uniqueness
  return `${code}${index + 1}`;
}

/**
 * Generate color based on index
 */
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * Map MySQL status to PostgreSQL enum
 */
function mapBrandStatus(flag: string): 'active' | 'inactive' | 'prospect' {
  if (flag === 'active') return 'active';
  if (flag === 'inactive') return 'inactive';
  return 'prospect';
}

function mapEmploymentStatus(flag: string): 'active' | 'inactive' | 'contractor' {
  if (flag === 'active') return 'active';
  if (flag === 'inactive') return 'inactive';
  return 'contractor';
}

function mapVisibility(flag: string): 'active' | 'archived' {
  return flag === 'active' ? 'active' : 'archived';
}

function mapProjectStatus(state: string): 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' {
  if (state === 'publish') return 'active';
  if (state === 'draft') return 'planning';
  return 'active';
}

function mapAssignmentStatus(status: string): 'draft' | 'confirmed' | 'completed' {
  if (status === 'not_started') return 'draft';
  if (status === 'on_progress') return 'confirmed';
  if (status === 'finish') return 'completed';
  return 'confirmed';
}

function mapPitchStatus(status: string): 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' {
  if (status === 'on_going') return 'active';
  if (status === 'win') return 'completed';
  if (status === 'loss') return 'cancelled';
  return 'planning';
}

// ============ PHASE 1: REFERENCE DATA ============

async function migrateBusinessUnits() {
  console.log('\n=== Phase 1.1: Migrating Business Units ===');

  const parsed = parseTable('business_units', SQL_DUMP_PATH);
  console.log(`Found ${parsed.rows.length} business units`);

  const inserted = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];

    const uuid = mapId('business_units', row.id);

    const data = {
      id: uuid,
      name: row.business_unit_name,
      code: row.business_unit_prefix,
      color: getColor(i),
      description: null,
      isActive: row.business_unit_status === 'active',
    };

    try {
      const [result] = await db.insert(businessUnits).values(data).returning();
      inserted.push(result);
      console.log(`✓ Inserted: ${data.name} (${data.code})`);
    } catch (error) {
      console.error(`✗ Failed to insert ${data.name}:`, error);
    }
  }

  console.log(`Migrated ${inserted.length} business units`);
  return inserted;
}

async function migrateDepartments() {
  console.log('\n=== Phase 1.2: Migrating Departments ===');

  const parsed = parseTable('departments', SQL_DUMP_PATH);
  const activeRows = filterRows(parsed.rows, row => row.flag === 'active');
  console.log(`Found ${activeRows.length} active departments`);

  const inserted = [];

  for (let i = 0; i < activeRows.length; i++) {
    const row = activeRows[i];

    const uuid = mapId('departments', row.id);
    const code = generateDepartmentCode(row.department_name, i);

    const data = {
      id: uuid,
      businessUnitId: null, // Per plan: standalone departments
      name: row.department_name,
      code: code,
      color: getColor(i),
      description: null,
      isActive: true,
    };

    try {
      const [result] = await db.insert(departments).values(data).returning();
      inserted.push(result);
      console.log(`✓ Inserted: ${data.name} (${data.code})`);
    } catch (error) {
      console.error(`✗ Failed to insert ${data.name}:`, error);
    }
  }

  console.log(`Migrated ${inserted.length} departments`);
  return inserted;
}

async function migrateBrands() {
  console.log('\n=== Phase 1.3: Migrating Brands ===');

  const parsed = parseTable('brands', SQL_DUMP_PATH);
  const activeRows = filterRows(parsed.rows, row => row.flag === 'active');
  console.log(`Found ${activeRows.length} active brands`);

  // Get top 40 brands (can adjust this number)
  const topBrands = limitRows(activeRows, 40, 0);
  console.log(`Migrating top ${topBrands.length} brands`);

  const inserted = [];

  for (let i = 0; i < topBrands.length; i++) {
    const row = topBrands[i];

    const uuid = mapId('brands', row.id);

    const data = {
      id: uuid,
      businessUnitId: null, // Will be set if we have business_unit_id in brands table
      name: row.brand_name || row.company_name || 'Unknown Brand',
      clientCode: row.client_code ? String(row.client_code) : null,
      color: getColor(i),
      logo: row.logo || null,
      website: row.brand_website || null,
      contactName: row.pic_brand_name || null,
      contactTitle: row.pic_title || null,
      contactEmail: row.pic_email || null,
      contactPhone: row.pic_brand_phone || null,
      industryCategory: row.industry_category || null,
      description: row.description || null,
      status: mapBrandStatus(row.flag),
    };

    try {
      const [result] = await db.insert(brands).values(data).returning();
      inserted.push(result);
      console.log(`✓ Inserted: ${data.name}`);
    } catch (error) {
      console.error(`✗ Failed to insert ${data.name}:`, error);
    }
  }

  console.log(`Migrated ${inserted.length} brands`);
  return inserted;
}

// ============ PHASE 2: EMPLOYEE DATA ============

async function migrateEmployees() {
  console.log('\n=== Phase 2: Migrating Employees ===');

  const parsed = parseTable('employees', SQL_DUMP_PATH);
  const tasksParsed = parseTable('tasks', SQL_DUMP_PATH);

  // Get employee IDs that have tasks
  const employeeIdsWithTasks = new Set<number>();
  tasksParsed.rows.forEach(task => {
    if (task.task_creator && task.flag === 'active') {
      employeeIdsWithTasks.add(task.task_creator);
    }
  });

  console.log(`Found ${employeeIdsWithTasks.size} employees with tasks`);

  // Filter: active employees, prioritizing those with tasks
  const activeRows = filterRows(parsed.rows, row => row.flag === 'active');
  const employeesWithTasks = filterRows(activeRows, row => employeeIdsWithTasks.has(row.id));
  const employeesWithoutTasks = filterRows(activeRows, row => !employeeIdsWithTasks.has(row.id));

  console.log(`Active employees with tasks: ${employeesWithTasks.length}`);
  console.log(`Active employees without tasks: ${employeesWithoutTasks.length}`);

  // Take all employees with tasks + fill remaining with other employees
  const topEmployees = [
    ...employeesWithTasks,
    ...employeesWithoutTasks.slice(0, Math.max(0, 200 - employeesWithTasks.length))
  ];
  console.log(`Migrating ${topEmployees.length} employees`);

  const inserted = [];

  // First pass: Insert all employees without supervisor references
  for (const row of topEmployees) {
    const uuid = mapId('employees', row.id);
    const deptUuid = row.dept_id ? getMapping('departments', row.dept_id) : null;

    const data = {
      id: uuid,
      employeeNumber: row.nik,
      fullName: row.full_name,
      nickname: row.nickname || null,
      email: null, // Not in MySQL dump
      photo: row.photo || null,
      position: row.position,
      departmentId: deptUuid,
      businessUnitId: null, // Not in MySQL employees table
      directSupervisorId: null, // Will be updated in second pass
      weeklyCapacity: 40,
      workStartDate: row.work_start_date || null,
      dateOfBirth: row.dob || null,
      employmentStatus: mapEmploymentStatus(row.flag),
      visibility: mapVisibility(row.status),
    };

    try {
      const [result] = await db.insert(employees).values(data).returning();
      inserted.push({ result, mysqlRow: row });
      console.log(`✓ Inserted: ${data.fullName} (${data.employeeNumber})`);
    } catch (error) {
      console.error(`✗ Failed to insert ${data.fullName}:`, error);
    }
  }

  // Second pass: Update supervisor references
  console.log('\nUpdating supervisor relationships...');
  let supervisorUpdates = 0;

  for (const { result, mysqlRow } of inserted) {
    if (mysqlRow.direct_supervisor) {
      const supervisorUuid = getMapping('employees', mysqlRow.direct_supervisor);
      if (supervisorUuid) {
        try {
          await db
            .update(employees)
            .set({ directSupervisorId: supervisorUuid })
            .where(eq(employees.id, result.id));
          supervisorUpdates++;
        } catch (error) {
          console.error(`✗ Failed to update supervisor for ${result.fullName}:`, error);
        }
      }
    }
  }

  console.log(`Migrated ${inserted.length} employees (${supervisorUpdates} supervisor links)`);
  return inserted.map(i => i.result);
}

// ============ PHASE 3: PROJECT DATA ============

async function getProjectCategoryMapping() {
  // Get existing project categories from database
  const categories = await db.query.projectCategories.findMany();

  const mapping = new Map<string, string>();
  categories.forEach(cat => {
    idMappings.project_categories.set(cat.name, cat.id);
    mapping.set(cat.name.toLowerCase(), cat.id);
  });

  return mapping;
}

function categorizeProject(row: any, categoryMapping: Map<string, string>): string | null {
  const budget = parseFloat(row.budget) || 0;
  const name = (row.campaign_name || '').toLowerCase();

  // Check for specific categories
  if (name.includes('operation')) {
    return categoryMapping.get('operational') ?? null;
  }
  if (name.includes('pitch') || name.includes('tentative')) {
    return categoryMapping.get('pitch') ?? null;
  }
  if (budget === 0) {
    return categoryMapping.get('operational') ?? null;
  }

  // Default to Campaign
  return categoryMapping.get('campaign') ?? null;
}

async function migrateCampaigns() {
  console.log('\n=== Phase 3.1: Migrating Campaigns ===');

  const parsed = parseTable('campaigns', SQL_DUMP_PATH);
  const tasksParsed = parseTable('tasks', SQL_DUMP_PATH);

  // Get campaign IDs that have tasks
  const campaignIdsWithTasks = new Set<number>();
  tasksParsed.rows.forEach(task => {
    if (task.reference_id && task.flag === 'active') {
      campaignIdsWithTasks.add(task.reference_id);
    }
  });

  console.log(`Found ${campaignIdsWithTasks.size} campaigns with tasks`);

  // Filter: active campaigns that have tasks
  const filtered = filterRows(parsed.rows, row => {
    if (row.flag !== 'active') return false;
    return campaignIdsWithTasks.has(row.id);
  });

  console.log(`Found ${filtered.length} active campaigns with tasks`);

  // Sort by created_at and take top 100
  const sorted = sortRows(filtered, 'created_at', 'desc');
  const topCampaigns = limitRows(sorted, 100, 0);
  console.log(`Migrating top ${topCampaigns.length} campaigns`);

  const categoryMapping = await getProjectCategoryMapping();
  const inserted = [];

  for (const row of topCampaigns) {
    const uuid = mapId('campaigns', row.id);
    const brandUuid = row.brand_id ? getMapping('brands', row.brand_id) : null;
    const businessUnitUuid = row.business_unit_id ? getMapping('business_units', row.business_unit_id) : null;
    const createdByUuid = row.created_by ? getMapping('employees', row.created_by) : null;
    const categoryUuid = categorizeProject(row, categoryMapping);

    // Skip if brand not migrated
    if (!brandUuid) {
      console.log(`⊘ Skipped: ${row.campaign_name} (brand not migrated)`);
      continue;
    }

    const data = {
      id: uuid,
      brandId: brandUuid,
      businessUnitId: businessUnitUuid,
      projectCategoryId: categoryUuid,
      projectTypeId: null,
      name: row.campaign_name,
      projectNumber: row.io_number || null,
      description: row.notes || null,
      color: '#10b981',
      budget: row.budget ? String(row.budget) : null,
      currency: row.currency || 'IDR',
      startDate: row.start_date || null,
      endDate: row.end_date || null,
      status: mapProjectStatus(row.state),
      createdById: createdByUuid,
      notes: null,
    };

    try {
      const [result] = await db.insert(projects).values(data).returning();
      inserted.push(result);
      console.log(`✓ Inserted: ${data.name}`);
    } catch (error) {
      console.error(`✗ Failed to insert ${data.name}:`, error);
    }
  }

  console.log(`Migrated ${inserted.length} campaigns`);
  return inserted;
}

async function migratePitches() {
  console.log('\n=== Phase 3.2: Migrating Pitches ===');

  const parsed = parseTable('pitches', SQL_DUMP_PATH);

  // Filter: recent pitches (on_going or win)
  const filtered = filterRows(parsed.rows, row => {
    return row.status === 'on_going' || row.status === 'win';
  });

  console.log(`Found ${filtered.length} recent pitches`);

  // Sort by date_submit and take top 30
  const sorted = sortRows(filtered, 'date_submit', 'desc');
  const topPitches = limitRows(sorted, 30, 0);
  console.log(`Migrating top ${topPitches.length} pitches`);

  const categoryMapping = await getProjectCategoryMapping();
  const pitchCategoryUuid = categoryMapping.get('pitch');
  const inserted = [];

  for (const row of topPitches) {
    const uuid = mapId('pitches', row.id);
    const brandUuid = row.brand_id ? getMapping('brands', row.brand_id) : null;
    const createdByUuid = row.created_by ? getMapping('employees', row.created_by) : null;

    // Skip if brand not migrated
    if (!brandUuid) {
      console.log(`⊘ Skipped: ${row.pitch_name} (brand not migrated)`);
      continue;
    }

    const data = {
      id: uuid,
      brandId: brandUuid,
      businessUnitId: null,
      projectCategoryId: pitchCategoryUuid,
      projectTypeId: null,
      name: row.pitch_name,
      projectNumber: row.pitch_number || null,
      description: row.notes || null,
      color: '#f59e0b',
      budget: row.budget ? String(row.budget) : null,
      currency: row.currency || 'IDR',
      startDate: row.date_submit || null,
      endDate: null,
      status: mapPitchStatus(row.status),
      createdById: createdByUuid,
      notes: null,
    };

    try {
      const [result] = await db.insert(projects).values(data).returning();
      inserted.push(result);
      console.log(`✓ Inserted: ${data.name}`);
    } catch (error) {
      console.error(`✗ Failed to insert ${data.name}:`, error);
    }
  }

  console.log(`Migrated ${inserted.length} pitches`);
  return inserted;
}

// ============ PHASE 4: ASSIGNMENT DATA ============

async function migrateAssignments() {
  console.log('\n=== Phase 4: Migrating Assignments ===');

  const parsed = parseTable('tasks', SQL_DUMP_PATH);

  // Filter: active tasks with reference_id (campaign) and task_creator (employee)
  const filtered = filterRows(parsed.rows, row => {
    if (row.flag !== 'active') return false;
    if (!row.task_creator) return false;
    if (!row.reference_id) return false;

    // Check if employee and campaign are migrated
    const employeeUuid = getMapping('employees', row.task_creator);
    const projectUuid = getMapping('campaigns', row.reference_id);

    return employeeUuid !== undefined && projectUuid !== undefined;
  });

  console.log(`Found ${filtered.length} tasks with migrated references`);

  // Take first 400
  const topTasks = limitRows(filtered, 400, 0);
  console.log(`Migrating ${topTasks.length} assignments`);

  const inserted = [];

  for (const row of topTasks) {
    const uuid = generateUuid();
    const employeeUuid = getMapping('employees', row.task_creator)!;
    const projectUuid = getMapping('campaigns', row.reference_id)!;
    const createdByUuid = employeeUuid; // Same as task creator

    // Calculate dates
    const startDate = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : null;
    const endDate = row.updated_at ? new Date(row.updated_at).toISOString().split('T')[0] : startDate;

    const data = {
      id: uuid,
      employeeId: employeeUuid,
      projectId: projectUuid,
      taskId: null,
      startDate: startDate!,
      endDate: endDate!,
      hoursPerDay: '8',
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeId: null,
      category: row.type || null,
      isBillable: row.type !== 'operational',
      status: mapAssignmentStatus(row.status),
      note: row.description || null,
      createdById: createdByUuid,
    };

    try {
      const [result] = await db.insert(assignments).values(data).returning();
      inserted.push(result);
      console.log(`✓ Inserted assignment: ${row.task_name}`);
    } catch (error) {
      console.error(`✗ Failed to insert assignment ${row.task_name}:`, error);
    }
  }

  console.log(`Migrated ${inserted.length} assignments`);
  return inserted;
}

// ============ MAIN MIGRATION ============

async function migrate() {
  console.log('========================================');
  console.log('Real Data Migration: MySQL → Supabase');
  console.log('========================================');

  try {
    // Phase 1: Reference Data
    await migrateBusinessUnits();
    await migrateDepartments();
    await migrateBrands();

    // Phase 2: Employee Data
    await migrateEmployees();

    // Phase 3: Project Data
    await migrateCampaigns();
    await migratePitches();

    // Phase 4: Assignment Data
    await migrateAssignments();

    // Save ID mappings for reference
    const mappingsForSave = {
      business_units: Array.from(idMappings.business_units.entries()),
      departments: Array.from(idMappings.departments.entries()),
      brands: Array.from(idMappings.brands.entries()),
      employees: Array.from(idMappings.employees.entries()),
      campaigns: Array.from(idMappings.campaigns.entries()),
      pitches: Array.from(idMappings.pitches.entries()),
      tasks: Array.from(idMappings.tasks.entries()),
    };

    writeFileSync(
      './scripts/id-mappings.json',
      JSON.stringify(mappingsForSave, null, 2)
    );
    console.log('\n✓ Saved ID mappings to scripts/id-mappings.json');

    console.log('\n========================================');
    console.log('Migration Complete!');
    console.log('========================================');
    console.log(`Business Units: ${idMappings.business_units.size}`);
    console.log(`Departments: ${idMappings.departments.size}`);
    console.log(`Brands: ${idMappings.brands.size}`);
    console.log(`Employees: ${idMappings.employees.size}`);
    console.log(`Projects (Campaigns): ${idMappings.campaigns.size}`);
    console.log(`Projects (Pitches): ${idMappings.pitches.size}`);
    console.log(`Assignments: N/A (not tracked in ID mappings)`);

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
