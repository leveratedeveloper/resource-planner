import { config } from 'dotenv';
config({ path: '.env.local' });

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
import { sql } from 'drizzle-orm';

async function checkRowCounts() {
  console.log('Checking row counts...\n');

  const counts = {
    project_categories: await db.select({ count: sql<number>`count(*)` }).from(projectCategories),
    business_units: await db.select({ count: sql<number>`count(*)` }).from(businessUnits),
    departments: await db.select({ count: sql<number>`count(*)` }).from(departments),
    brands: await db.select({ count: sql<number>`count(*)` }).from(brands),
    employees: await db.select({ count: sql<number>`count(*)` }).from(employees),
    projects: await db.select({ count: sql<number>`count(*)` }).from(projects),
    assignments: await db.select({ count: sql<number>`count(*)` }).from(assignments),
  };

  console.log('Current row counts:');
  console.log(`  project_categories: ${counts.project_categories[0].count}`);
  console.log(`  business_units: ${counts.business_units[0].count}`);
  console.log(`  departments: ${counts.departments[0].count}`);
  console.log(`  brands: ${counts.brands[0].count}`);
  console.log(`  employees: ${counts.employees[0].count}`);
  console.log(`  projects: ${counts.projects[0].count}`);
  console.log(`  assignments: ${counts.assignments[0].count}`);

  process.exit(0);
}

checkRowCounts();
