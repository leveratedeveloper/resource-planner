import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import {
  businessUnits,
  departments,
  brands,
  employees,
  projects,
  assignments
} from './schema';

dotenv.config({ path: '.env.local' });

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: any;
}

async function verifyRecordCounts(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n📊 Verifying Record Counts...');

  const counts = {
    businessUnits: await db.select({ count: sql<number>`count(*)` }).from(businessUnits),
    departments: await db.select({ count: sql<number>`count(*)` }).from(departments),
    brands: await db.select({ count: sql<number>`count(*)` }).from(brands),
    employees: await db.select({ count: sql<number>`count(*)` }).from(employees),
    projects: await db.select({ count: sql<number>`count(*)` }).from(projects),
    assignments: await db.select({ count: sql<number>`count(*)` }).from(assignments)
  };

  const results = {
    businessUnits: Number(counts.businessUnits[0].count),
    departments: Number(counts.departments[0].count),
    brands: Number(counts.brands[0].count),
    employees: Number(counts.employees[0].count),
    projects: Number(counts.projects[0].count),
    assignments: Number(counts.assignments[0].count)
  };

  console.log('   Business Units:', results.businessUnits);
  console.log('   Departments:', results.departments);
  console.log('   Brands:', results.brands);
  console.log('   Employees:', results.employees);
  console.log('   Projects:', results.projects);
  console.log('   Assignments:', results.assignments);

  const passed =
    results.businessUnits > 0 &&
    results.departments > 0 &&
    results.brands > 0 &&
    results.employees > 0 &&
    results.projects > 0;

  return {
    passed,
    message: passed ? '✅ All tables have data' : '❌ Some tables are empty',
    details: results
  };
}

async function verifyForeignKeyIntegrity(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n🔗 Verifying Foreign Key Integrity...');

  const issues: string[] = [];

  // Check departments -> business units
  const deptWithoutBU = await db.select({ count: sql<number>`count(*)` })
    .from(departments)
    .where(and(
      isNotNull(departments.businessUnitId),
      sql`NOT EXISTS (SELECT 1 FROM ${businessUnits} WHERE ${businessUnits.id} = ${departments.businessUnitId})`
    ));

  const deptWithoutBUCount = Number(deptWithoutBU[0].count);
  if (deptWithoutBUCount > 0) {
    issues.push(`${deptWithoutBUCount} departments reference non-existent business units`);
  }
  console.log(`   Departments -> Business Units: ${deptWithoutBUCount === 0 ? '✅' : '❌'} ${deptWithoutBUCount} orphaned`);

  // Check employees -> departments
  const empWithoutDept = await db.select({ count: sql<number>`count(*)` })
    .from(employees)
    .where(and(
      isNotNull(employees.departmentId),
      sql`NOT EXISTS (SELECT 1 FROM ${departments} WHERE ${departments.id} = ${employees.departmentId})`
    ));

  const empWithoutDeptCount = Number(empWithoutDept[0].count);
  if (empWithoutDeptCount > 0) {
    issues.push(`${empWithoutDeptCount} employees reference non-existent departments`);
  }
  console.log(`   Employees -> Departments: ${empWithoutDeptCount === 0 ? '✅' : '❌'} ${empWithoutDeptCount} orphaned`);

  // Check employees -> supervisors
  const empWithInvalidSupervisor = await db.select({ count: sql<number>`count(*)` })
    .from(employees)
    .where(and(
      isNotNull(employees.directSupervisorId),
      sql`NOT EXISTS (SELECT 1 FROM ${employees} e2 WHERE e2.id = ${employees.directSupervisorId})`
    ));

  const empWithInvalidSupervisorCount = Number(empWithInvalidSupervisor[0].count);
  if (empWithInvalidSupervisorCount > 0) {
    issues.push(`${empWithInvalidSupervisorCount} employees reference non-existent supervisors`);
  }
  console.log(`   Employees -> Supervisors: ${empWithInvalidSupervisorCount === 0 ? '✅' : '❌'} ${empWithInvalidSupervisorCount} orphaned`);

  // Check brands -> business units
  const brandsWithoutBU = await db.select({ count: sql<number>`count(*)` })
    .from(brands)
    .where(and(
      isNotNull(brands.businessUnitId),
      sql`NOT EXISTS (SELECT 1 FROM ${businessUnits} WHERE ${businessUnits.id} = ${brands.businessUnitId})`
    ));

  const brandsWithoutBUCount = Number(brandsWithoutBU[0].count);
  if (brandsWithoutBUCount > 0) {
    issues.push(`${brandsWithoutBUCount} brands reference non-existent business units`);
  }
  console.log(`   Brands -> Business Units: ${brandsWithoutBUCount === 0 ? '✅' : '❌'} ${brandsWithoutBUCount} orphaned`);

  // Check projects -> brands
  const projectsWithoutBrand = await db.select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(sql`NOT EXISTS (SELECT 1 FROM ${brands} WHERE ${brands.id} = ${projects.brandId})`);

  const projectsWithoutBrandCount = Number(projectsWithoutBrand[0].count);
  if (projectsWithoutBrandCount > 0) {
    issues.push(`${projectsWithoutBrandCount} projects reference non-existent brands`);
  }
  console.log(`   Projects -> Brands: ${projectsWithoutBrandCount === 0 ? '✅' : '❌'} ${projectsWithoutBrandCount} orphaned`);

  return {
    passed: issues.length === 0,
    message: issues.length === 0 ? '✅ All foreign keys are valid' : '❌ Foreign key violations found',
    details: issues
  };
}

