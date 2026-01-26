import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function applyBrandMigration() {
  console.log('🔄 Applying brand migration...\n');

  try {
    // Add the 4 new columns to the brands table
    await db.execute(sql`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "company_name" text;`);
    console.log('✅ Added company_name column');

    await db.execute(sql`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "brand_address" text;`);
    console.log('✅ Added brand_address column');

    await db.execute(sql`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "pic_finance_name" text;`);
    console.log('✅ Added pic_finance_name column');

    await db.execute(sql`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "pic_finance_phone" text;`);
    console.log('✅ Added pic_finance_phone column');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

applyBrandMigration()
  .then(() => {
    console.log('\n✅ All brand columns added successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
