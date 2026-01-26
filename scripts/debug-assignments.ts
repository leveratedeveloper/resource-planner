import { parseTable, filterRows } from './parse-mysql-dump';
import { readFileSync } from 'fs';

const SQL_DUMP_PATH = './timetrack_prd_db_neptune14-00012026.sql';

console.log('Debugging assignments/tasks data...\n');

// Load ID mappings
const mappingsJson = JSON.parse(readFileSync('./scripts/id-mappings.json', 'utf-8'));
const campaignIds = new Set(mappingsJson.campaigns.map((m: any) => m[0]));
const employeeIds = new Set(mappingsJson.employees.map((m: any) => m[0]));

console.log(`Migrated campaigns: ${campaignIds.size}`);
console.log(`Migrated employees: ${employeeIds.size}`);

const parsed = parseTable('tasks', SQL_DUMP_PATH);
console.log(`\nTotal tasks: ${parsed.rows.length}`);

// Check active tasks
const activeRows = filterRows(parsed.rows, row => row.flag === 'active');
console.log(`Active tasks: ${activeRows.length}`);

// Check tasks with employee references
const withEmployee = filterRows(activeRows, row => row.task_creator);
console.log(`With employee: ${withEmployee.length}`);

// Check tasks with campaign references
const withCampaign = filterRows(activeRows, row => row.reference_id);
console.log(`With campaign reference: ${withCampaign.length}`);

// Check tasks with both
const withBoth = filterRows(activeRows, row => row.task_creator && row.reference_id);
console.log(`With both: ${withBoth.length}`);

// Check how many reference migrated campaigns
const referenceMigratedCampaigns = filterRows(withBoth, row => campaignIds.has(row.reference_id));
console.log(`Reference migrated campaigns: ${referenceMigratedCampaigns.length}`);

// Check how many have migrated employees
const haveMigratedEmployees = filterRows(referenceMigratedCampaigns, row => employeeIds.has(row.task_creator));
console.log(`Have migrated employees: ${haveMigratedEmployees.length}`);

// Sample some matching tasks
console.log('\nSample tasks that should match:');
haveMigratedEmployees.slice(0, 5).forEach(row => {
  console.log(`  - Task: ${row.task_name}`);
  console.log(`    Employee ID: ${row.task_creator} (migrated: ${employeeIds.has(row.task_creator)})`);
  console.log(`    Campaign ID: ${row.reference_id} (migrated: ${campaignIds.has(row.reference_id)})`);
  console.log(`    Created: ${row.created_at}`);
  console.log('');
});

// Check what campaign IDs are in tasks
const taskCampaignIds = new Set<number>();
withCampaign.forEach(row => taskCampaignIds.add(row.reference_id));
console.log(`\nUnique campaign IDs in tasks: ${taskCampaignIds.size}`);

// Check overlap
const overlap = Array.from(taskCampaignIds).filter(id => campaignIds.has(id));
console.log(`Overlap with migrated campaigns: ${overlap.length}`);

if (overlap.length > 0) {
  console.log('\nSample overlapping campaign IDs:', overlap.slice(0, 10));
}
