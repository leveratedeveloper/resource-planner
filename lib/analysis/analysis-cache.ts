/**
 * Analysis Cache
 * LRU cache for analysis results with fingerprint-based invalidation
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  fingerprint: string;
};

export class AnalysisCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 50, ttlMinutes: number = 15) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate a fingerprint from data for cache key
   */
  static generateFingerprint(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached data if valid
   */
  get(key: string, currentFingerprint: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Check fingerprint match (data hasn't changed)
    if (entry.fingerprint !== currentFingerprint) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Store data in cache
   */
  set(key: string, data: T, fingerprint: string): void {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      fingerprint,
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string, currentFingerprint: string): boolean {
    return this.get(key, currentFingerprint) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttlMs / (60 * 1000),
    };
  }
}

// Singleton cache instance for AI responses
export const aiResponseCache = new AnalysisCache<unknown>(20, 15);

// Singleton cache instance for analysis results
export const analysisResultCache = new AnalysisCache<unknown>(10, 5);
