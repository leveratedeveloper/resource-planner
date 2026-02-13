import { expect, test } from "../support/testFixtures";
import { getInsightsHeaders } from "../support/env";

test.describe("Insights live API", () => {
  test("@nightly @ai-live recommendations path responds with live OpenAI", async ({ request, env }) => {
    test.skip(!env.openAiApiKey, "OPENAI_API_KEY is required for live AI tests.");

    const response = await request.post("/api/insights", {
      headers: getInsightsHeaders(env),
      data: {
        analysisType: "recommendations",
        capacityAnalysis: [
          {
            resourceId: "r-live-1",
            resourceName: "Live Test Resource",
            department: "Engineering",
            role: "Engineer",
            weeklyCapacity: 40,
            dailyUtilization: [],
            averageUtilization: 120,
            peakUtilization: 140,
            overallocatedDays: 3,
            underutilizedDays: 0,
            billablePercent: 85,
            status: "overallocated",
          },
        ],
        conflicts: [],
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });

  test("@nightly @ai-live conflicts path responds with live OpenAI", async ({ request, env }) => {
    test.skip(!env.openAiApiKey, "OPENAI_API_KEY is required for live AI tests.");

    const response = await request.post("/api/insights", {
      headers: getInsightsHeaders(env),
      data: {
        analysisType: "conflicts",
        capacityAnalysis: [
          {
            resourceId: "r-live-2",
            resourceName: "Live Test Resource 2",
            department: "Operations",
            role: "Planner",
            weeklyCapacity: 40,
            dailyUtilization: [],
            averageUtilization: 95,
            peakUtilization: 130,
            overallocatedDays: 2,
            underutilizedDays: 0,
            billablePercent: 70,
            status: "overallocated",
          },
        ],
        conflicts: [
          {
            id: "c-live-1",
            type: "overallocation",
            severity: "warning",
            resourceId: "r-live-2",
            resourceName: "Live Test Resource 2",
            date: "2026-01-10",
            description: "Overallocated in live test.",
            affectedAssignments: ["a1", "a2"],
          },
        ],
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("resolutions");
  });

  test("@nightly @ai-live scenario path responds with live OpenAI", async ({ request, env }) => {
    test.skip(!env.openAiApiKey, "OPENAI_API_KEY is required for live AI tests.");

    const response = await request.post("/api/insights", {
      headers: getInsightsHeaders(env),
      data: {
        analysisType: "scenario",
        analysisInput: {
          resources: [
            {
              id: "r-live-3",
              name: "Live Scenario Resource",
              role: "Designer",
              department: "Creative",
              capacity: 40,
            },
          ],
          assignments: [
            {
              id: "a-live-1",
              resourceId: "r-live-3",
              projectId: "p-live-1",
              startDate: "2026-01-10",
              endDate: "2026-01-12",
              hoursPerDay: 9,
              isTimeOff: false,
              category: "Design",
              isBillable: true,
              note: null,
            },
          ],
          projects: [
            {
              id: "p-live-1",
              name: "Live Project",
              brandId: "b-live-1",
              color: "#3b82f6",
              resourceIds: ["r-live-3"],
            },
          ],
          brands: [
            {
              id: "b-live-1",
              name: "Live Brand",
              color: "#3b82f6",
              resourceIds: ["r-live-3"],
            },
          ],
          dateRange: {
            start: "2026-01-01",
            end: "2026-01-31",
          },
        },
        scenarioChanges: [
          {
            type: "reschedule",
            assignmentId: "a-live-1",
            changes: {
              startDate: "2026-01-14",
              endDate: "2026-01-16",
            },
          },
        ],
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });
});
