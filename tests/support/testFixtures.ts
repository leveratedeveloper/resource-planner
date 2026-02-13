import { request as playwrightRequest, test as base, expect } from "@playwright/test";
import { CleanupRegistry } from "./cleanupRegistry";
import { loadTestEnv } from "./env";
import { TestDataManager } from "./testDataManager";
import type { TestEnv } from "./types";

const workerCleanupRegistries = new Set<CleanupRegistry>();

type Fixtures = {
  env: TestEnv;
  cleanup: CleanupRegistry;
  dataManager: TestDataManager;
  workerCleanupGuard: void;
};

export const test = base.extend<Fixtures>({
  env: [
    async ({}, applyFixture) => {
      await applyFixture(loadTestEnv());
    },
    { scope: "worker" },
  ],

  workerCleanupGuard: [
    async ({ env }, applyFixture) => {
      await applyFixture();

      const workerRequest = await playwrightRequest.newContext({ baseURL: env.baseURL });
      try {
        for (const registry of workerCleanupRegistries) {
          if (registry.hasPendingEntities()) {
            await registry.cleanupAll(workerRequest);
          }
        }
      } finally {
        await workerRequest.dispose();
      }

      const failedRegistries = [...workerCleanupRegistries].filter((registry) => registry.hasFailures());
      workerCleanupRegistries.clear();

      if (failedRegistries.length > 0) {
        const details = failedRegistries
          .map((registry, index) => `Registry ${index + 1}\n${registry.getFailureDetails()}`)
          .join("\n\n");
        throw new Error(`Worker fail-safe cleanup failed:\n${details}`);
      }
    },
    { scope: "worker", auto: true },
  ],

  cleanup: async ({ request }, applyFixture) => {
    const registry = new CleanupRegistry();
    workerCleanupRegistries.add(registry);

    await applyFixture(registry);

    await registry.cleanupAll(request);
    registry.assertNoFailures();
  },

  dataManager: async ({ request, env, cleanup }, applyFixture, testInfo) => {
    const runId = process.env.GITHUB_RUN_ID || "local";
    const testToken = `${testInfo.parallelIndex}_${Date.now()}`;
    const namespace = `E2E_${runId}_${testToken}`;

    const manager = new TestDataManager(request, env, cleanup, namespace);

    await applyFixture(manager);
  },
});

export { expect };
