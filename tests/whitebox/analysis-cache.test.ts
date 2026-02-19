import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalysisCache } from "@/lib/analysis/analysis-cache";

describe("AnalysisCache", () => {
  let cache: AnalysisCache<string>;

  beforeEach(() => {
    cache = new AnalysisCache<string>(3, 1); // maxSize=3, ttl=1 minute
  });

  it("stores and retrieves data with matching fingerprint", () => {
    cache.set("key1", "value1", "fp-1");
    expect(cache.get("key1", "fp-1")).toBe("value1");
  });

  it("returns null for unknown keys", () => {
    expect(cache.get("unknown", "fp-1")).toBeNull();
  });

  it("returns null when fingerprint does not match", () => {
    cache.set("key1", "value1", "fp-1");
    expect(cache.get("key1", "fp-changed")).toBeNull();
  });

  it("evicts expired entries (TTL)", () => {
    vi.useFakeTimers();
    cache.set("key1", "value1", "fp-1");
    
    // Advance time past TTL (1 minute = 60_000ms)
    vi.advanceTimersByTime(61_000);
    
    expect(cache.get("key1", "fp-1")).toBeNull();
    vi.useRealTimers();
  });

  it("evicts oldest entry when at max capacity", () => {
    cache.set("a", "val-a", "fp-a");
    cache.set("b", "val-b", "fp-b");
    cache.set("c", "val-c", "fp-c");
    // At max size (3), adding another should evict "a"
    cache.set("d", "val-d", "fp-d");

    expect(cache.get("a", "fp-a")).toBeNull();
    expect(cache.get("d", "fp-d")).toBe("val-d");
  });

  it("clear() empties the cache", () => {
    cache.set("key1", "value1", "fp-1");
    cache.set("key2", "value2", "fp-2");
    cache.clear();
    expect(cache.stats().size).toBe(0);
  });

  it("stats() returns correct metrics", () => {
    cache.set("key1", "value1", "fp-1");
    const stats = cache.stats();
    expect(stats.size).toBe(1);
    expect(stats.maxSize).toBe(3);
    expect(stats.ttlMinutes).toBe(1);
  });

  it("has() returns true for valid entries", () => {
    cache.set("key1", "value1", "fp-1");
    expect(cache.has("key1", "fp-1")).toBe(true);
    expect(cache.has("key1", "fp-wrong")).toBe(false);
    expect(cache.has("unknown", "fp-1")).toBe(false);
  });
});

describe("AnalysisCache.generateFingerprint", () => {
  it("returns the same hash for the same data", () => {
    const data = { a: 1, b: "hello" };
    const fp1 = AnalysisCache.generateFingerprint(data);
    const fp2 = AnalysisCache.generateFingerprint(data);
    expect(fp1).toBe(fp2);
  });

  it("returns different hashes for different data", () => {
    const fp1 = AnalysisCache.generateFingerprint({ a: 1 });
    const fp2 = AnalysisCache.generateFingerprint({ a: 2 });
    expect(fp1).not.toBe(fp2);
  });
});
