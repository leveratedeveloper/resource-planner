import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function inspectBrandsSchema() {
  console.log('🔍 Inspecting brands table schema...\n');

  try {
    // Query information_schema to get all column definitions
    const columns = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'brands'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Brands Table Columns:');
    console.log('='.repeat(80));
    const columnRows = Array.isArray(columns) ? columns : columns.rows || [];
    columnRows.forEach((col: any) => {
      console.log(`${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | Nullable: ${col.is_nullable}`);
    });
    console.log('='.repeat(80));
    console.log('');

    // Retrieve sample brand records
    const sampleBrands = await db.execute(sql`
      SELECT * FROM brands LIMIT 3;
    `);

    console.log('📊 Sample Brand Records:');
    console.log('='.repeat(80));
    const brandRows = Array.isArray(sampleBrands) ? sampleBrands : sampleBrands.rows || [];
    if (brandRows.length > 0) {
      brandRows.forEach((brand: any, index: number) => {
        console.log(`\nBrand ${index + 1}:`);
        Object.entries(brand).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('No brands found in database');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error inspecting schema:', error);
    throw error;
  }
}

inspectBrandsSchema()
  .then(() => {
    console.log('\n✅ Schema inspection completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Schema inspection failed:', error);
    process.exit(1);
  });
