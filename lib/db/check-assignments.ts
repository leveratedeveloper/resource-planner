import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, like, sql } from 'drizzle-orm';
import { assignments, employees, projects } from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  // Check total assignments
  const totalAssignments = await db.select({ count: sql<number>`count(*)` }).from(assignments);
  console.log(`\n📊 Total assignments in database: ${totalAssignments[0].count}\n`);

  // Find employee L-383
  const emp = await db.select().from(employees).where(eq(employees.employeeNumber, 'L-383')).limit(1);

  if (emp.length > 0) {
    console.log(`✅ Found employee: ${emp[0].fullName} (${emp[0].employeeNumber})`);
    console.log(`   Position: ${emp[0].position}\n`);

    // Get their assignments
    const empAssignments = await db.select({
      startDate: assignments.startDate,
      endDate: assignments.endDate,
      hours: assignments.hoursPerDay,
      allocation: assignments.allocationPercentage,
      category: assignments.category,
      isTimeOff: assignments.isTimeOff,
      projectId: assignments.projectId,
      status: assignments.status
    })
    .from(assignments)
    .where(eq(assignments.employeeId, emp[0].id));

    console.log(`   Total assignments: ${empAssignments.length}\n`);

    // Get project names for non-time-off assignments
    for (const a of empAssignments.slice(0, 10)) {
      if (a.isTimeOff) {
        console.log(`   - 🏖️  ${a.startDate} to ${a.endDate}: Time off`);
      } else if (a.projectId) {
        const proj = await db.select().from(projects).where(eq(projects.id, a.projectId)).limit(1);
        if (proj.length > 0) {
          console.log(`   - 📋 ${a.startDate} to ${a.endDate}: ${proj[0].name} (${a.hours}h/day, ${a.allocation}%)`);
        }
      }
    }
  } else {
    console.log(`⚠️  Employee L-383 not found`);
  }

  // Check for GoFood projects
  console.log(`\n🔍 Searching for GoFood projects...`);
  const goFoodProjects = await db.select().from(projects)
    .where(sql`LOWER(${projects.name}) LIKE '%gofood%'`)
    .limit(10);

  if (goFoodProjects.length > 0) {
    console.log(`   Found ${goFoodProjects.length} GoFood projects:\n`);
    for (const p of goFoodProjects) {
      console.log(`   - ${p.name} (${p.status})`);

      // Show assignments for this project
      const projAssignments = await db.select({
        empId: assignments.employeeId,
        startDate: assignments.startDate,
        endDate: assignments.endDate
      })
      .from(assignments)
      .where(eq(assignments.projectId, p.id))
      .limit(3);

      console.log(`     ${projAssignments.length} assignments`);
    }
  } else {
    console.log(`   No GoFood projects found`);
    console.log(`\n📋 Showing sample projects instead:`);
    const sampleProjects = await db.select().from(projects).limit(10);
    for (const p of sampleProjects) {
      console.log(`   - ${p.name}`);
    }
  }

  await client.end();
}

main();
