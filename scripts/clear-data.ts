import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db';
import {
  assignments,
  employeeBrandAssignments,
  projects,
  employees,
  brands,
  departments,
  businessUnits
} from '../lib/db/schema';

async function clearData() {
  console.log('Clearing existing data (preserving project_categories)...\n');

  try {
    // Delete in reverse order of dependencies
    console.log('Deleting assignments...');
    await db.delete(assignments);

    console.log('Deleting employee_brand_assignments...');
    await db.delete(employeeBrandAssignments);

    console.log('Deleting projects...');
    await db.delete(projects);

    console.log('Deleting employees...');
    await db.delete(employees);

    console.log('Deleting brands...');
    await db.delete(brands);

    console.log('Deleting departments...');
    await db.delete(departments);

    console.log('Deleting business_units...');
    await db.delete(businessUnits);

    console.log('\n✓ All data cleared (project_categories preserved)');
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to clear data:', error);
    process.exit(1);
  }
}

clearData();
