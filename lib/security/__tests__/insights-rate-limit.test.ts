/**
 * Unit tests for insights rate limiter
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkInsightsRateLimit,
  resetRateLimiter,
} from "../insights-rate-limit";

describe("checkInsightsRateLimit", () => {
  beforeEach(() => {
    resetRateLimiter({ windowMs: 60_000, defaultMax: 3, scenarioMax: 2 });
  });

  it("allows requests below the default limit", () => {
    const r1 = checkInsightsRateLimit("ip1", "recommendations");
    const r2 = checkInsightsRateLimit("ip1", "recommendations");
    const r3 = checkInsightsRateLimit("ip1", "recommendations");

    expect(r1.limited).toBe(false);
    expect(r2.limited).toBe(false);
    expect(r3.limited).toBe(false);
  });

  it("blocks requests exceeding the default limit", () => {
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    const r4 = checkInsightsRateLimit("ip1", "recommendations");

    expect(r4.limited).toBe(true);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it("blocks scenario requests at the stricter scenarioMax", () => {
    checkInsightsRateLimit("ip1", "scenario");
    checkInsightsRateLimit("ip1", "scenario");
    const r3 = checkInsightsRateLimit("ip1", "scenario");

    expect(r3.limited).toBe(true);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate counters per analysisType", () => {
    // Use up recommendations limit
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    const recBlocked = checkInsightsRateLimit("ip1", "recommendations");

    // scenario should still be allowed (separate counter)
    const scenarioOk = checkInsightsRateLimit("ip1", "scenario");

    expect(recBlocked.limited).toBe(true);
    expect(scenarioOk.limited).toBe(false);
  });

  it("tracks separate counters per client key", () => {
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    const blocked = checkInsightsRateLimit("ip1", "recommendations");

    // Different client should not be affected
    const otherOk = checkInsightsRateLimit("ip2", "recommendations");

    expect(blocked.limited).toBe(true);
    expect(otherOk.limited).toBe(false);
  });

  it("resets counter after the window expires", () => {
    vi.useFakeTimers();

    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    checkInsightsRateLimit("ip1", "recommendations");
    const blocked = checkInsightsRateLimit("ip1", "recommendations");
    expect(blocked.limited).toBe(true);

    // Advance past window
    vi.advanceTimersByTime(61_000);

    const afterReset = checkInsightsRateLimit("ip1", "recommendations");
    expect(afterReset.limited).toBe(false);

    vi.useRealTimers();
  });
});
