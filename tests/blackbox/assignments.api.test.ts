import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("Blackbox: /api/assignments", () => {
  describe("GET /api/assignments", () => {
    it("returns { success: true, data: [...] } shape", async () => {
      const res = await fetch(`${BASE_URL}/api/assignments`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("accepts employeeId filter parameter", async () => {
      // Filtering by a non-matching ID should still return a valid response
      const res = await fetch(`${BASE_URL}/api/assignments?employeeId=00000000-0000-0000-0000-000000000000`);
      const body = await res.json();
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("data");
    });

    it("accepts projectId filter parameter", async () => {
      const res = await fetch(`${BASE_URL}/api/assignments?projectId=00000000-0000-0000-0000-000000000000`);
      const body = await res.json();
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("data");
    });
  });

  describe("POST /api/assignments", () => {
    it("returns 400 when employeeId is missing", async () => {
      const res = await fetch(`${BASE_URL}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-02-18",
          endDate: "2026-02-20",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body).toHaveProperty("error");
    });

    it("returns 400 when startDate is missing", async () => {
      const res = await fetch(`${BASE_URL}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-test",
          endDate: "2026-02-20",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it("returns 400 when endDate is missing", async () => {
      const res = await fetch(`${BASE_URL}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp-test",
          startDate: "2026-02-18",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });
});
