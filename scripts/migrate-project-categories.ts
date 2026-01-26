// Migration script for project_categories table
// Run with: npx tsx scripts/migrate-project-categories.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function migrate() {
  console.log('🚀 Applying project_categories migration...');
  
  try {
    // Create project_categories table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        name text NOT NULL,
        description text,
        display_order integer DEFAULT 0 NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL,
        CONSTRAINT project_categories_name_unique UNIQUE(name)
      )
    `);
    console.log('✅ Created project_categories table');
    
    // Add column to projects table
    await db.execute(sql`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_category_id uuid
    `);
    console.log('✅ Added project_category_id column to projects');
    
    // Add foreign key constraint
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'projects_project_category_id_project_categories_id_fk'
        ) THEN
          ALTER TABLE projects ADD CONSTRAINT projects_project_category_id_project_categories_id_fk 
          FOREIGN KEY (project_category_id) REFERENCES project_categories(id) 
          ON DELETE no action ON UPDATE no action;
        END IF;
      END $$
    `);
    console.log('✅ Added foreign key constraint');
    
    // Seed project categories
    await db.execute(sql`
      INSERT INTO project_categories (name, description, display_order, is_active)
      VALUES 
        ('Pitch', 'New business pitches and proposals', 1, true),
        ('Campaign', 'Active client campaigns', 2, true),
        ('Operational', 'Internal operational projects', 3, true),
        ('R & D', 'Research and development initiatives', 4, true),
        ('Initiative Campaign', 'Special initiative campaigns', 5, true)
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Seeded project categories');
    
    console.log('🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
