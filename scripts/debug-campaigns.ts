import { parseTable, filterRows, sortRows, limitRows } from './parse-mysql-dump';

const SQL_DUMP_PATH = './timetrack_prd_db_neptune14-00012026.sql';

console.log('Debugging campaigns data...\n');

const parsed = parseTable('campaigns', SQL_DUMP_PATH);
console.log(`Total campaigns: ${parsed.rows.length}`);

// Check flags
const flagCounts: any = {};
parsed.rows.forEach(row => {
  flagCounts[row.flag] = (flagCounts[row.flag] || 0) + 1;
});
console.log('\nFlag distribution:', flagCounts);

// Check active campaigns
const activeRows = filterRows(parsed.rows, row => row.flag === 'active');
console.log(`\nActive campaigns: ${activeRows.length}`);

// Check date ranges
const dates = activeRows.map(row => new Date(row.created_at)).sort((a, b) => a.getTime() - b.getTime());
console.log(`\nDate range of active campaigns:`);
console.log(`  Earliest: ${dates[0]?.toISOString()}`);
console.log(`  Latest: ${dates[dates.length - 1]?.toISOString()}`);

// Count by year
const yearCounts: any = {};
activeRows.forEach(row => {
  const year = new Date(row.created_at).getFullYear();
  yearCounts[year] = (yearCounts[year] || 0) + 1;
});
console.log('\nActive campaigns by year:');
Object.keys(yearCounts).sort().forEach(year => {
  console.log(`  ${year}: ${yearCounts[year]}`);
});

// Check 2024+ campaigns
const recent = filterRows(activeRows, row => {
  const createdAt = new Date(row.created_at);
  return createdAt >= new Date('2024-01-01');
});
console.log(`\nCampaigns since 2024-01-01: ${recent.length}`);

// If none, try different date ranges
if (recent.length === 0) {
  console.log('\nTrying 2023-01-01...');
  const recent2023 = filterRows(activeRows, row => {
    const createdAt = new Date(row.created_at);
    return createdAt >= new Date('2023-01-01');
  });
  console.log(`Campaigns since 2023-01-01: ${recent2023.length}`);

  if (recent2023.length > 0) {
    console.log('\nSample 2023+ campaigns:');
    recent2023.slice(0, 5).forEach(row => {
      console.log(`  - ${row.campaign_name} (${row.created_at})`);
    });
  }
}

// Show sample active campaigns
console.log('\nSample active campaigns (all time):');
sortRows(activeRows, 'created_at', 'desc').slice(0, 10).forEach(row => {
  console.log(`  - ${row.campaign_name} (${row.created_at})`);
});
