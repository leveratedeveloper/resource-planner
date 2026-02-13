#!/usr/bin/env node

const required = ["E2E_PROJECT_ID", "DATABASE_URL"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Fixture integrity check failed. Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.E2E_PROJECT_ID?.trim()) {
  console.error("Fixture integrity check failed. E2E_PROJECT_ID is empty.");
  process.exit(1);
}

if (process.env.PW_NIGHTLY === "1" && !process.env.OPENAI_API_KEY) {
  console.error("Fixture integrity check failed. OPENAI_API_KEY is required when PW_NIGHTLY=1.");
  process.exit(1);
}

console.log("Fixture integrity check passed.");
