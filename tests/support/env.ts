import { z } from "zod";
import type { TestEnv } from "./types";

const envSchema = z.object({
  E2E_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  E2E_PROJECT_ID: z.string().min(1, "E2E_PROJECT_ID is required"),
  DATABASE_URL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  INSIGHTS_API_TOKEN: z.string().min(1).optional(),
});

let cachedEnv: TestEnv | null = null;

export function loadTestEnv(): TestEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid test environment: ${message}`);
  }

  cachedEnv = {
    baseURL: parsed.data.E2E_BASE_URL,
    e2eProjectId: parsed.data.E2E_PROJECT_ID,
    databaseUrl: parsed.data.DATABASE_URL,
    openAiApiKey: parsed.data.OPENAI_API_KEY,
    insightsApiToken: parsed.data.INSIGHTS_API_TOKEN,
  };

  return cachedEnv;
}

export function getInsightsHeaders(env: TestEnv): Record<string, string> {
  if (!env.insightsApiToken) {
    return { "Content-Type": "application/json" };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.insightsApiToken}`,
  };
}
