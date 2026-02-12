// @ts-nocheck - This is a standalone utility script for data import
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { parseTimetrackSql, ParsedData, ParsedEmployee } from './parse-timetrack-sql';
import * as schema from './schema';
import {
  businessUnits,
  departments,
  brands,
  employees,
  projects,
  assignments,
  employeeBrandAssignments,
  projectCategories,
  NewBusinessUnit,
  NewDepartment,
  NewBrand,
  NewEmployee,
  NewProject
} from './schema';

dotenv.config({ path: '.env.local' });

const SQL_DUMP_PATH = './timetrack_prd_db_neptune14-00012026.sql';

interface IdMaps {
  employees: Map<number, string>;
  brands: Map<number, string>;
  campaigns: Map<number, string>;
  departments: Map<number, string>;
  businessUnits: Map<number, string>;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

const DEPARTMENT_TO_BU: Record<string, string> = {
  'Business Consulting': 'DIGITAL',
  'Brand Management': 'DIGITAL',
  'Martech & Innovation': 'DIGITAL',
  'Performance Marketing': 'DIGITAL',
  'Content & Outreach': 'DIGITAL',
  'Creative': 'DIGITAL',
  'Finance': 'OPERATIONS',
  'People & Culture': 'OPERATIONS',
  'Management': 'OPERATIONS',
  'Management Trainee': 'OPERATIONS'
};

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateDepartmentCode(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 6);
}

function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    clear: true,
    dryRun: false,
    verbose: false,
    limitEmployees: undefined,
    limitBrands: undefined,
    limitProjects: undefined
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--no-clear') {
      options.clear = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--limit-employees') {
      options.limitEmployees = parseInt(args[++i], 10);
    } else if (arg === '--limit-brands') {
      options.limitBrands = parseInt(args[++i], 10);
    } else if (arg === '--limit-projects') {
      options.limitProjects = parseInt(args[++i], 10);
    }
  }

  return options;
}

async function clearExistingData(db: any, verbose: boolean) {
  if (verbose) console.log('\n🗑️  Clearing existing data...');

  await db.delete(assignments);
  if (verbose) console.log('   ✓ Cleared assignments');

  await db.delete(employeeBrandAssignments);
  if (verbose) console.log('   ✓ Cleared employee brand assignments');

  await db.delete(projects);
  if (verbose) console.log('   ✓ Cleared projects');

  await db.delete(employees);
  if (verbose) console.log('   ✓ Cleared employees');

  await db.delete(brands);
  if (verbose) console.log('   ✓ Cleared brands');

  await db.delete(departments);
  if (verbose) console.log('   ✓ Cleared departments');

  await db.delete(businessUnits);
  if (verbose) console.log('   ✓ Cleared business units');
}

async function createBusinessUnits(
  db: any,
  parsedData: ParsedData,
  idMaps: IdMaps,
  verbose: boolean
) {
  if (verbose) console.log('\n📦 Creating Business Units...');

  // Create default business units
  const buData: { id: number, name: string, code: string }[] = [
    { id: 1, name: 'Digital Services', code: 'DIGITAL' },
    { id: 2, name: 'Operations', code: 'OPERATIONS' }
  ];

  // Add any BUs from campaigns that aren't in default list
  for (const buId of parsedData.businessUnitIds) {
    if (!buData.find(bu => bu.id === buId)) {
      buData.push({
        id: buId,
        name: `Business Unit ${buId}`,
        code: `BU${buId}`
      });
    }
  }

  for (const bu of buData) {
    const newBu: NewBusinessUnit = {
      name: bu.name,
      code: bu.code,
      color: randomColor(),
      isActive: true
    };

    const [inserted] = await db.insert(businessUnits).values(newBu).returning();
    idMaps.businessUnits.set(bu.id, inserted.id);

    if (verbose) console.log(`   ✓ Created ${bu.name} (${bu.code})`);
  }
}

