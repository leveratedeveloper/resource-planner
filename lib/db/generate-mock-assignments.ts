// Generate mock assignments for existing real employees and projects
// Run with: npx tsx lib/db/generate-mock-assignments.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import {
  assignments,
  employees,
  projects,
  brands,
  type Assignment,
  type Employee,
  type Project
} from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const client = postgres(connectionString);
const db = drizzle(client);

// ============ HELPER FUNCTIONS ============

// Date utility functions
function getRandomDateInPast(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

function getRandomDateInFuture(daysAhead: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
  return date;
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

// Assignment generation helpers
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomHoursPerDay(): string {
  const hours = [2, 4, 6, 8];
  return hours[Math.floor(Math.random() * hours.length)].toString();
}

function getRandomAllocation(): string {
  const allocations = ['25', '50', '75', '100'];
  return allocations[Math.floor(Math.random() * allocations.length)];
}

function getRandomCategory(): string {
  const categories = ['Development', 'Design', 'Research', 'Meeting', 'Admin', 'Content', 'Project Management'];
  const weights = [30, 25, 15, 10, 10, 5, 5]; // Percentage distribution
  const random = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) return categories[i];
  }
  return 'Development';
}

function getRandomTimeOffType(): string {
  const types = ['Annual leave', 'Sick leave', 'Training', 'Conference', 'Personal day'];
  return types[Math.floor(Math.random() * types.length)];
}

// Conflict detection
function hasTimeOffConflict(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  existingAssignments: Assignment[]
): boolean {
  return existingAssignments.some(a =>
    a.employeeId === employeeId &&
    a.isTimeOff &&
    !(endDate < new Date(a.startDate) || startDate > new Date(a.endDate))
  );
}

// Get assignment status based on date
function getAssignmentStatus(startDate: Date): 'draft' | 'confirmed' | 'completed' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start < today) {
    return 'completed';
  }
  // Mix of confirmed and draft for future assignments
  return Math.random() > 0.3 ? 'confirmed' : 'draft';
}

// ============ DATA UPDATE FUNCTIONS ============

async function updateRecentProjects() {
  console.log('📊 Updating recent projects timestamps...');

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const allProjects = await db.select().from(projects);
  let updated = 0;

  for (const project of allProjects) {
    // Update active projects or recently updated ones
    if (project.status === 'active' || new Date(project.updatedAt) >= threeMonthsAgo) {
      // Random date within past 90 days
      const randomDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
      await db.update(projects)
        .set({ updatedAt: randomDate })
        .where(eq(projects.id, project.id));
      updated++;
    }
  }

  console.log(`   ✓ Updated ${updated} projects with recent timestamps`);
}

async function updateRecentBrands() {
  console.log('🏷️  Updating recent brands timestamps...');

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const allBrands = await db.select().from(brands);
  let updated = 0;

  for (const brand of allBrands) {
    // Update active brands or recently updated ones
    if (brand.status === 'active' || new Date(brand.updatedAt) >= threeMonthsAgo) {
      // Random date within past 90 days
      const randomDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
      await db.update(brands)
        .set({ updatedAt: randomDate })
        .where(eq(brands.id, brand.id));
      updated++;
    }
  }

  console.log(`   ✓ Updated ${updated} brands with recent timestamps`);
}

// ============ ASSIGNMENT GENERATION FUNCTION ============

