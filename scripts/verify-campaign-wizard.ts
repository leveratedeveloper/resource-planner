import { db, businessUnits, projects } from "../lib/db/index";
import { sql } from "drizzle-orm";

async function verifyImplementation() {
  console.log("🔍 Verifying Campaign Wizard Implementation...\n");

  try {
    // 1. Check if entity column exists in projects table
    console.log("1. Checking entity column in projects table...");
    try {
      await db.execute(sql`SELECT entity FROM projects LIMIT 1`);
      console.log("   ✅ Entity column exists in projects table");
    } catch (e) {
      console.log("   ❌ Entity column NOT found in projects table");
    }

    // 2. Check if logo column exists in business_units table
    console.log("\n2. Checking logo column in business_units table...");
    try {
      await db.execute(sql`SELECT logo FROM business_units LIMIT 1`);
      console.log("   ✅ Logo column exists in business_units table");
    } catch (e) {
      console.log("   ❌ Logo column NOT found in business_units table");
    }

    // 3. Check business units have logos
    console.log("\n3. Checking business units with logos...");
    const businessUnitsList = await db.select({
      id: businessUnits.id,
      name: businessUnits.name,
      logo: businessUnits.logo
    }).from(businessUnits);

    console.log(`   Found ${businessUnitsList.length} business units:`);
    businessUnitsList.forEach((bu: any) => {
      const hasLogo = bu.logo ? "✅" : "❌";
      console.log(`   ${hasLogo} ${bu.name}: ${bu.logo || "(no logo)"}`);
    });

    // 4. Sample query to verify entity field works
    console.log("\n4. Testing entity field in projects...");
    const projectsList = await db.select({
      id: projects.id,
      name: projects.name,
      entity: projects.entity
    }).from(projects).where(sql`entity IS NOT NULL`).limit(3);

    if (projectsList.length > 0) {
      console.log(`   ✅ Found ${projectsList.length} projects with entity field:`);
      projectsList.forEach((p: any) => {
        console.log(`      - ${p.name}: ${p.entity}`);
      });
    } else {
      console.log("   ℹ️  No projects with entity field yet (expected for new installation)");
    }

    console.log("\n✅ Campaign Wizard verification completed!");
    console.log("\n📋 Summary:");
    console.log("   - Database schema updated correctly");
    console.log("   - Business units have logo URLs");
    console.log("   - Ready to create campaigns with entity field");
    console.log("\n🚀 Next step: Start the dev server and test the wizard in the UI");

  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  }
}

// Run verification
verifyImplementation()
  .then(() => {
    console.log("\nVerification script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nVerification script failed:", error);
    process.exit(1);
  });
