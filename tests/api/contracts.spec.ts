import { expect, test } from "../support/testFixtures";
import { getInsightsHeaders } from "../support/env";

const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000";

test.describe("API contracts", () => {
  const listEndpoints = [
    "/api/assignments",
    "/api/brands",
    "/api/business-units",
    "/api/channel-classifications",
    "/api/deliverables",
    "/api/departments",
    "/api/employees",
    "/api/project-categories",
    "/api/projects",
  ];

  for (const endpoint of listEndpoints) {
    test(`@smoke @api ${endpoint} returns success envelope`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.ok()).toBeTruthy();
      const body = (await response.json()) as {
        success: boolean;
        data: unknown;
      };

      expect(body.success).toBeTruthy();
      expect(Array.isArray(body.data)).toBeTruthy();
    });
  }

  const idEndpoints = [
    "/api/assignments",
    "/api/brands",
    "/api/business-units",
    "/api/departments",
    "/api/employees",
    "/api/project-categories",
    "/api/projects",
  ];

  for (const endpoint of idEndpoints) {
    test(`@smoke @api ${endpoint}/:id returns 404 for unknown id`, async ({ request }) => {
      const response = await request.get(`${endpoint}/${UNKNOWN_UUID}`);
      expect(response.status()).toBe(404);
      const body = (await response.json()) as { success?: boolean; error?: string };
      expect(body.success).toBeFalsy();
      expect(body.error).toBeTruthy();
    });
  }

  test("@smoke @api pagination endpoints reject invalid numbers", async ({ request }) => {
    const endpoints = [
      "/api/brands?limit=abc&offset=0",
      "/api/projects?limit=abc&offset=0",
      "/api/employees?limit=abc&offset=0",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    }
  });

  test("@smoke @api assignments POST validates required fields", async ({ request }) => {
    const response = await request.post("/api/assignments", {
      data: {
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBeFalsy();
    expect(body.error).toContain("employeeId");
  });

  test("@smoke @api assignments PUT validates required fields", async ({ request }) => {
    const response = await request.put(`/api/assignments/${UNKNOWN_UUID}`, {
      data: {
        projectId: null,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBeFalsy();
    expect(body.error).toContain("employeeId");
  });

  test("@smoke @api insights endpoint validates missing required fields", async ({ request, env }) => {
    const response = await request.post("/api/insights", {
      headers: getInsightsHeaders(env),
      data: {
        analysisType: "recommendations",
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  test("@smoke @api insights endpoint rejects unknown analysisType", async ({ request, env }) => {
    const response = await request.post("/api/insights", {
      headers: getInsightsHeaders(env),
      data: {
        analysisType: "unsupported-mode",
        capacityAnalysis: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  test("@api insights returns 500 when OPENAI_API_KEY is absent for valid payload", async ({
    request,
    env,
  }) => {
    test.skip(!!env.openAiApiKey, "This negative-path test only applies when OPENAI_API_KEY is not configured.");

    const response = await request.post("/api/insights", {
      headers: getInsightsHeaders(env),
      data: {
        analysisType: "recommendations",
        capacityAnalysis: [],
        conflicts: [],
      },
    });

    expect(response.status()).toBe(500);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });
});
