// Verification script for assignments
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import { assignments, employees, projects, brands } from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function verify() {
  console.log('🔍 Verifying assignments data...\n');

  // 1. Check total assignments
  const totalAssignments = await db.select({ count: sql<number>`count(*)` }).from(assignments);
  console.log(`Total Assignments: ${totalAssignments[0].count}`);

  // 2. Check assignments by employee
  console.log('\n📊 Assignments by Employee:');
  const assignmentsByEmployee = await db
    .select({
      employeeName: employees.fullName,
      totalAssignments: sql<number>`count(*)`,
      projectCount: sql<number>`sum(case when ${assignments.isTimeOff} = false then 1 else 0 end)`,
      timeOffCount: sql<number>`sum(case when ${assignments.isTimeOff} = true then 1 else 0 end)`,
    })
    .from(assignments)
    .innerJoin(employees, eq(assignments.employeeId, employees.id))
    .groupBy(employees.id, employees.fullName)
    .orderBy(sql`count(*) desc`);

  for (const row of assignmentsByEmployee) {
    console.log(`  ${row.employeeName}: ${row.totalAssignments} total (${row.projectCount} projects, ${row.timeOffCount} time-off)`);
  }

  // 3. Check category distribution
  console.log('\n📈 Category Distribution:');
  const categoryDist = await db
    .select({
      category: assignments.category,
      count: sql<number>`count(*)`,
    })
    .from(assignments)
    .where(eq(assignments.isTimeOff, false))
    .groupBy(assignments.category)
    .orderBy(sql`count(*) desc`);

  const totalProjectAssignments = categoryDist.reduce((sum, row) => sum + Number(row.count), 0);

  for (const row of categoryDist) {
    const percentage = ((Number(row.count) / totalProjectAssignments) * 100).toFixed(1);
    console.log(`  ${row.category || 'None'}: ${row.count} (${percentage}%)`);
  }

  // 4. Check date range
  console.log('\n📅 Assignment Date Range:');
  const dateRange = await db
    .select({
      minDate: sql<string>`min(${assignments.startDate})`,
      maxDate: sql<string>`max(${assignments.endDate})`,
    })
    .from(assignments);

  console.log(`  From: ${dateRange[0].minDate}`);
  console.log(`  To: ${dateRange[0].maxDate}`);

  // 5. Check recently updated projects
  console.log('\n🏗️  Recently Updated Projects:');
  const recentProjects = await db
    .select({
      name: projects.name,
      status: projects.status,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .orderBy(sql`${projects.updatedAt} desc`);

  for (const project of recentProjects) {
    const date = new Date(project.updatedAt);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${project.name}: ${project.status} (updated ${daysAgo} days ago)`);
  }

  // 6. Check recently updated brands
  console.log('\n🏷️  Recently Updated Brands:');
  const recentBrands = await db
    .select({
      name: brands.name,
      status: brands.status,
      updatedAt: brands.updatedAt,
    })
    .from(brands)
    .orderBy(sql`${brands.updatedAt} desc`);

  for (const brand of recentBrands) {
    const date = new Date(brand.updatedAt);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${brand.name}: ${brand.status} (updated ${daysAgo} days ago)`);
  }

  // 7. Check status distribution
  console.log('\n✅ Status Distribution:');
  const statusDist = await db
    .select({
      status: assignments.status,
      count: sql<number>`count(*)`,
    })
    .from(assignments)
    .where(eq(assignments.isTimeOff, false))
    .groupBy(assignments.status);

  for (const row of statusDist) {
    console.log(`  ${row.status}: ${row.count}`);
  }

  console.log('\n🎉 Verification complete!');
  process.exit(0);
}

verify().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
