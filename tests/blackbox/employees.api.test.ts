import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("Blackbox: GET /api/employees", () => {
  it("returns { success: true, data: [...] } shape", async () => {
    const res = await fetch(`${BASE_URL}/api/employees`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns employee objects with expected fields", async () => {
    const res = await fetch(`${BASE_URL}/api/employees`);
    const body = await res.json();
    if (body.data.length > 0) {
      const employee = body.data[0];
      expect(employee).toHaveProperty("id");
      expect(employee).toHaveProperty("fullName");
    }
  });
});
