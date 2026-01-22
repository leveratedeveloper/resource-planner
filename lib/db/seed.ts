// Seed script for populating the database with sample data
// Run with: npx tsx lib/db/seed.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  businessUnits, 
  departments, 
  brands,
  employees,
  employeeBrandAssignments, 
  projects, 
  assignments 
} from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('🌱 Starting database seed...');

  // Clear existing data (in reverse order of dependencies)
  console.log('🗑️  Clearing existing data...');
  await db.delete(assignments);
  await db.delete(employeeBrandAssignments);
  await db.delete(projects);
  await db.delete(employees);
  await db.delete(brands);
  await db.delete(departments);
  await db.delete(businessUnits);

  // 1. Create Business Units
  console.log('🏢 Creating business units...');
  const [buCorp, buApac] = await db.insert(businessUnits).values([
    {
      name: 'Corporate Headquarters',
      code: 'CORP',
      color: '#3b82f6',
      description: 'Main headquarters handling enterprise clients',
      isActive: true,
    },
    {
      name: 'APAC Regional Office',
      code: 'APAC',
      color: '#10b981',
      description: 'Asia-Pacific regional operations',
      isActive: true,
    },
  ]).returning();

  // 2. Create Departments
  console.log('🏛️  Creating departments...');
  const [deptDesign, deptEngineering, deptStrategy, deptContent] = await db.insert(departments).values([
    {
      businessUnitId: buCorp.id,
      name: 'Design',
      code: 'DES',
      color: '#ec4899',
      description: 'Visual design, UX/UI, and creative services',
      isActive: true,
    },
    {
      businessUnitId: buCorp.id,
      name: 'Engineering',
      code: 'ENG',
      color: '#3b82f6',
      description: 'Software development and technical implementation',
      isActive: true,
    },
    {
      businessUnitId: buCorp.id,
      name: 'Strategy',
      code: 'STRAT',
      color: '#8b5cf6',
      description: 'Strategic planning and project management',
      isActive: true,
    },
    {
      businessUnitId: buCorp.id,
      name: 'Content',
      code: 'CONT',
      color: '#f59e0b',
      description: 'Content creation and copywriting',
      isActive: true,
    },
  ]).returning();

  // 3. Create Brands
  console.log('🏷️  Creating brands...');
  const [brandAcme, brandTech, brandGreen] = await db.insert(brands).values([
    {
      businessUnitId: buCorp.id,
      name: 'Acme Corporation',
      clientCode: 'ACME-2024',
      color: '#ef4444',
      logo: 'https://cdn.example.com/logos/acme.png',
      website: 'https://acme.com',
      contactName: 'John Doe',
      contactTitle: 'CMO',
      contactEmail: 'john.doe@acme.com',
      contactPhone: '+1-555-0123',
      industryCategory: 'Technology',
      description: 'Leading enterprise software solutions provider',
      status: 'active',
    },
    {
      businessUnitId: buCorp.id,
      name: 'TechStart Inc',
      clientCode: 'TECH-2024',
      color: '#3b82f6',
      logo: 'https://cdn.example.com/logos/techstart.png',
      website: 'https://techstart.io',
      contactName: 'Sarah Williams',
      contactTitle: 'VP Marketing',
      contactEmail: 'sarah@techstart.io',
      contactPhone: '+1-555-0456',
      industryCategory: 'Startups',
      description: 'Innovative AI-powered SaaS startup',
      status: 'active',
    },
    {
      businessUnitId: buApac.id,
      name: 'GreenLife Organics',
      clientCode: 'GREEN-2024',
      color: '#10b981',
      logo: 'https://cdn.example.com/logos/greenlife.png',
      website: 'https://greenlifeorganics.com',
      contactName: 'Emma Thompson',
      contactTitle: 'Brand Manager',
      contactEmail: 'emma@greenlife.com',
      contactPhone: '+61-2-5555-0789',
      industryCategory: 'Consumer Goods',
      description: 'Organic food and wellness products',
      status: 'active',
    },
  ]).returning();

  // 4. Create Employees
  console.log('👥 Creating employees...');
  const [empSarah, empMichael, empEmily, empDavid, empRobert] = await db.insert(employees).values([
    {
      employeeNumber: 'EMP-2024-001',
      fullName: 'Sarah Johnson',
      nickname: 'Sarah',
      email: 'sarah.johnson@company.com',
      photo: 'https://cdn.example.com/photos/sarah.jpg',
      position: 'Senior Designer',
      departmentId: deptDesign.id,
      businessUnitId: buCorp.id,
      weeklyCapacity: 40,
      workStartDate: '2023-06-01',
      dateOfBirth: '1990-03-15',
      employmentStatus: 'active',
      visibility: 'active',
    },
    {
      employeeNumber: 'EMP-2024-002',
      fullName: 'Michael Chen',
      nickname: 'Mike',
      email: 'michael.chen@company.com',
      photo: 'https://cdn.example.com/photos/michael.jpg',
      position: 'Software Engineer',
      departmentId: deptEngineering.id,
      businessUnitId: buCorp.id,
      weeklyCapacity: 40,
      workStartDate: '2023-08-15',
      dateOfBirth: '1992-07-22',
      employmentStatus: 'active',
      visibility: 'active',
    },
    {
      employeeNumber: 'EMP-2024-003',
      fullName: 'Emily Rodriguez',
      nickname: 'Em',
      email: 'emily.rodriguez@company.com',
      photo: 'https://cdn.example.com/photos/emily.jpg',
      position: 'Project Manager',
      departmentId: deptStrategy.id,
      businessUnitId: buCorp.id,
      weeklyCapacity: 35,
      workStartDate: '2022-03-01',
      dateOfBirth: '1988-11-10',
      employmentStatus: 'active',
      visibility: 'active',
    },
    {
      employeeNumber: 'EMP-2024-004',
      fullName: 'David Kim',
      nickname: 'Dave',
      email: 'david.kim@company.com',
      photo: 'https://cdn.example.com/photos/david.jpg',
      position: 'Content Writer',
      departmentId: deptContent.id,
      businessUnitId: buCorp.id,
      weeklyCapacity: 40,
      workStartDate: '2023-11-01',
      dateOfBirth: '1995-05-20',
      employmentStatus: 'active',
      visibility: 'active',
    },
    {
      employeeNumber: 'EMP-2024-005',
      fullName: 'Robert Martinez',
      nickname: 'Rob',
      email: 'robert.martinez@company.com',
      photo: 'https://cdn.example.com/photos/robert.jpg',
      position: 'Engineering Manager',
      departmentId: deptEngineering.id,
      businessUnitId: buCorp.id,
      weeklyCapacity: 40,
      workStartDate: '2020-01-15',
      dateOfBirth: '1985-09-12',
      employmentStatus: 'active',
      visibility: 'active',
    },
  ]).returning();

  // Update supervisor relationships
  await db.update(employees).set({ directSupervisorId: empRobert.id }).where(
    // Michael reports to Robert
    (await import('drizzle-orm')).eq(employees.id, empMichael.id)
  );

  // 5. Create Employee Brand Assignments
  console.log('🔗 Creating employee-brand assignments...');
  await db.insert(employeeBrandAssignments).values([
    {
      employeeId: empSarah.id,
      brandId: brandAcme.id,
      isPrimary: true,
      startDate: '2024-01-20',
    },
    {
      employeeId: empSarah.id,
      brandId: brandGreen.id,
      isPrimary: false,
      startDate: '2024-03-01',
    },
    {
      employeeId: empMichael.id,
      brandId: brandTech.id,
      isPrimary: true,
      startDate: '2024-01-25',
    },
    {
      employeeId: empDavid.id,
      brandId: brandAcme.id,
      isPrimary: true,
      startDate: '2024-02-10',
    },
    {
      employeeId: empEmily.id,
      brandId: brandAcme.id,
      isPrimary: true,
      startDate: '2024-01-15',
    },
    {
      employeeId: empEmily.id,
      brandId: brandTech.id,
      isPrimary: false,
      startDate: '2024-02-01',
    },
  ]);

  // 6. Create Projects
  console.log('📁 Creating projects...');
  const [projBrand, projLaunch, projWebsite] = await db.insert(projects).values([
    {
      brandId: brandAcme.id,
      businessUnitId: buCorp.id,
      name: 'Q2 Brand Campaign',
      projectNumber: 'ACME-2024-Q2-001',
      description: 'Comprehensive brand awareness campaign for Q2 product launch',
      color: '#8b5cf6',
      budget: '150000.00',
      currency: 'USD',
      startDate: '2024-04-01',
      endDate: '2024-06-30',
      status: 'active',
      createdById: empEmily.id,
      notes: 'High priority client project. Weekly status meetings required.',
    },
    {
      brandId: brandTech.id,
      businessUnitId: buCorp.id,
      name: 'Product Launch Event',
      projectNumber: 'TECH-2024-LAUNCH-001',
      description: 'Virtual and in-person product launch event with live streaming',
      color: '#ec4899',
      budget: '75000.00',
      currency: 'USD',
      startDate: '2024-04-15',
      endDate: '2024-05-31',
      status: 'active',
      createdById: empEmily.id,
      notes: 'Event scheduled for May 25, 2024',
    },
    {
      brandId: brandGreen.id,
      businessUnitId: buApac.id,
      name: 'Website Redesign',
      projectNumber: 'GREEN-2024-WEB-001',
      description: 'Complete website overhaul with e-commerce integration',
      color: '#14b8a6',
      budget: '95000.00',
      currency: 'AUD',
      startDate: '2024-03-15',
      endDate: '2024-07-31',
      status: 'active',
      createdById: empEmily.id,
      notes: 'Phase 1: Discovery (March-April), Phase 2: Design (May), Phase 3: Development (June-July)',
    },
  ]).returning();

  // 7. Create Assignments
  console.log('📅 Creating assignments...');
  
  // Helper for date calculation
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  await db.insert(assignments).values([
    // Sarah on Q2 Brand Campaign
    {
      employeeId: empSarah.id,
      projectId: projBrand.id,
      startDate: formatDate(addDays(today, 0)),
      endDate: formatDate(addDays(today, 14)),
      hoursPerDay: '6',
      allocationPercentage: '75',
      isTimeOff: false,
      category: 'Design',
      isBillable: true,
      status: 'confirmed',
      note: 'Lead designer for campaign visuals',
      createdById: empEmily.id,
    },
    // Michael on Product Launch Event
    {
      employeeId: empMichael.id,
      projectId: projLaunch.id,
      startDate: formatDate(addDays(today, 2)),
      endDate: formatDate(addDays(today, 21)),
      hoursPerDay: '4',
      allocationPercentage: '50',
      isTimeOff: false,
      category: 'Development',
      isBillable: true,
      status: 'confirmed',
      note: 'Event website development - backend and frontend',
      createdById: empEmily.id,
    },
    // Sarah time-off
    {
      employeeId: empSarah.id,
      projectId: null,
      startDate: formatDate(addDays(today, 20)),
      endDate: formatDate(addDays(today, 24)),
      hoursPerDay: '8',
      allocationPercentage: '100',
      isTimeOff: true,
      category: null,
      isBillable: false,
      status: 'confirmed',
      note: 'Annual leave',
      createdById: empEmily.id,
    },
    // Emily on Q2 Brand Campaign (Project Management)
    {
      employeeId: empEmily.id,
      projectId: projBrand.id,
      startDate: formatDate(addDays(today, 0)),
      endDate: formatDate(addDays(today, 60)),
      hoursPerDay: '2',
      allocationPercentage: '28.6',
      isTimeOff: false,
      category: 'Project Management',
      isBillable: false,
      status: 'confirmed',
      note: 'Project oversight and coordination',
      createdById: empEmily.id,
    },
    // David on Q2 Brand Campaign (Content)
    {
      employeeId: empDavid.id,
      projectId: projBrand.id,
      startDate: formatDate(addDays(today, 7)),
      endDate: formatDate(addDays(today, 28)),
      hoursPerDay: '5',
      allocationPercentage: '62.5',
      isTimeOff: false,
      category: 'Content',
      isBillable: true,
      status: 'confirmed',
      note: 'Campaign copywriting and content development',
      createdById: empEmily.id,
    },
    // Sarah on Website Redesign
    {
      employeeId: empSarah.id,
      projectId: projWebsite.id,
      startDate: formatDate(addDays(today, 30)),
      endDate: formatDate(addDays(today, 45)),
      hoursPerDay: '4',
      allocationPercentage: '50',
      isTimeOff: false,
      category: 'Design',
      isBillable: true,
      status: 'confirmed',
      note: 'UX/UI design for new website',
      createdById: empEmily.id,
    },
  ]);

  console.log('✅ Database seeded successfully!');
  console.log(`
Summary:
- Business Units: 2
- Departments: 4
- Brands: 3
- Employees: 5
- Employee-Brand Assignments: 6
- Projects: 3
- Assignments: 6
  `);

  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
