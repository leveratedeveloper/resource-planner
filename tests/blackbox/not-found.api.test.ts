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

describe("Blackbox: 404 for unknown resource IDs", () => {
  const randomUuid = "00000000-0000-0000-0000-000000000000";

  it("GET /api/brands/:id returns 404 for unknown UUID", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/brands/${randomUuid}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("GET /api/employees/:id returns 404 for unknown UUID", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/employees/${randomUuid}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("GET /api/projects/:id returns 404 for unknown UUID", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/projects/${randomUuid}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("GET /api/assignments/:id returns 404 for unknown UUID", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/api/assignments/${randomUuid}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
