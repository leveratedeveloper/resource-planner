// Add project_category_id column to existing projects table
// Run with: npx tsx scripts/add-project-category-column.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

async function addColumn() {
  console.log('🚀 Adding project_category_id column to projects table...\n');

  const sql = postgres(connectionString!);

  try {
    // Add the column
    console.log('📌 Adding column...');
    await sql`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "project_category_id" uuid
    `;
    console.log('✅ Added column: project_category_id');

    // Add the foreign key constraint
    console.log('\n📌 Adding foreign key constraint...');
    try {
      await sql`
        ALTER TABLE "projects"
        ADD CONSTRAINT "projects_project_category_id_project_categories_id_fk"
        FOREIGN KEY ("project_category_id")
        REFERENCES "public"."project_categories"("id")
        ON DELETE no action ON UPDATE no action
      `;
      console.log('✅ Added constraint: projects_project_category_id_project_categories_id_fk');
    } catch (e: any) {
      if (e.code === '42710' || e.code === '23505') {
        console.log('⚠️  Constraint already exists');
      } else {
        throw e;
      }
    }

    console.log('\n🎉 Column and constraint added successfully!\n');
    console.log('Next steps:');
    console.log('1. Run: npx tsx lib/db/seed.ts');
    console.log('2. Verify in Supabase dashboard');
    console.log('3. Continue with API implementation\n');

  } catch (error) {
    console.error('\n❌ Operation failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

addColumn().then(() => process.exit(0)).catch(() => process.exit(1));