async function verifyEmployeeHierarchy(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n👥 Verifying Employee Hierarchy...');

  const allEmployees = await db.select({
    id: employees.id,
    fullName: employees.fullName,
    supervisorId: employees.directSupervisorId
  }).from(employees);

  let withSupervisors = 0;
  let withoutSupervisors = 0;
  let circularRefs = 0;

  for (const emp of allEmployees) {
    if (emp.supervisorId) {
      withSupervisors++;

      // Check for circular reference (employee supervises themselves)
      if (emp.supervisorId === emp.id) {
        circularRefs++;
      }
    } else {
      withoutSupervisors++;
    }
  }

  console.log(`   Total Employees: ${allEmployees.length}`);
  console.log(`   With Supervisors: ${withSupervisors} (${((withSupervisors/allEmployees.length)*100).toFixed(1)}%)`);
  console.log(`   Without Supervisors: ${withoutSupervisors} (${((withoutSupervisors/allEmployees.length)*100).toFixed(1)}%)`);
  console.log(`   Circular References: ${circularRefs === 0 ? '✅ None' : `❌ ${circularRefs}`}`);

  return {
    passed: circularRefs === 0,
    message: circularRefs === 0 ? '✅ Employee hierarchy is valid' : '❌ Circular references found in hierarchy',
    details: { withSupervisors, withoutSupervisors, circularRefs }
  };
}

async function verifyBrandProjectRelationships(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n🏷️  Verifying Brand-Project Relationships...');

  const brandProjectCounts = await db.select({
    brandId: brands.id,
    brandName: brands.name,
    projectCount: sql<number>`count(${projects.id})`
  })
    .from(brands)
    .leftJoin(projects, eq(projects.brandId, brands.id))
    .groupBy(brands.id, brands.name)
    .orderBy(sql`count(${projects.id}) desc`)
    .limit(10);

  console.log('   Top 10 Brands by Project Count:');
  for (const brand of brandProjectCounts) {
    console.log(`     ${brand.brandName}: ${brand.projectCount} projects`);
  }

  const brandsWithoutProjects = await db.select({ count: sql<number>`count(*)` })
    .from(brands)
    .where(sql`NOT EXISTS (SELECT 1 FROM ${projects} WHERE ${projects.brandId} = ${brands.id})`);

  const brandsWithoutProjectsCount = Number(brandsWithoutProjects[0].count);
  console.log(`   Brands without Projects: ${brandsWithoutProjectsCount}`);

  return {
    passed: true,
    message: '✅ Brand-project relationships verified',
    details: { brandsWithoutProjects: brandsWithoutProjectsCount }
  };
}

async function verifyActiveStatus(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n✨ Verifying Active Status Distribution...');

  const employeeStatus = await db.select({
    employmentStatus: employees.employmentStatus,
    count: sql<number>`count(*)`
  })
    .from(employees)
    .groupBy(employees.employmentStatus);

  console.log('   Employee Status:');
  for (const status of employeeStatus) {
    console.log(`     ${status.employmentStatus}: ${status.count}`);
  }

  const brandStatus = await db.select({
    status: brands.status,
    count: sql<number>`count(*)`
  })
    .from(brands)
    .groupBy(brands.status);

  console.log('   Brand Status:');
  for (const status of brandStatus) {
    console.log(`     ${status.status}: ${status.count}`);
  }

  const projectStatus = await db.select({
    status: projects.status,
    count: sql<number>`count(*)`
  })
    .from(projects)
    .groupBy(projects.status);

  console.log('   Project Status:');
  for (const status of projectStatus) {
    console.log(`     ${status.status}: ${status.count}`);
  }

  return {
    passed: true,
    message: '✅ Status distribution verified'
  };
}

