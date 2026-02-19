import { describe, it, expect, beforeEach } from "vitest";
import {
  checkInsightsRateLimit,
  resetRateLimiter,
} from "@/lib/security/insights-rate-limit";

describe("checkInsightsRateLimit", () => {
  beforeEach(() => {
    resetRateLimiter({ windowMs: 60_000, defaultMax: 3, scenarioMax: 2 });
  });

  it("allows the first request", () => {
    const result = checkInsightsRateLimit("client-1", "recommendations");
    expect(result.limited).toBe(false);
  });

  it("allows requests within the limit", () => {
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    const third = checkInsightsRateLimit("client-1", "recommendations");
    expect(third.limited).toBe(false);
  });

  it("blocks requests exceeding the default max", () => {
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    const fourth = checkInsightsRateLimit("client-1", "recommendations");
    expect(fourth.limited).toBe(true);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("uses stricter limit for scenario type", () => {
    checkInsightsRateLimit("client-1", "scenario");
    checkInsightsRateLimit("client-1", "scenario");
    const third = checkInsightsRateLimit("client-1", "scenario");
    expect(third.limited).toBe(true);
  });

  it("tracks clients independently", () => {
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");

    // client-2 should still be allowed
    const result = checkInsightsRateLimit("client-2", "recommendations");
    expect(result.limited).toBe(false);
  });

  it("tracks analysis types independently per client", () => {
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");

    // Same client, different type — should be allowed
    const result = checkInsightsRateLimit("client-1", "conflicts");
    expect(result.limited).toBe(false);
  });

  it("resetRateLimiter clears all state", () => {
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations");
    checkInsightsRateLimit("client-1", "recommendations"); // blocked

    resetRateLimiter({ windowMs: 60_000, defaultMax: 3, scenarioMax: 2 });

    const result = checkInsightsRateLimit("client-1", "recommendations");
    expect(result.limited).toBe(false);
  });
});
