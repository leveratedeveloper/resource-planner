import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkDatabase() {
  try {
    console.log('🔍 Checking database tables...');
    
    // Check if tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:');
    tables.forEach((row: any) => {
      console.log('  -', row.table_name);
    });
    
    // Check record counts
    console.log('\n📊 Record counts:');
    try {
      const counts = await Promise.all([
        db.execute(sql`SELECT COUNT(*) FROM business_units`).catch(() => [{ count: 'N/A' }]),
        db.execute(sql`SELECT COUNT(*) FROM departments`).catch(() => [{ count: 'N/A' }]),
        db.execute(sql`SELECT COUNT(*) FROM brands`).catch(() => [{ count: 'N/A' }]),
        db.execute(sql`SELECT COUNT(*) FROM employees`).catch(() => [{ count: 'N/A' }]),
        db.execute(sql`SELECT COUNT(*) FROM employee_brand_assignments`).catch(() => [{ count: 'N/A' }]),
        db.execute(sql`SELECT COUNT(*) FROM projects`).catch(() => [{ count: 'N/A' }]),
        db.execute(sql`SELECT COUNT(*) FROM assignments`).catch(() => [{ count: 'N/A' }]),
      ]);
      
      console.log('  - business_units:', counts[0][0].count);
      console.log('  - departments:', counts[1][0].count);
      console.log('  - brands:', counts[2][0].count);
      console.log('  - employees:', counts[3][0].count);
      console.log('  - employee_brand_assignments:', counts[4][0].count);
      console.log('  - projects:', counts[5][0].count);
      console.log('  - assignments:', counts[6][0].count);
    } catch (error: any) {
      console.error('⚠️  Could not get record counts:', error.message);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
