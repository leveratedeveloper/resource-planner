import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db';
import { brands, resources, projects, assignments } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function testConnection() {
  console.log('🔗 Testing Supabase connection...\n');

  try {
    // Test 1: Check if we can connect and list tables
    console.log('📖 Checking database tables...');
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('✅ Tables in database:', tablesResult);

    // Test 2: Try SELECT on brands (should work even if empty)
    console.log('\n📖 Fetching brands...');
    const allBrands = await db.select().from(brands);
    console.log('✅ Brands found:', allBrands.length);

    // Test 3: Try INSERT
    console.log('\n📝 Creating test brand...');
    const [testBrand] = await db.insert(brands).values({
      name: 'Test Brand ' + Date.now(),
      color: '#3b82f6',
    }).returning();
    console.log('✅ Created brand:', testBrand);

    // Test 4: Verify INSERT worked
    console.log('\n📖 Fetching brands after insert...');
    const brandsAfter = await db.select().from(brands);
    console.log('✅ Brands now:', brandsAfter.length);

    console.log('\n🎉 All tests passed! Database connection is working!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

testConnection();