async function createDepartments(
  db: any,
  parsedData: ParsedData,
  idMaps: IdMaps,
  verbose: boolean
) {
  if (verbose) console.log('\n🏢 Creating Departments...');

  const usedCodes = new Set<string>();

  for (const dept of parsedData.departments) {
    const buCode = DEPARTMENT_TO_BU[dept.department_name] || 'DIGITAL';

    // Get the correct BU ID
    let businessUnitId: string | undefined;
    for (const [ttId, rpId] of idMaps.businessUnits.entries()) {
      const buRecord = await db.query.businessUnits.findFirst({
        where: (bu: any, { eq }: any) => eq(bu.id, rpId)
      });
      if (buRecord?.code === buCode) {
        businessUnitId = rpId;
        break;
      }
    }

    // Generate unique code (handle duplicates)
    let baseCode = generateDepartmentCode(dept.department_name);
    let code = baseCode;
    let suffix = 1;
    while (usedCodes.has(code)) {
      code = `${baseCode}${suffix}`;
      suffix++;
    }
    usedCodes.add(code);

    const newDept: NewDepartment = {
      businessUnitId,
      name: dept.department_name,
      code,
      color: randomColor(),
      isActive: dept.flag === 'active'
    };

    const [inserted] = await db.insert(departments).values(newDept).returning();
    idMaps.departments.set(dept.id, inserted.id);

    if (verbose) console.log(`   ✓ Created ${dept.department_name} (${code})`);
  }
}

async function createBrands(
  db: any,
  parsedData: ParsedData,
  idMaps: IdMaps,
  verbose: boolean
) {
  if (verbose) console.log('\n🏷️  Creating Brands...');

  const defaultBuId = Array.from(idMaps.businessUnits.values())[0];
  const usedClientCodes = new Set<string>();

  for (const brand of parsedData.brands) {
    // Handle duplicate client codes
    let clientCode: string | undefined;
    if (brand.client_code) {
      const baseCode = brand.client_code.toString();
      if (!usedClientCodes.has(baseCode)) {
        clientCode = baseCode;
        usedClientCodes.add(baseCode);
      } else {
        // Duplicate client code - make it unique by appending brand ID
        clientCode = `${baseCode}-${brand.id}`;
        usedClientCodes.add(clientCode);
      }
    }

    const newBrand: NewBrand = {
      businessUnitId: defaultBuId,
      name: brand.brand_name,
      companyName: brand.company_name,
      brandAddress: brand.brand_address,
      clientCode,
      color: randomColor(),
      logo: brand.logo,
      website: brand.brand_website,
      contactName: brand.pic_brand_name,
      contactTitle: brand.pic_title,
      contactEmail: brand.pic_email,
      contactPhone: brand.pic_brand_phone,
      picFinanceName: brand.pic_finance_name,
      picFinancePhone: brand.pic_finance_phone,
      industryCategory: brand.industry_category,
      description: brand.description,
      status: brand.flag === 'active' ? 'active' : 'inactive'
    };

    const [inserted] = await db.insert(brands).values(newBrand).returning();
    idMaps.brands.set(brand.id, inserted.id);

    if (verbose && parsedData.brands.indexOf(brand) % 10 === 0) {
      console.log(`   ✓ Created ${parsedData.brands.indexOf(brand) + 1}/${parsedData.brands.length} brands...`);
    }
  }

  if (verbose) console.log(`   ✅ Created ${parsedData.brands.length} brands`);
}

