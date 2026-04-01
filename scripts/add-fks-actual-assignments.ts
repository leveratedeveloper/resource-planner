/**
 * Add foreign keys to actual_assignments table
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set!');
}

const sql = postgres(connectionString);

async function addForeignKeys() {
  console.log('Adding foreign keys to actual_assignments...\n');

  try {
    // Check existing FKs
    const existingFKs = await sql`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
      AND table_name = 'actual_assignments'
      AND constraint_type = 'FOREIGN KEY'
    `;

    const fkNames = existingFKs.map(fk => fk.constraint_name);
    console.log('Existing FKs:', fkNames);

    // Add FK: employee_id -> employees.id
    if (!fkNames.includes('actual_assignments_employee_id_employees_id_fk')) {
      await sql`
        ALTER TABLE "actual_assignments"
        ADD CONSTRAINT "actual_assignments_employee_id_employees_id_fk"
        FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
        ON DELETE cascade ON UPDATE no action
      `;
      console.log('Added FK: employee_id -> employees.id');
    } else {
      console.log('FK employee_id already exists');
    }

    // Add FK: project_id -> projects.id
    if (!fkNames.includes('actual_assignments_project_id_projects_id_fk')) {
      await sql`
        ALTER TABLE "actual_assignments"
        ADD CONSTRAINT "actual_assignments_project_id_projects_id_fk"
        FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
        ON DELETE cascade ON UPDATE no action
      `;
      console.log('Added FK: project_id -> projects.id');
    } else {
      console.log('FK project_id already exists');
    }

    // Add FK: created_by_id -> employees.id
    if (!fkNames.includes('actual_assignments_created_by_id_employees_id_fk')) {
      await sql`
        ALTER TABLE "actual_assignments"
        ADD CONSTRAINT "actual_assignments_created_by_id_employees_id_fk"
        FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id")
        ON DELETE no action ON UPDATE no action
      `;
      console.log('Added FK: created_by_id -> employees.id');
    } else {
      console.log('FK created_by_id already exists');
    }

    console.log('\nForeign keys added successfully!');
  } catch (error) {
    console.error('Failed to add foreign keys:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

addForeignKeys().catch(console.error);
