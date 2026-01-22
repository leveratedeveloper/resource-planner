// Verify seed data in database
// Run with: npx tsx scripts/verify-data.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString);

async function verifyData() {
  try {
    console.log('🔍 Verifying seed data...\n');

    // Get counts
    const [buCount] = await sql`SELECT COUNT(*) as count FROM business_units`;
    const [deptCount] = await sql`SELECT COUNT(*) as count FROM departments`;
    const [brandsCount] = await sql`SELECT COUNT(*) as count FROM brands`;
    const [empCount] = await sql`SELECT COUNT(*) as count FROM employees`;
    const [ebCount] = await sql`SELECT COUNT(*) as count FROM employee_brand_assignments`;
    const [projCount] = await sql`SELECT COUNT(*) as count FROM projects`;
    const [assignCount] = await sql`SELECT COUNT(*) as count FROM assignments`;

    console.log('📊 Record Counts:');
    console.log(`  ✓ Business Units: ${buCount.count}`);
    console.log(`  ✓ Departments: ${deptCount.count}`);
    console.log(`  ✓ Brands: ${brandsCount.count}`);
    console.log(`  ✓ Employees: ${empCount.count}`);
    console.log(`  ✓ Employee-Brand Assignments: ${ebCount.count}`);
    console.log(`  ✓ Projects: ${projCount.count}`);
    console.log(`  ✓ Assignments: ${assignCount.count}\n`);

    // Sample data
    console.log('📋 Sample Data:\n');

    console.log('Business Units:');
    const businessUnits = await sql`SELECT name, code FROM business_units ORDER BY name`;
    businessUnits.forEach((bu: any) => {
      console.log(`  - ${bu.name} (${bu.code})`);
    });

    console.log('\nDepartments:');
    const departments = await sql`SELECT name, code FROM departments ORDER BY name`;
    departments.forEach((dept: any) => {
      console.log(`  - ${dept.name} (${dept.code})`);
    });

    console.log('\nBrands:');
    const brands = await sql`SELECT name, status FROM brands ORDER BY name`;
    brands.forEach((brand: any) => {
      console.log(`  - ${brand.name} (${brand.status})`);
    });

    console.log('\nEmployees:');
    const employees = await sql`
      SELECT e.full_name, e.position, d.name as department
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY e.full_name
    `;
    employees.forEach((emp: any) => {
      console.log(`  - ${emp.full_name} - ${emp.position} (${emp.department || 'No Dept'})`);
    });

    console.log('\nProjects:');
    const projects = await sql`
      SELECT p.name, b.name as brand, p.status
      FROM projects p
      LEFT JOIN brands b ON p.brand_id = b.id
      ORDER BY p.name
    `;
    projects.forEach((proj: any) => {
      console.log(`  - ${proj.name} [${proj.brand}] (${proj.status})`);
    });

    console.log('\n✅ Database verification complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

verifyData();
