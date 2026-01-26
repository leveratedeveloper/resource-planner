import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function applyPitchCampaignMigration() {
  console.log('Starting pitch/campaign migration...');

  try {
    // Step 1: Create project_type enum
    console.log('Creating project_type enum...');
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE project_type AS ENUM ('pitch', 'campaign');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 2: Create pitch_status enum
    console.log('Creating pitch_status enum...');
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE pitch_status AS ENUM (
          'introduction',
          'waiting_for_brief',
          'proposal_development',
          'submit_or_presentation',
          'waiting_for_feedback',
          'negotiation',
          'won',
          'lost',
          'cancelled',
          'missing',
          'withdraw'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 3: Create channel_classifications table
    console.log('Creating channel_classifications table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS channel_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_name TEXT NOT NULL,
        channel_name_new TEXT,
        flag TEXT NOT NULL DEFAULT 'active',
        display_order INTEGER,
        pillars_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Step 4: Create deliverables table
    console.log('Creating deliverables table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deliverables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID REFERENCES channel_classifications(id),
        deliverable_name TEXT NOT NULL,
        deliverable_name_new TEXT,
        flag TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Step 5: Add project_type column to projects table
    console.log('Adding project_type column to projects table...');
    await db.execute(sql`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS project_type project_type NOT NULL DEFAULT 'campaign';
    `);

    // Step 6: Add pitch-specific columns to projects table
    console.log('Adding pitch-specific columns to projects table...');
    await db.execute(sql`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'Indonesia',
      ADD COLUMN IF NOT EXISTS submit_date DATE,
      ADD COLUMN IF NOT EXISTS pitch_status pitch_status,
      ADD COLUMN IF NOT EXISTS value_total_estimate DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS hs_deal_id TEXT;
    `);

    // Step 7: Create project_channels table
    console.log('Creating project_channels table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        channel_id UUID NOT NULL REFERENCES channel_classifications(id),
        deliverable_id UUID REFERENCES deliverables(id),
        quantity TEXT,
        channel_budget DECIMAL(15, 2),
        man_hours TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
applyPitchCampaignMigration()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
