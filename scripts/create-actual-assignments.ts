/**
 * Create actual_assignments table
 *
 * Usage: npx tsx scripts/create-actual-assignments.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak di-set!');
}

const sql = postgres(connectionString);

async function createActualAssignmentsTable() {
  console.log('Creating actual_assignments table...');

  try {
    // Check if table already exists
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'actual_assignments'
    `;

    if (existingTables.length > 0) {
      console.log('Table actual_assignments already exists.');
      await sql.end();
      return;
    }

    // Create actual_assignments table
    await sql`
      CREATE TABLE "actual_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "employee_id" uuid NOT NULL,
        "project_id" uuid,
        "task_id" uuid,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "hours_per_day" numeric(4, 2) DEFAULT '8' NOT NULL,
        "allocation_percentage" numeric(5, 2),
        "is_time_off" boolean DEFAULT false NOT NULL,
        "time_off_type_id" uuid,
        "category" text,
        "is_billable" boolean DEFAULT true NOT NULL,
        "status" "assignment_status" DEFAULT 'completed' NOT NULL,
        "note" text,
        "created_by_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('Created actual_assignments table');

    // Add foreign keys
    await sql`
      ALTER TABLE "actual_assignments"
      ADD CONSTRAINT "actual_assignments_employee_id_employees_id_fk"
      FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
      ON DELETE cascade ON UPDATE no action
    `;
    console.log('Added FK: employee_id -> employees.id');

    await sql`
      ALTER TABLE "actual_assignments"
      ADD CONSTRAINT "actual_assignments_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
      ON DELETE cascade ON UPDATE no action
    `;
    console.log('Added FK: project_id -> projects.id');

    await sql`
      ALTER TABLE "actual_assignments"
      ADD CONSTRAINT "actual_assignments_created_by_id_employees_id_fk"
      FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id")
      ON DELETE no action ON UPDATE no action
    `;
    console.log('Added FK: created_by_id -> employees.id');

    // Check if employees.gender column already exists
    const genderColumn = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'gender'
    `;

    if (genderColumn.length === 0) {
      await sql`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "gender" text`;
      console.log('Added employees.gender column');
    } else {
      console.log('Column employees.gender already exists.');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

createActualAssignmentsTable().catch(console.error);