async function verifyDateRanges(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n📅 Verifying Date Ranges...');

  const projectDates = await db.select({
    minStart: sql<string>`min(${projects.startDate})`,
    maxEnd: sql<string>`max(${projects.endDate})`,
    count: sql<number>`count(*)`
  }).from(projects);

  const { minStart, maxEnd, count } = projectDates[0];

  console.log(`   Projects Date Range: ${minStart || 'N/A'} to ${maxEnd || 'N/A'}`);
  console.log(`   Total Projects: ${count}`);

  const projectsWithNullDates = await db.select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(sql`${projects.startDate} IS NULL OR ${projects.endDate} IS NULL`);

  const nullDatesCount = Number(projectsWithNullDates[0].count);
  console.log(`   Projects with NULL dates: ${nullDatesCount}`);

  return {
    passed: true,
    message: '✅ Date ranges verified',
    details: { minStart, maxEnd, projectsWithNullDates: nullDatesCount }
  };
}

async function verifyRequiredFields(db: ReturnType<typeof drizzle>): Promise<VerificationResult> {
  console.log('\n✓ Verifying Required Fields...');

  const issues: string[] = [];

  // Check employees required fields
  const employeesWithoutName = await db.select({ count: sql<number>`count(*)` })
    .from(employees)
    .where(sql`${employees.fullName} IS NULL OR ${employees.fullName} = ''`);

  const empNameCount = Number(employeesWithoutName[0].count);
  if (empNameCount > 0) {
    issues.push(`${empNameCount} employees missing full name`);
  }
  console.log(`   Employees with full name: ${empNameCount === 0 ? '✅' : '❌'} ${empNameCount} missing`);

  const employeesWithoutPosition = await db.select({ count: sql<number>`count(*)` })
    .from(employees)
    .where(sql`${employees.position} IS NULL OR ${employees.position} = ''`);

  const empPosCount = Number(employeesWithoutPosition[0].count);
  if (empPosCount > 0) {
    issues.push(`${empPosCount} employees missing position`);
  }
  console.log(`   Employees with position: ${empPosCount === 0 ? '✅' : '❌'} ${empPosCount} missing`);

  // Check brands required fields
  const brandsWithoutName = await db.select({ count: sql<number>`count(*)` })
    .from(brands)
    .where(sql`${brands.name} IS NULL OR ${brands.name} = ''`);

  const brandNameCount = Number(brandsWithoutName[0].count);
  if (brandNameCount > 0) {
    issues.push(`${brandNameCount} brands missing name`);
  }
  console.log(`   Brands with name: ${brandNameCount === 0 ? '✅' : '❌'} ${brandNameCount} missing`);

  // Check projects required fields
  const projectsWithoutName = await db.select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(sql`${projects.name} IS NULL OR ${projects.name} = ''`);

  const projNameCount = Number(projectsWithoutName[0].count);
  if (projNameCount > 0) {
    issues.push(`${projNameCount} projects missing name`);
  }
  console.log(`   Projects with name: ${projNameCount === 0 ? '✅' : '❌'} ${projNameCount} missing`);

  return {
    passed: issues.length === 0,
    message: issues.length === 0 ? '✅ All required fields populated' : '❌ Missing required fields',
    details: issues
  };
}

async function main() {
  console.log('🔍 Timetrack Import Verification');
  console.log('=================================\n');

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, {
    schema: { businessUnits, departments, brands, employees, projects, assignments }
  });

  const results: VerificationResult[] = [];

  try {
    results.push(await verifyRecordCounts(db));
    results.push(await verifyForeignKeyIntegrity(db));
    results.push(await verifyEmployeeHierarchy(db));
    results.push(await verifyBrandProjectRelationships(db));
    results.push(await verifyActiveStatus(db));
    results.push(await verifyDateRanges(db));
    results.push(await verifyRequiredFields(db));

    console.log('\n\n========================================');
    console.log('📋 VERIFICATION SUMMARY');
    console.log('========================================\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    for (const result of results) {
      console.log(result.message);
      if (!result.passed && result.details) {
        console.log('   Details:', result.details);
      }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('\n✅ All verifications passed! Data import is valid.');
      console.log('\n📝 Next Steps:');
      console.log('   Run: npx tsx lib/db/generate-mock-assignments.ts');
    } else {
      console.log('\n⚠️  Some verifications failed. Please review the issues above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
