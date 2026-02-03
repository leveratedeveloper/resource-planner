// Quick mock assignments generator - optimized for speed
// Run with: npx tsx lib/db/generate-mock-assignments-quick.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import {
  assignments,
  employees,
  projects,
  type Employee,
  type Project
} from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const client = postgres(connectionString);
const db = drizzle(client);

// Date utilities
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDateInRange(minDaysOffset: number, maxDaysOffset: number): Date {
  const date = new Date();
  const randomOffset = Math.floor(Math.random() * (maxDaysOffset - minDaysOffset + 1)) + minDaysOffset;
  date.setDate(date.getDate() + randomOffset);
  return date;
}

function getRandomCategory(): string {
  const categories = ['Development', 'Design', 'Research', 'Meeting', 'Admin', 'Content', 'Project Management'];
  return categories[Math.floor(Math.random() * categories.length)];
}

function getRandomTimeOffType(): string {
  const types = ['Annual leave', 'Sick leave', 'Training', 'Conference', 'Personal day'];
  return types[Math.floor(Math.random() * types.length)];
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
  console.log('🌱 Quick mock assignment generation...\n');

  try {
    // Fetch data
    console.log('📋 Fetching existing data...');
    const allEmployees = await db.select().from(employees).where(eq(employees.employmentStatus, 'active'));
    const allProjects = await db.select().from(projects).where(eq(projects.status, 'active'));

    console.log(`   Found: ${allEmployees.length} employees, ${allProjects.length} projects\n`);

    if (allEmployees.length === 0 || allProjects.length === 0) {
      console.error('❌ No active employees or projects found.');
      process.exit(1);
    }

    // Clear existing assignments
    console.log('🗑️  Clearing existing assignments...');
    await db.delete(assignments);
    console.log('   ✓ Assignments cleared\n');

    // Generate assignments
    console.log('📅 Generating mock assignments...');
    const newAssignments: any[] = [];
    const stats = { total: 0, project: 0, timeOff: 0 };

    for (const employee of allEmployees) {
      // 1-2 time-off periods
      const timeOffCount = getRandomInt(1, 2);
      for (let i = 0; i < timeOffCount; i++) {
        const startDate = getRandomDateInRange(-15, 90);
        const duration = getRandomInt(5, 10);
        const endDate = addDays(startDate, duration);

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
          note: getRandomTimeOffType(),
          createdById: employee.id,
        });
        stats.timeOff++;
        stats.total++;
      }

      // 3-5 project assignments
      const projectCount = getRandomInt(3, 5);
      for (let i = 0; i < projectCount; i++) {
        const project = allProjects[Math.floor(Math.random() * allProjects.length)];
        const startDate = getRandomDateInRange(-30, 60);
        const duration = getRandomInt(7, 21);
        const endDate = addDays(startDate, duration);
        const allocation = getRandomInt(25, 100);
        const hoursPerDay = Math.floor((allocation / 100) * 8);

        newAssignments.push({
          employeeId: employee.id,
          projectId: project.id,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          hoursPerDay: hoursPerDay.toString(),
          allocationPercentage: allocation.toString(),
          isTimeOff: false,
          category: getRandomCategory(),
          isBillable: true,
          status: getAssignmentStatus(startDate),
          note: `Working on ${project.name}`,
          createdById: employee.id,
        });
        stats.project++;
        stats.total++;
      }
    }

    // Batch insert
    console.log(`   Inserting ${newAssignments.length} assignments...`);
    
    // Insert in batches of 100 to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < newAssignments.length; i += batchSize) {
      const batch = newAssignments.slice(i, i + batchSize);
      await db.insert(assignments).values(batch);
      console.log(`   Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newAssignments.length / batchSize)}`);
    }

    console.log('\n✅ Mock assignment generation complete!');
    console.log(`   - Total: ${stats.total}`);
    console.log(`   - Project: ${stats.project}`);
    console.log(`   - Time-off: ${stats.timeOff}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

main();
