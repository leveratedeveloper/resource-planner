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

async function inspectProjectsSchema() {
  console.log('🔍 Inspecting projects table schema...\n');

  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    // Get column information for projects table
    const columns = await sql`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'projects'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Projects Table Schema:');
    console.log('─'.repeat(100));
    console.log(
      'Column Name'.padEnd(30) +
      'Data Type'.padEnd(20) +
      'Precision'.padEnd(15) +
      'Nullable'.padEnd(10) +
      'Default'
    );
    console.log('─'.repeat(100));

    columns.forEach((col: any) => {
      const precision = col.numeric_precision && col.numeric_scale
        ? `(${col.numeric_precision},${col.numeric_scale})`
        : col.character_maximum_length
        ? `(${col.character_maximum_length})`
        : '';

      console.log(
        col.column_name.padEnd(30) +
        col.data_type.padEnd(20) +
        precision.padEnd(15) +
        col.is_nullable.padEnd(10) +
        (col.column_default || '')
      );
    });

    console.log('─'.repeat(100));

    // Highlight new fields
    console.log('\n✨ New/Updated Fields:');
    const newFields = columns.filter((col: any) =>
      ['asf', 'grand_total', 'io_file', 'flag', 'quotation_reference'].includes(col.column_name)
    );

    if (newFields.length > 0) {
      newFields.forEach((col: any) => {
        const precision = col.numeric_precision && col.numeric_scale
          ? `(${col.numeric_precision},${col.numeric_scale})`
          : '';
        console.log(`  ✓ ${col.column_name} - ${col.data_type}${precision}`);
      });
    } else {
      console.log('  ⚠️  New fields not found. Run migration first with: npx tsx scripts/apply-project-migration.ts');
    }

    // Check budget precision
    const budgetCol = columns.find((col: any) => col.column_name === 'budget');
    if (budgetCol) {
      console.log('\n💰 Budget Field Details:');
      console.log(`  Type: ${budgetCol.data_type}`);
      console.log(`  Precision: (${budgetCol.numeric_precision},${budgetCol.numeric_scale})`);

      if (budgetCol.numeric_precision === 15 && budgetCol.numeric_scale === 2) {
        console.log('  ✓ Budget precision updated correctly to decimal(15,2)');
      } else {
        console.log('  ⚠️  Budget precision not updated. Expected (15,2), got (' +
          budgetCol.numeric_precision + ',' + budgetCol.numeric_scale + ')');
      }
    }

    // Get sample count
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM projects`;
    console.log(`\n📊 Total projects in database: ${count}`);

  } catch (error) {
    console.error('❌ Error inspecting schema:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run inspection
inspectProjectsSchema()
  .then(() => {
    console.log('\n✅ Schema inspection complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Inspection failed:', error);
    process.exit(1);
  });
