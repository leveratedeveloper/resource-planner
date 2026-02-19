import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("Blackbox: POST /api/insights", () => {
  it("returns 400 for empty body", async () => {
    const res = await fetch(`${BASE_URL}/api/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for unknown analysisType", async () => {
    const res = await fetch(`${BASE_URL}/api/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisType: "nonexistent_type",
        capacityAnalysis: [],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for recommendations without capacityAnalysis", async () => {
    const res = await fetch(`${BASE_URL}/api/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisType: "recommendations",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for scenario with empty scenarioChanges", async () => {
    const res = await fetch(`${BASE_URL}/api/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisType: "scenario",
        analysisInput: {
          resources: [],
          assignments: [],
          projects: [],
          brands: [],
          dateRange: { start: "2026-02-01", end: "2026-02-28" },
        },
        scenarioChanges: [],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