async function createEmployees(
  db: any,
  parsedData: ParsedData,
  idMaps: IdMaps,
  verbose: boolean
) {
  if (verbose) console.log('\n👥 Creating Employees (Pass 1 - without supervisors)...');

  const usedEmployeeNumbers = new Set<string>();

  // Pass 1: Create all employees without supervisor references
  for (const emp of parsedData.employees) {
    const departmentId = emp.dept_id ? idMaps.departments.get(emp.dept_id) : undefined;
    const businessUnitId = departmentId
      ? (await db.query.departments.findFirst({
          where: (d: any, { eq }: any) => eq(d.id, departmentId)
        }))?.businessUnitId
      : undefined;

    // Handle duplicate employee numbers
    let employeeNumber: string | undefined;
    if (emp.nik) {
      if (!usedEmployeeNumbers.has(emp.nik)) {
        employeeNumber = emp.nik;
        usedEmployeeNumbers.add(emp.nik);
      } else {
        // Duplicate - append ID to make unique
        employeeNumber = `${emp.nik}-${emp.id}`;
        usedEmployeeNumbers.add(employeeNumber);
      }
    }

    const newEmp: NewEmployee = {
      employeeNumber,
      fullName: emp.full_name,
      nickname: emp.nickname,
      photo: emp.photo,
      position: emp.position,
      departmentId,
      businessUnitId,
      directSupervisorId: undefined, // Set in pass 2
      weeklyCapacity: 40,
      workStartDate: emp.work_start_date,
      dateOfBirth: emp.dob,
      employmentStatus: emp.flag === 'active' ? 'active' : 'inactive',
      visibility: emp.status === 'visible' ? 'active' : 'archived'
    };

    const [inserted] = await db.insert(employees).values(newEmp).returning();
    idMaps.employees.set(emp.id, inserted.id);

    if (verbose && parsedData.employees.indexOf(emp) % 20 === 0) {
      console.log(`   ✓ Created ${parsedData.employees.indexOf(emp) + 1}/${parsedData.employees.length} employees...`);
    }
  }

  if (verbose) console.log(`   ✅ Created ${parsedData.employees.length} employees (without supervisors)`);

  // Pass 2: Update supervisor references
  if (verbose) console.log('\n👥 Updating Employee Supervisors (Pass 2)...');

  let supervisorCount = 0;
  for (const emp of parsedData.employees) {
    if (emp.direct_supervisor) {
      const employeeId = idMaps.employees.get(emp.id);
      const supervisorId = idMaps.employees.get(emp.direct_supervisor);

      if (employeeId && supervisorId) {
        await db.update(employees)
          .set({ directSupervisorId: supervisorId })
          .where((e: any, { eq }: any) => eq(e.id, employeeId));
        supervisorCount++;
      }
    }
  }

  if (verbose) console.log(`   ✅ Updated ${supervisorCount} supervisor relationships`);
}

async function createProjects(
  db: any,
  parsedData: ParsedData,
  idMaps: IdMaps,
  verbose: boolean
) {
  if (verbose) console.log('\n📋 Creating Projects (Campaigns)...');

  // Get default project category
  const defaultCategory = await db.query.projectCategories.findFirst({
    where: (pc: any, { eq }: any) => eq(pc.name, 'Digital Marketing')
  });

  for (const campaign of parsedData.campaigns) {
    const brandId = idMaps.brands.get(campaign.brand_id);
    if (!brandId) {
      if (verbose) console.warn(`   ⚠️  Skipping campaign ${campaign.campaign_name} - brand not found`);
      continue;
    }

    const businessUnitId = campaign.business_unit_id
      ? idMaps.businessUnits.get(campaign.business_unit_id)
      : undefined;

    const createdById = campaign.created_by
      ? idMaps.employees.get(campaign.created_by)
      : undefined;

    const newProject: NewProject = {
      brandId,
      businessUnitId,
      projectCategoryId: defaultCategory?.id,
      projectType: 'campaign',
      name: campaign.campaign_name,
      projectNumber: campaign.io_number || undefined,
      color: randomColor(),
      budget: campaign.budget?.toString(),
      asf: campaign.asf?.toString(),
      grandTotal: campaign.grand_total?.toString(),
      currency: campaign.currency,
      ioFile: campaign.io_file,
      quotationReference: campaign.quotation_reference,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      status: campaign.state === 'publish' ? 'active' : 'planning',
      createdById,
      notes: campaign.notes,
      timetrackCampaignId: campaign.id,
      syncStatus: 'synced',
      sourceSystem: 'timetrack'
    };

    const [inserted] = await db.insert(projects).values(newProject).returning();
    idMaps.campaigns.set(campaign.id, inserted.id);

    if (verbose && parsedData.campaigns.indexOf(campaign) % 10 === 0) {
      console.log(`   ✓ Created ${parsedData.campaigns.indexOf(campaign) + 1}/${parsedData.campaigns.length} projects...`);
    }
  }

  if (verbose) console.log(`   ✅ Created ${parsedData.campaigns.length} projects`);
}

