import { loadTestEnv } from "./env";

async function globalSetup() {
  const env = loadTestEnv();

  if (process.env.CI && !env.databaseUrl) {
    throw new Error("DATABASE_URL is required in CI for automation tests.");
  }

  const nightlyMode = process.env.PW_NIGHTLY === "1";
  if (nightlyMode && !env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for nightly live AI tests.");
  }
}

export default globalSetup;
