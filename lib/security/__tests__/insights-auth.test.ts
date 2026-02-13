/**
 * Unit tests for insights authentication guard
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateInsightsAuth } from "../insights-auth";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest("http://localhost:3000/api/insights", {
    method: "POST",
    headers,
  });
  return req;
}

describe("validateInsightsAuth", () => {
  const VALID_TOKEN = "test-token-abc123";

  beforeEach(() => {
    vi.stubEnv("INSIGHTS_API_TOKEN", VALID_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null (bypass) when INSIGHTS_API_TOKEN is not set", () => {
    vi.stubEnv("INSIGHTS_API_TOKEN", "");
    delete process.env.INSIGHTS_API_TOKEN;

    const result = validateInsightsAuth(makeRequest());
    expect(result).toBeNull();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const result = validateInsightsAuth(makeRequest());
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);

    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header is malformed (no Bearer prefix)", async () => {
    const result = validateInsightsAuth(
      makeRequest({ Authorization: "Basic abc123" })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);

    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token is wrong", async () => {
    const result = validateInsightsAuth(
      makeRequest({ Authorization: "Bearer wrong-token" })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);

    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toBe("Invalid API token");
  });

  it("returns null when token is correct", () => {
    const result = validateInsightsAuth(
      makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` })
    );
    expect(result).toBeNull();
  });

  it("accepts optional analysisType parameter for logging", async () => {
    const result = validateInsightsAuth(
      makeRequest({ Authorization: "Bearer wrong" }),
      "scenario"
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
