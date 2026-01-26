import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

async function applyProjectMigration() {
  console.log('🔄 Starting project migration...\n');

  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    console.log('📝 Step 1: Updating budget column precision from decimal(12,2) to decimal(15,2)...');
    await sql`ALTER TABLE "projects" ALTER COLUMN "budget" TYPE decimal(15,2)`;
    console.log('✅ Budget column precision updated\n');

    console.log('📝 Step 2: Adding asf (Administrative Service Fee) column...');
    await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "asf" decimal(15,2)`;
    console.log('✅ ASF column added\n');

    console.log('📝 Step 3: Adding grand_total column...');
    await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "grand_total" decimal(15,2)`;
    console.log('✅ Grand total column added\n');

    console.log('📝 Step 4: Adding io_file column...');
    await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "io_file" text`;
    console.log('✅ IO file column added\n');

    console.log('📝 Step 5: Adding flag column...');
    await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "flag" text`;
    console.log('✅ Flag column added\n');

    console.log('📝 Step 6: Adding quotation_reference column...');
    await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "quotation_reference" text`;
    console.log('✅ Quotation reference column added\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('Summary of changes:');
    console.log('  - Updated budget precision: decimal(12,2) → decimal(15,2)');
    console.log('  - Added 5 new columns:');
    console.log('    • asf (decimal 15,2)');
    console.log('    • grand_total (decimal 15,2)');
    console.log('    • io_file (text)');
    console.log('    • flag (text)');
    console.log('    • quotation_reference (text)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migration
applyProjectMigration()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
