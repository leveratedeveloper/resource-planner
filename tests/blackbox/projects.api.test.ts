import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("Blackbox: GET /api/projects", () => {
  it("returns { success: true, data: [...] } shape", async () => {
    const res = await fetch(`${BASE_URL}/api/projects`);
    if (res.status === 401) {
      expect(res.status).toBe(401);
      return;
    }

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns project objects with expected fields", async () => {
    const res = await fetch(`${BASE_URL}/api/projects`);
    if (res.status === 401) {
      expect(res.status).toBe(401);
      return;
    }

    const body = await res.json();
    if (body.data.length > 0) {
      const project = body.data[0];
      expect(project).toHaveProperty("id");
      expect(project).toHaveProperty("name");
      expect(project).toHaveProperty("brandId");
    }
  });

  it("supports compact summaries through the summary endpoint", async () => {
    const res = await fetch(`${BASE_URL}/api/projects/summary`);
    if (res.status === 401) {
      expect(res.status).toBe(401);
      return;
    }

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      const project = body.data[0];
      expect(project).toHaveProperty("id");
      expect(project).toHaveProperty("name");
      expect(project).toHaveProperty("brandId");
      expect(project).toHaveProperty("projectType");
      expect(project).not.toHaveProperty("channels");
      expect(project).not.toHaveProperty("projectChannels");
    }
  });
});
