import { db } from "../lib/db/index";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("Starting campaign wizard migration...");

  try {
    // 1. Add entity column to projects table
    console.log("Adding entity column to projects table...");
    await db.execute(sql`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS entity TEXT
    `);
    console.log("✓ Entity column added to projects table");

    // 2. Add logo column to business_units table
    console.log("Adding logo column to business_units table...");
    await db.execute(sql`
      ALTER TABLE business_units
      ADD COLUMN IF NOT EXISTS logo TEXT
    `);
    console.log("✓ Logo column added to business_units table");

    // 3. Update business units with logo URLs
    console.log("Updating business units with logo URLs...");

    const businessUnitLogos = [
      { name: 'Leverate Group', logo: 'https://timetrack.id/assets/images/leverate_logo_black.png' },
      { name: 'Scaling', logo: 'https://timetrack.id/assets/images/scaling_logo_black_new.png' },
      { name: 'B-Univate', logo: 'https://timetrack.id/assets/images/b-univate_logo_black.png' },
      { name: 'E-maginate', logo: 'https://timetrack.id/assets/images/emaginate_logo.png' },
      { name: 'Elevassion', logo: 'https://timetrack.id/assets/images/elevassion_logo.png' },
      { name: 'Nouva', logo: 'https://timetrack.id/assets/images/nouva_logo.png' },
      { name: 'Augensee', logo: 'https://timetrack.id/assets/images/augensee_logo.png' },
    ];

    for (const bu of businessUnitLogos) {
      await db.execute(sql`
        UPDATE business_units
        SET logo = ${bu.logo}
        WHERE name = ${bu.name}
      `);
      console.log(`  ✓ Updated ${bu.name} with logo`);
    }

    console.log("\n✅ Campaign wizard migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log("Migration script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
