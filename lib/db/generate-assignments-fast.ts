// Quick assignment generator - no timestamp updates
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { assignments, employees, projects } from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDateInRange(minDaysOffset: number, maxDaysOffset: number): Date {
  const date = new Date();
  const randomOffset = Math.floor(Math.random() * (maxDaysOffset - minDaysOffset + 1)) + minDaysOffset;
  date.setDate(date.getDate() + randomOffset);
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getRandomCategory(): string {
  const categories = ['Development', 'Design', 'Research', 'Meeting', 'Admin', 'Content', 'Project Management'];
  return categories[Math.floor(Math.random() * categories.length)];
}

function getAssignmentStatus(startDate: Date): 'draft' | 'confirmed' | 'completed' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start < today) return 'completed';
  return Math.random() > 0.3 ? 'confirmed' : 'draft';
}

async function main() {
  console.log('⚡ Fast assignment generation...\n');

  // Fetch data
  console.log('📋 Fetching data...');
  const allEmployees = await db.select().from(employees).where(eq(employees.employmentStatus, 'active'));
  const allProjects = await db.select().from(projects).where(eq(projects.status, 'active'));

  console.log(`   Found: ${allEmployees.length} employees, ${allProjects.length} projects\n`);

  if (allEmployees.length === 0 || allProjects.length === 0) {
    console.error('❌ No active employees or projects found');
    process.exit(1);
  }

  // Clear existing assignments
  console.log('🗑️  Clearing existing assignments...');
  await db.delete(assignments);
  console.log('   ✓ Cleared\n');

  // Generate assignments
  console.log('📅 Generating assignments...');
  const newAssignments: any[] = [];
  let stats = { total: 0, project: 0, timeOff: 0 };

  for (const employee of allEmployees) {
    // Time off (1-2 per employee)
    for (let i = 0; i < getRandomInt(1, 2); i++) {
      const startDate = getRandomDateInRange(-15, 90);
      const endDate = addDays(startDate, getRandomInt(5, 10));

      newAssignments.push({
        employeeId: employee.id,
        projectId: null,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        hoursPerDay: '8',
        allocationPercentage: '100',
        isTimeOff: true,
        category: null,
        isBillable: false,
        status: 'confirmed',
        note: 'Time off',
        createdById: employee.id,
      });

      stats.timeOff++;
      stats.total++;
    }

    // Project assignments (8-12 per employee)
    const assignmentCount = getRandomInt(8, 12);
    for (let i = 0; i < assignmentCount; i++) {
      const project = allProjects[Math.floor(Math.random() * allProjects.length)];
      const startDate = getRandomDateInRange(-30, 60);
      const duration = getRandomInt(7, 28);
      const endDate = addDays(startDate, duration);
      const category = getRandomCategory();
      const allocation = getRandomInt(25, 100).toString();
      const hoursPerDay = Math.floor((parseInt(allocation) / 100) * 8).toString();

      newAssignments.push({
        employeeId: employee.id,
        projectId: project.id,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        hoursPerDay,
        allocationPercentage: allocation,
        isTimeOff: false,
        category,
        isBillable: category !== 'Meeting' && category !== 'Admin',
        status: getAssignmentStatus(startDate),
        note: `Working on ${project.name}`,
        createdById: employee.id,
      });

      stats.project++;
      stats.total++;
    }
  }

  // Insert in batches
  console.log(`   Inserting ${newAssignments.length} assignments...`);
  const batchSize = 500;
  for (let i = 0; i < newAssignments.length; i += batchSize) {
    const batch = newAssignments.slice(i, i + batchSize);
    await db.insert(assignments).values(batch);
    console.log(`   ✓ Inserted ${Math.min(i + batchSize, newAssignments.length)}/${newAssignments.length}`);
  }

  console.log('\n✅ Complete!\n');
  console.log('Summary:');
  console.log(`- Total: ${stats.total}`);
  console.log(`- Project assignments: ${stats.project}`);
  console.log(`- Time-off: ${stats.timeOff}`);

  await client.end();
  process.exit(0);
}

main().catch(console.error);
