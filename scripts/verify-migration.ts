import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function verifyMigration() {
  console.log('========================================');
  console.log('Migration Verification');
  console.log('========================================\n');

  // 1. Check row counts
  console.log('1. Row Counts:');
  const counts = {
    business_units: (await db.execute(sql`SELECT COUNT(*) FROM business_units`))[0].count,
    departments: (await db.execute(sql`SELECT COUNT(*) FROM departments`))[0].count,
    brands: (await db.execute(sql`SELECT COUNT(*) FROM brands`))[0].count,
    employees: (await db.execute(sql`SELECT COUNT(*) FROM employees`))[0].count,
    projects: (await db.execute(sql`SELECT COUNT(*) FROM projects`))[0].count,
    assignments: (await db.execute(sql`SELECT COUNT(*) FROM assignments`))[0].count,
  };

  Object.entries(counts).forEach(([table, count]) => {
    console.log(`   ${table}: ${count}`);
  });

  // 2. Check for orphaned records (foreign key issues)
  console.log('\n2. Foreign Key Integrity:');

  const orphanedEmployees = await db.execute(sql`
    SELECT COUNT(*) FROM employees
    WHERE department_id IS NOT NULL
    AND department_id NOT IN (SELECT id FROM departments)
  `);
  console.log(`   Employees with invalid department_id: ${orphanedEmployees[0].count}`);

  const orphanedProjects = await db.execute(sql`
    SELECT COUNT(*) FROM projects
    WHERE brand_id NOT IN (SELECT id FROM brands)
  `);
  console.log(`   Projects with invalid brand_id: ${orphanedProjects[0].count}`);

  const orphanedAssignments = await db.execute(sql`
    SELECT COUNT(*) FROM assignments
    WHERE project_id IS NOT NULL
    AND project_id NOT IN (SELECT id FROM projects)
  `);
  console.log(`   Assignments with invalid project_id: ${orphanedAssignments[0].count}`);

  const orphanedAssignmentEmployees = await db.execute(sql`
    SELECT COUNT(*) FROM assignments
    WHERE employee_id NOT IN (SELECT id FROM employees)
  `);
  console.log(`   Assignments with invalid employee_id: ${orphanedAssignmentEmployees[0].count}`);

  // 3. Sample real data
  console.log('\n3. Sample Data:');

  const sampleBusinessUnits = await db.execute(sql`
    SELECT name, code FROM business_units LIMIT 3
  `);
  console.log('\n   Business Units:');
  sampleBusinessUnits.forEach((bu: any) => {
    console.log(`   - ${bu.name} (${bu.code})`);
  });

  const sampleBrands = await db.execute(sql`
    SELECT name, client_code FROM brands LIMIT 5
  `);
  console.log('\n   Brands:');
  sampleBrands.forEach((brand: any) => {
    console.log(`   - ${brand.name} ${brand.client_code ? `(${brand.client_code})` : ''}`);
  });

  const sampleEmployees = await db.execute(sql`
    SELECT full_name, employee_number, position FROM employees LIMIT 5
  `);
  console.log('\n   Employees:');
  sampleEmployees.forEach((emp: any) => {
    console.log(`   - ${emp.full_name} (${emp.employee_number}) - ${emp.position}`);
  });

  const sampleProjects = await db.execute(sql`
    SELECT p.name, p.project_number, b.name as brand_name, p.budget
    FROM projects p
    JOIN brands b ON p.brand_id = b.id
    LIMIT 5
  `);
  console.log('\n   Projects:');
  sampleProjects.forEach((proj: any) => {
    console.log(`   - ${proj.name}`);
    console.log(`     Brand: ${proj.brand_name}`);
    console.log(`     Budget: ${proj.budget ? `IDR ${proj.budget}` : 'N/A'}`);
  });

  // 4. Check relationships
  console.log('\n4. Relationship Statistics:');

  const projectsPerBrand = await db.execute(sql`
    SELECT b.name, COUNT(p.id) as project_count
    FROM brands b
    LEFT JOIN projects p ON b.id = p.brand_id
    GROUP BY b.id, b.name
    HAVING COUNT(p.id) > 0
    ORDER BY project_count DESC
    LIMIT 5
  `);
  console.log('\n   Top brands by project count:');
  projectsPerBrand.forEach((row: any) => {
    console.log(`   - ${row.name}: ${row.project_count} projects`);
  });

  const assignmentsPerEmployee = await db.execute(sql`
    SELECT e.full_name, COUNT(a.id) as assignment_count
    FROM employees e
    LEFT JOIN assignments a ON e.id = a.employee_id
    GROUP BY e.id, e.full_name
    HAVING COUNT(a.id) > 0
    ORDER BY assignment_count DESC
    LIMIT 5
  `);
  console.log('\n   Top employees by assignment count:');
  assignmentsPerEmployee.forEach((row: any) => {
    console.log(`   - ${row.full_name}: ${row.assignment_count} assignments`);
  });

  // 5. Data quality checks
  console.log('\n5. Data Quality:');

  const nullBudgets = await db.execute(sql`
    SELECT COUNT(*) FROM projects WHERE budget IS NULL
  `);
  console.log(`   Projects with NULL budget: ${nullBudgets[0].count}`);

  const nullDepartments = await db.execute(sql`
    SELECT COUNT(*) FROM employees WHERE department_id IS NULL
  `);
  console.log(`   Employees with NULL department: ${nullDepartments[0].count}`);

  const validDateRanges = await db.execute(sql`
    SELECT COUNT(*) FROM projects
    WHERE start_date IS NOT NULL
    AND end_date IS NOT NULL
    AND start_date <= end_date
  `);
  console.log(`   Projects with valid date ranges: ${validDateRanges[0].count}`);

  console.log('\n========================================');
  console.log('Verification Complete!');
  console.log('========================================');

  process.exit(0);
}

verifyMigration();