async function updateRecentTimestamps(
  db: any,
  verbose: boolean
) {
  if (verbose) console.log('\n📅 Updating recent timestamps...');

  // Update some projects to have recent updatedAt dates
  const recentProjects = await db.query.projects.findMany({
    limit: 50,
    orderBy: (p: any, { desc }: any) => [desc(p.createdAt)]
  });

  const now = new Date();
  for (let i = 0; i < recentProjects.length; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const updatedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    await db.update(projects)
      .set({ updatedAt })
      .where((p: any, { eq }: any) => eq(p.id, recentProjects[i].id));
  }

  if (verbose) console.log(`   ✅ Updated timestamps for ${recentProjects.length} recent projects`);
}

async function main() {
  const options = parseCommandLineArgs();

  console.log('🚀 Timetrack Data Import');
  console.log('========================\n');

  if (options.dryRun) {
    console.log('🧪 DRY RUN MODE - No data will be written\n');
  }

  // Step 1: Parse SQL dump
  console.log('📖 Step 1: Parsing SQL dump...');
  const parsedData = await parseTimetrackSql(SQL_DUMP_PATH, {
    onlyActive: true,
    limitEmployees: options.limitEmployees,
    limitBrands: options.limitBrands,
    limitCampaigns: options.limitProjects,
    verbose: options.verbose
  });

  console.log('\n📊 Parsed Data Summary:');
  console.log(`   Employees: ${parsedData.employees.length}`);
  console.log(`   Brands: ${parsedData.brands.length}`);
  console.log(`   Campaigns: ${parsedData.campaigns.length}`);
  console.log(`   Departments: ${parsedData.departments.length}`);
  console.log(`   Business Units: ${parsedData.businessUnitIds.size}`);

  if (options.dryRun) {
    console.log('\n✅ Dry run complete - no data was imported');
    process.exit(0);
  }

  // Step 2: Connect to database
  console.log('\n🔌 Step 2: Connecting to database...');
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  // Initialize ID maps
  const idMaps: IdMaps = {
    employees: new Map(),
    brands: new Map(),
    campaigns: new Map(),
    departments: new Map(),
    businessUnits: new Map()
  };

  try {
    // Step 3: Clear existing data
    if (options.clear) {
      console.log('\n🗑️  Step 3: Clearing existing data...');
      await clearExistingData(db, options.verbose);
    } else {
      console.log('\n⏭️  Step 3: Skipping data clear (--no-clear)');
    }

    // Step 4: Import data
    console.log('\n📥 Step 4: Importing data...');

    await createBusinessUnits(db, parsedData, idMaps, options.verbose);
    await createDepartments(db, parsedData, idMaps, options.verbose);
    await createBrands(db, parsedData, idMaps, options.verbose);
    await createEmployees(db, parsedData, idMaps, options.verbose);
    await createProjects(db, parsedData, idMaps, options.verbose);

    // Step 5: Update timestamps
    await updateRecentTimestamps(db, options.verbose);

    console.log('\n✅ Import Complete!');
    console.log('\n📊 Final Summary:');
    console.log(`   ✓ Business Units: ${idMaps.businessUnits.size}`);
    console.log(`   ✓ Departments: ${idMaps.departments.size}`);
    console.log(`   ✓ Brands: ${idMaps.brands.size}`);
    console.log(`   ✓ Employees: ${idMaps.employees.size}`);
    console.log(`   ✓ Projects: ${idMaps.campaigns.size}`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Run: npx tsx lib/db/verify-import.ts');
    console.log('   2. Run: npx tsx lib/db/generate-mock-assignments.ts');
    console.log('   3. Run: npm run dev');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
