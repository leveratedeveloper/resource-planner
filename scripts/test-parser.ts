import { parseTable } from './parse-mysql-dump';

const SQL_DUMP_PATH = './timetrack_prd_db_neptune14-00012026.sql';

console.log('Testing MySQL parser...\n');

// Test business units
console.log('=== Business Units ===');
const buData = parseTable('business_units', SQL_DUMP_PATH);
console.log(`Columns: ${buData.columns.join(', ')}`);
console.log(`Rows: ${buData.rows.length}`);
if (buData.rows.length > 0) {
  console.log('Sample:', buData.rows[0]);
}

// Test departments
console.log('\n=== Departments ===');
const deptData = parseTable('departments', SQL_DUMP_PATH);
console.log(`Columns: ${deptData.columns.join(', ')}`);
console.log(`Rows: ${deptData.rows.length}`);
if (deptData.rows.length > 0) {
  console.log('Sample:', deptData.rows[0]);
}

// Test brands
console.log('\n=== Brands ===');
const brandData = parseTable('brands', SQL_DUMP_PATH);
console.log(`Columns: ${brandData.columns.join(', ')}`);
console.log(`Rows: ${brandData.rows.length}`);
if (brandData.rows.length > 0) {
  console.log('Sample:', brandData.rows[0]);
}

console.log('\n✓ Parser test complete!');
