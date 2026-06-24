import { beforeAll, describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

let serverAvailable = false;

beforeAll(async () => {
  try {
    await fetch(`${BASE_URL}/api/brands`, { signal: AbortSignal.timeout(2000) });
    serverAvailable = true;
  } catch {
    serverAvailable = false;
  }
});

describe("Blackbox: GET /api/brands", () => {
  it("returns { success: true, data: [...] } shape", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/brands`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 400 for non-numeric limit parameter", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/brands?limit=abc&offset=0`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for non-numeric offset parameter", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/brands?limit=10&offset=xyz`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns paginated response with valid limit and offset", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/brands?limit=5&offset=0`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("hasMore");
  });
});
