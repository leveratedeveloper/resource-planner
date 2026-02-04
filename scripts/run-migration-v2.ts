// Direct SQL migration runner (improved version)
// Run with: npx tsx scripts/run-migration-v2.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

async function runMigration() {
  console.log('🚀 Running database migration...\n');

  const sql = postgres(connectionString!);

  try {
    // Step 1: Create ENUMs (if they don't exist)
    console.log('📌 Step 1: Creating ENUMs...');
    try {
      await sql`CREATE TYPE "public"."assignment_status" AS ENUM('draft', 'confirmed', 'completed')`;
      console.log('✅ Created enum: assignment_status');
    } catch (e: any) {
      if (e.code === '42710') console.log('⚠️  Skipped (already exists): assignment_status');
      else throw e;
    }

    try {
      await sql`CREATE TYPE "public"."brand_status" AS ENUM('active', 'inactive', 'prospect')`;
      console.log('✅ Created enum: brand_status');
    } catch (e: any) {
      if (e.code === '42710') console.log('⚠️  Skipped (already exists): brand_status');
      else throw e;
    }

    try {
      await sql`CREATE TYPE "public"."employment_status" AS ENUM('active', 'inactive', 'contractor')`;
      console.log('✅ Created enum: employment_status');
    } catch (e: any) {
      if (e.code === '42710') console.log('⚠️  Skipped (already exists): employment_status');
      else throw e;
    }

    try {
      await sql`CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled')`;
      console.log('✅ Created enum: project_status');
    } catch (e: any) {
      if (e.code === '42710') console.log('⚠️  Skipped (already exists): project_status');
      else throw e;
    }

    try {
      await sql`CREATE TYPE "public"."visibility" AS ENUM('active', 'archived')`;
      console.log('✅ Created enum: visibility');
    } catch (e: any) {
      if (e.code === '42710') console.log('⚠️  Skipped (already exists): visibility');
      else throw e;
    }

    // Step 2: Create business_units table
    console.log('\n📌 Step 2: Creating business_units table...');
    try {
      await sql`
        CREATE TABLE "business_units" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "code" text NOT NULL,
          "color" text DEFAULT '#3b82f6' NOT NULL,
          "description" text,
          "is_active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "business_units_code_unique" UNIQUE("code")
        )
      `;
      console.log('✅ Created table: business_units');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): business_units');
      else throw e;
    }

    // Step 3: Create departments table
    console.log('\n📌 Step 3: Creating departments table...');
    try {
      await sql`
        CREATE TABLE "departments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "business_unit_id" uuid,
          "name" text NOT NULL,
          "code" text NOT NULL,
          "color" text DEFAULT '#10b981' NOT NULL,
          "description" text,
          "is_active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "departments_code_unique" UNIQUE("code")
        )
      `;
      console.log('✅ Created table: departments');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): departments');
      else throw e;
    }

    // Step 4: Create project_categories table
    console.log('\n📌 Step 4: Creating project_categories table...');
    try {
      await sql`
        CREATE TABLE "project_categories" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "description" text,
          "display_order" integer DEFAULT 0 NOT NULL,
          "is_active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "project_categories_name_unique" UNIQUE("name")
        )
      `;
      console.log('✅ Created table: project_categories');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): project_categories');
      else throw e;
    }

    // Step 5: Create brands table
    console.log('\n📌 Step 5: Creating brands table...');
    try {
      await sql`
        CREATE TABLE "brands" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "business_unit_id" uuid,
          "name" text NOT NULL,
          "client_code" text,
          "color" text DEFAULT '#3b82f6' NOT NULL,
          "logo" text,
          "website" text,
          "contact_name" text,
          "contact_title" text,
          "contact_email" text,
          "contact_phone" text,
          "industry_category" text,
          "description" text,
          "status" "brand_status" DEFAULT 'active' NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "brands_client_code_unique" UNIQUE("client_code")
        )
      `;
      console.log('✅ Created table: brands');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): brands');
      else throw e;
    }

    // Step 6: Create employees table
    console.log('\n📌 Step 6: Creating employees table...');
    try {
      await sql`
        CREATE TABLE "employees" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "employee_number" text,
          "full_name" text NOT NULL,
          "nickname" text,
          "email" text,
          "photo" text,
          "position" text NOT NULL,
          "department_id" uuid,
          "business_unit_id" uuid,
          "direct_supervisor_id" uuid,
          "weekly_capacity" integer DEFAULT 40 NOT NULL,
          "work_start_date" date,
          "date_of_birth" date,
          "employment_status" "employment_status" DEFAULT 'active' NOT NULL,
          "visibility" "visibility" DEFAULT 'active' NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "employees_employee_number_unique" UNIQUE("employee_number")
        )
      `;
      console.log('✅ Created table: employees');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): employees');
      else throw e;
    }

    // Step 7: Create employee_brand_assignments table
    console.log('\n📌 Step 7: Creating employee_brand_assignments table...');
    try {
      await sql`
        CREATE TABLE "employee_brand_assignments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "employee_id" uuid NOT NULL,
          "brand_id" uuid NOT NULL,
          "is_primary" boolean DEFAULT false NOT NULL,
          "start_date" date,
          "end_date" date,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "employee_brand_unique" UNIQUE("employee_id","brand_id")
        )
      `;
      console.log('✅ Created table: employee_brand_assignments');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): employee_brand_assignments');
      else throw e;
    }

    // Step 8: Create projects table
    console.log('\n📌 Step 8: Creating projects table...');
    try {
      await sql`
        CREATE TABLE "projects" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "brand_id" uuid NOT NULL,
          "business_unit_id" uuid,
          "project_category_id" uuid,
          "project_type_id" uuid,
          "name" text NOT NULL,
          "project_number" text,
          "description" text,
          "color" text DEFAULT '#10b981' NOT NULL,
          "budget" numeric(12, 2),
          "currency" text DEFAULT 'USD' NOT NULL,
          "start_date" date,
          "end_date" date,
          "status" "project_status" DEFAULT 'active' NOT NULL,
          "created_by_id" uuid,
          "notes" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "projects_project_number_unique" UNIQUE("project_number")
        )
      `;
      console.log('✅ Created table: projects');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): projects');
      else throw e;
    }

    // Step 9: Create assignments table
    console.log('\n📌 Step 9: Creating assignments table...');
    try {
      await sql`
        CREATE TABLE "assignments" (
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
          "status" "assignment_status" DEFAULT 'confirmed' NOT NULL,
          "note" text,
          "created_by_id" uuid,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `;
      console.log('✅ Created table: assignments');
    } catch (e: any) {
      if (e.code === '42P07') console.log('⚠️  Skipped (already exists): assignments');
      else throw e;
    }

    // Step 10: Add foreign key constraints
    console.log('\n📌 Step 10: Adding foreign key constraints...');

    const constraints = [
      { table: 'departments', name: 'departments_business_unit_id_business_units_id_fk', sql: sql`ALTER TABLE "departments" ADD CONSTRAINT "departments_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'brands', name: 'brands_business_unit_id_business_units_id_fk', sql: sql`ALTER TABLE "brands" ADD CONSTRAINT "brands_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'employees', name: 'employees_department_id_departments_id_fk', sql: sql`ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'employees', name: 'employees_business_unit_id_business_units_id_fk', sql: sql`ALTER TABLE "employees" ADD CONSTRAINT "employees_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'employees', name: 'employees_direct_supervisor_id_employees_id_fk', sql: sql`ALTER TABLE "employees" ADD CONSTRAINT "employees_direct_supervisor_id_employees_id_fk" FOREIGN KEY ("direct_supervisor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'employee_brand_assignments', name: 'employee_brand_assignments_employee_id_employees_id_fk', sql: sql`ALTER TABLE "employee_brand_assignments" ADD CONSTRAINT "employee_brand_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action` },
      { table: 'employee_brand_assignments', name: 'employee_brand_assignments_brand_id_brands_id_fk', sql: sql`ALTER TABLE "employee_brand_assignments" ADD CONSTRAINT "employee_brand_assignments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action` },
      { table: 'projects', name: 'projects_brand_id_brands_id_fk', sql: sql`ALTER TABLE "projects" ADD CONSTRAINT "projects_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'projects', name: 'projects_business_unit_id_business_units_id_fk', sql: sql`ALTER TABLE "projects" ADD CONSTRAINT "projects_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'projects', name: 'projects_project_category_id_project_categories_id_fk', sql: sql`ALTER TABLE "projects" ADD CONSTRAINT "projects_project_category_id_project_categories_id_fk" FOREIGN KEY ("project_category_id") REFERENCES "public"."project_categories"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'projects', name: 'projects_created_by_id_employees_id_fk', sql: sql`ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_employees_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action` },
      { table: 'assignments', name: 'assignments_employee_id_employees_id_fk', sql: sql`ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action` },
      { table: 'assignments', name: 'assignments_project_id_projects_id_fk', sql: sql`ALTER TABLE "assignments" ADD CONSTRAINT "assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action` },
      { table: 'assignments', name: 'assignments_created_by_id_employees_id_fk', sql: sql`ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_employees_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action` },
    ];

    for (const constraint of constraints) {
      try {
        await constraint.sql;
        console.log(`✅ Added constraint: ${constraint.name}`);
      } catch (e: any) {
        if (e.code === '42710' || e.code === '23505') {
          console.log(`⚠️  Skipped (already exists): ${constraint.name}`);
        } else {
          throw e;
        }
      }
    }

    // Step 11: Seed project categories
    console.log('\n📌 Step 11: Seeding project categories...');
    try {
      await sql`
        INSERT INTO "project_categories" ("name", "description", "display_order", "is_active")
        VALUES
          ('Pitch', 'New business pitches and proposals', 1, true),
          ('Campaign', 'Active client campaigns', 2, true),
          ('Operational', 'Internal operational projects', 3, true),
          ('R & D', 'Research and development initiatives', 4, true),
          ('Initiative Campaign', 'Special initiative campaigns', 5, true)
        ON CONFLICT ("name") DO NOTHING
      `;
      console.log('✅ Seeded project categories');
    } catch (e: any) {
      console.log(`⚠️  Error seeding categories (may already exist):`, e.message);
    }

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Run: npx tsx lib/db/seed.ts');
    console.log('2. Verify in Supabase dashboard');
    console.log('3. Continue with API implementation\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
