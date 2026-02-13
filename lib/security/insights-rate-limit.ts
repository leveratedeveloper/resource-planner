/**
 * In-Memory Type-Aware Rate Limiter for Insights API
 *
 * Tracks request counts per (clientKey + analysisType) within a sliding window.
 * Scenario requests get a stricter cap than recommendations/conflicts.
 *
 * Defaults:
 *   windowMs     = 60_000 (1 minute)
 *   defaultMax   = 20     (recommendations, conflicts)
 *   scenarioMax  = 5      (scenario — more expensive)
 */

export interface RateLimitConfig {
  windowMs: number;
  defaultMax: number;
  scenarioMax: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  defaultMax: 20,
  scenarioMax: 5,
};

// In-memory store — keyed by "clientKey:analysisType"
const store = new Map<string, WindowEntry>();

let activeConfig: RateLimitConfig = { ...DEFAULT_CONFIG };

/**
 * Check whether a request should be rate-limited.
 *
 * @param clientKey  - typically the client IP address
 * @param analysisType - "recommendations" | "conflicts" | "scenario"
 * @returns `{ limited: false }` or `{ limited: true, retryAfterMs }`
 */
export function checkInsightsRateLimit(
  clientKey: string,
  analysisType: string
): { limited: boolean; retryAfterMs: number } {
  const key = `${clientKey}:${analysisType}`;
  const now = Date.now();
  const maxRequests =
    analysisType === "scenario"
      ? activeConfig.scenarioMax
      : activeConfig.defaultMax;

  const entry = store.get(key);

  // First request or window expired → start fresh window
  if (!entry || now - entry.windowStart >= activeConfig.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { limited: false, retryAfterMs: 0 };
  }

  // Within window — increment
  entry.count += 1;

  if (entry.count > maxRequests) {
    const retryAfterMs = activeConfig.windowMs - (now - entry.windowStart);
    console.warn(
      `[insights-rate-limit] Blocked: ${key} | count=${entry.count}/${maxRequests} | retryAfterMs=${retryAfterMs}`
    );
    return { limited: true, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  return { limited: false, retryAfterMs: 0 };
}

/**
 * Reset the rate limiter store and config. Used in tests.
 */
export function resetRateLimiter(config?: Partial<RateLimitConfig>): void {
  store.clear();
  activeConfig = { ...DEFAULT_CONFIG, ...config };
}