async function generateMockAssignments(
  allEmployees: Employee[],
  allProjects: Project[]
): Promise<{
  total: number;
  project: number;
  timeOff: number;
  byCategory: Record<string, number>;
}> {
  console.log('📅 Generating comprehensive mock assignments...');

  const existingAssignments: Assignment[] = [];
  const newAssignments: any[] = [];
  const stats = {
    total: 0,
    project: 0,
    timeOff: 0,
    byCategory: {} as Record<string, number>,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // First, generate time-off for all employees (to avoid conflicts)
  console.log('   Generating time-off periods...');
  for (const employee of allEmployees) {
    const timeOffCount = getRandomInt(1, 2);

    for (let i = 0; i < timeOffCount; i++) {
      const startDate = getRandomDateInRange(-15, 90);
      const duration = getRandomInt(5, 10); // 5-10 days
      const endDate = addDays(startDate, duration);

      const timeOffAssignment = {
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
      };

      newAssignments.push(timeOffAssignment);
      existingAssignments.push({
        ...timeOffAssignment,
        id: `temp-${Date.now()}-${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      stats.timeOff++;
      stats.total++;
    }
  }

  // Generate project assignments for each employee
  console.log('   Generating project assignments...');
  for (const employee of allEmployees) {
    // 2-3 major project assignments (75-100% allocation, 2-4 weeks each)
    const majorAssignmentCount = getRandomInt(2, 3);
    for (let i = 0; i < majorAssignmentCount; i++) {
      const project = allProjects[Math.floor(Math.random() * allProjects.length)];
      const startDate = getRandomDateInRange(-30, 60);
      const duration = getRandomInt(14, 28); // 2-4 weeks
      const endDate = addDays(startDate, duration);

      // Check for time-off conflicts
      if (hasTimeOffConflict(employee.id, startDate, endDate, existingAssignments)) {
        continue;
      }

      const category = getRandomCategory();
      const allocation = getRandomInt(75, 100).toString();
      const hoursPerDay = Math.floor((parseInt(allocation) / 100) * 8).toString();

      const assignment = {
        employeeId: employee.id,
        projectId: project.id,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        hoursPerDay,
        allocationPercentage: allocation,
        isTimeOff: false,
        category,
        isBillable: true,
        status: getAssignmentStatus(startDate),
        note: `Working on ${project.name}`,
        createdById: employee.id,
      };

      newAssignments.push(assignment);
      stats.project++;
      stats.total++;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    // 3-5 smaller project assignments (25-50% allocation, 1-2 weeks each)
    const smallerAssignmentCount = getRandomInt(3, 5);
    for (let i = 0; i < smallerAssignmentCount; i++) {
      const project = allProjects[Math.floor(Math.random() * allProjects.length)];
      const startDate = getRandomDateInRange(-20, 50);
      const duration = getRandomInt(7, 14); // 1-2 weeks
      const endDate = addDays(startDate, duration);

      // Check for time-off conflicts
      if (hasTimeOffConflict(employee.id, startDate, endDate, existingAssignments)) {
        continue;
      }

      const category = getRandomCategory();
      const allocation = getRandomInt(25, 50).toString();
      const hoursPerDay = Math.floor((parseInt(allocation) / 100) * 8).toString();

      const assignment = {
        employeeId: employee.id,
        projectId: project.id,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        hoursPerDay,
        allocationPercentage: allocation,
        isTimeOff: false,
        category,
        isBillable: true,
        status: getAssignmentStatus(startDate),
        note: `Support for ${project.name}`,
        createdById: employee.id,
      };

      newAssignments.push(assignment);
      stats.project++;
      stats.total++;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    // 1-2 recurring meetings (2-4 hours, weekly blocks)
    const meetingCount = getRandomInt(1, 2);
    for (let i = 0; i < meetingCount; i++) {
      const project = allProjects[Math.floor(Math.random() * allProjects.length)];
      const startDate = getRandomDateInRange(-10, 40);
      const duration = getRandomInt(21, 35); // 3-5 weeks
      const endDate = addDays(startDate, duration);

      // Check for time-off conflicts
      if (hasTimeOffConflict(employee.id, startDate, endDate, existingAssignments)) {
        continue;
      }

      const hours = getRandomInt(2, 4).toString();
      const allocation = Math.round((parseInt(hours) / 8) * 100).toString();

      const assignment = {
        employeeId: employee.id,
        projectId: project.id,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        hoursPerDay: hours,
        allocationPercentage: allocation,
        isTimeOff: false,
        category: 'Meeting',
        isBillable: false,
        status: getAssignmentStatus(startDate),
        note: 'Weekly team meetings and status updates',
        createdById: employee.id,
      };

      newAssignments.push(assignment);
      stats.project++;
      stats.total++;
      stats.byCategory['Meeting'] = (stats.byCategory['Meeting'] || 0) + 1;
    }

    // 1-2 admin blocks (4-8 hours/week)
    const adminCount = getRandomInt(1, 2);
    for (let i = 0; i < adminCount; i++) {
      const startDate = getRandomDateInRange(-15, 30);
      const duration = getRandomInt(14, 21); // 2-3 weeks
      const endDate = addDays(startDate, duration);

      // Check for time-off conflicts
      if (hasTimeOffConflict(employee.id, startDate, endDate, existingAssignments)) {
        continue;
      }

      // Admin doesn't need a specific project, pick one randomly
      const project = allProjects[Math.floor(Math.random() * allProjects.length)];
      const hours = getRandomInt(4, 8).toString();
      const allocation = Math.round((parseInt(hours) / 8) * 100).toString();

      const assignment = {
        employeeId: employee.id,
        projectId: project.id,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        hoursPerDay: hours,
        allocationPercentage: allocation,
        isTimeOff: false,
        category: 'Admin',
        isBillable: false,
        status: getAssignmentStatus(startDate),
        note: 'Administrative tasks and planning',
        createdById: employee.id,
      };

      newAssignments.push(assignment);
      stats.project++;
      stats.total++;
      stats.byCategory['Admin'] = (stats.byCategory['Admin'] || 0) + 1;
    }
  }

  // Batch insert all assignments
  if (newAssignments.length > 0) {
    console.log(`   Inserting ${newAssignments.length} assignments into database...`);
    await db.insert(assignments).values(newAssignments);
  }

  return stats;
}

// ============ MAIN FUNCTION ============

async function main() {
  console.log('🌱 Starting mock assignment generation...\n');

  try {
    // Step 1: Fetch real data from database
    console.log('📋 Fetching existing data...');
    const allEmployees = await db.select().from(employees).where(eq(employees.employmentStatus, 'active'));
    const allProjects = await db.select().from(projects).where(eq(projects.status, 'active'));
    const allBrands = await db.select().from(brands);

    console.log(`   Found: ${allEmployees.length} employees, ${allProjects.length} projects, ${allBrands.length} brands\n`);

    if (allEmployees.length === 0 || allProjects.length === 0) {
      console.error('❌ No active employees or projects found. Please run the seed script first to create base data.');
      process.exit(1);
    }

    // Step 2: Clear existing assignments only
    console.log('🗑️  Clearing existing assignments...');
    await db.delete(assignments);
    console.log('   ✓ Assignments cleared\n');

    // Step 3: Update project/brand timestamps
    await updateRecentProjects();
    await updateRecentBrands();
    console.log('');

    // Step 4: Generate mock assignments
    const assignmentStats = await generateMockAssignments(allEmployees, allProjects);

    console.log('\n✅ Mock assignment generation complete!\n');
    console.log('Summary:');
    console.log(`- Total Assignments: ${assignmentStats.total}`);
    console.log(`  - Project assignments: ${assignmentStats.project}`);
    console.log(`  - Time-off: ${assignmentStats.timeOff}`);
    console.log('  - By category:');
    Object.entries(assignmentStats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`    - ${cat}: ${count}`);
      });

    process.exit(0);
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

main();
