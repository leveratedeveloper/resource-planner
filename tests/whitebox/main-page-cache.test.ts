import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  MAIN_PAGE_CACHE_MAX_AGE_MS,
  MAIN_PAGE_CACHE_STORAGE_KEY_PREFIX,
  clearMainPageCaches,
  getMainPageCacheStorageKey,
  hydrateMainPageCache,
  isMainPageCacheQueryKey,
  persistMainPageCache,
} from "@/lib/query/main-page-cache";
import { queryKeys } from "@/lib/query/queryKeys";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function createQuotaFailingStorage(): Storage {
  const storage = createMemoryStorage();

  return {
    ...storage,
    setItem() {
      throw new DOMException("Exceeded storage quota", "QuotaExceededError");
    },
  };
}

describe("main page query cache", () => {
  it("allowlists only lightweight lookup query roots for main page persistence", () => {
    expect(isMainPageCacheQueryKey(queryKeys.plannerTimeline)).toBe(false);
    expect(isMainPageCacheQueryKey(queryKeys.employees)).toBe(false);
    expect(isMainPageCacheQueryKey(queryKeys.brands)).toBe(true);
    expect(isMainPageCacheQueryKey(queryKeys.projects)).toBe(true);
    expect(isMainPageCacheQueryKey(queryKeys.departments)).toBe(true);
    expect(isMainPageCacheQueryKey(queryKeys.businessUnits)).toBe(true);
    expect(isMainPageCacheQueryKey(queryKeys.projectCategories)).toBe(true);
    expect(isMainPageCacheQueryKey(queryKeys.channelClassifications)).toBe(true);
    expect(isMainPageCacheQueryKey(queryKeys.deliverables)).toBe(false);
    expect(isMainPageCacheQueryKey(["auth", "session"])).toBe(false);
    expect(isMainPageCacheQueryKey(["insights"])).toBe(false);
    expect(isMainPageCacheQueryKey(["export", "assignments"])).toBe(false);
  });

  it("persists successful allowlisted queries and skips other query data", () => {
    const storage = createMemoryStorage();
    const queryClient = new QueryClient();

    queryClient.setQueryData(queryKeys.projects, [{ id: "project-1" }]);
    queryClient.setQueryData(["insights"], { score: 1 });

    const result = persistMainPageCache(queryClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000,
    });

    expect(result).toBe("saved");

    const raw = storage.getItem(getMainPageCacheStorageKey("employee-1"));
    expect(raw).toBeTruthy();

    const envelope = JSON.parse(raw!);
    const persistedKeys = envelope.state.queries.map((query: { queryKey: unknown[] }) => query.queryKey);

    expect(persistedKeys).toContainEqual(queryKeys.projects);
    expect(persistedKeys).not.toContainEqual(["insights"]);
  });

  it("removes the cache key and returns quota-exceeded when localStorage quota is exceeded", () => {
    const storage = createQuotaFailingStorage();
    const queryClient = new QueryClient();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    queryClient.setQueryData(queryKeys.projects, [{ id: "project-1" }]);

    const result = persistMainPageCache(queryClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000,
    });

    expect(result).toBe("quota-exceeded");
    expect(storage.getItem(getMainPageCacheStorageKey("employee-1"))).toBeNull();
    expect(consoleWarn).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("restores cached queries and marks them stale so they refetch after mount", () => {
    const storage = createMemoryStorage();
    const firstClient = new QueryClient();
    const secondClient = new QueryClient();

    firstClient.setQueryData(queryKeys.projects, [{ id: "project-1" }]);
    persistMainPageCache(firstClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000,
    });

    const result = hydrateMainPageCache(secondClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_100,
    });
    const query = secondClient.getQueryCache().find({ queryKey: queryKeys.projects });

    expect(result).toBe("restored");
    expect(secondClient.getQueryData(queryKeys.projects)).toEqual([{ id: "project-1" }]);
    expect(query?.state.dataUpdatedAt).toBe(0);
  });

  it("drops expired cache envelopes", () => {
    const storage = createMemoryStorage();
    const firstClient = new QueryClient();
    const secondClient = new QueryClient();

    firstClient.setQueryData(queryKeys.brands, [{ id: "brand-1" }]);
    persistMainPageCache(firstClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000,
    });

    const result = hydrateMainPageCache(secondClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000 + MAIN_PAGE_CACHE_MAX_AGE_MS + 1,
    });

    expect(result).toBe("expired");
    expect(storage.getItem(getMainPageCacheStorageKey("employee-1"))).toBeNull();
    expect(secondClient.getQueryData(queryKeys.brands)).toBeUndefined();
  });

  it("drops invalid cache envelopes without throwing", () => {
    const storage = createMemoryStorage();
    const queryClient = new QueryClient();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    storage.setItem(getMainPageCacheStorageKey("employee-1"), "{not-json");

    expect(hydrateMainPageCache(queryClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000,
    })).toBe("invalid");
    expect(storage.getItem(getMainPageCacheStorageKey("employee-1"))).toBeNull();

    consoleWarn.mockRestore();
  });

  it("wires cache restore and persistence through an explicit session owner", () => {
    const providerSource = readFileSync("lib/query/QueryProvider.tsx", "utf8");
    const layoutSource = readFileSync("app/layout.tsx", "utf8");
    const authSource = readFileSync("context/AuthContext.tsx", "utf8");

    expect(providerSource).toContain("cacheOwnerKey");
    expect(providerSource).toContain("hydrateMainPageCache(queryClient, {");
    expect(providerSource).toContain("persistMainPageCache(queryClient, {");
    expect(providerSource).toContain("useIsomorphicLayoutEffect");
    expect(providerSource).toContain("queryClient.getQueryCache().subscribe");
    expect(layoutSource).toContain("cacheOwnerKey={initialSession?.employee.uuid ?? null}");
    expect(authSource).toContain("clearMainPageCaches()");
  });

  it("persists and hydrates under an owner-scoped cache key", () => {
    const storage = createMemoryStorage();
    const firstClient = new QueryClient();
    const secondClient = new QueryClient();

    firstClient.setQueryData(queryKeys.projects, [{ id: "project-1" }]);

    expect(persistMainPageCache(firstClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_000,
    })).toBe("saved");

    expect(storage.getItem(getMainPageCacheStorageKey("employee-1"))).toBeTruthy();
    expect(storage.getItem(getMainPageCacheStorageKey("employee-2"))).toBeNull();

    expect(hydrateMainPageCache(secondClient, {
      ownerKey: "employee-1",
      storage,
      now: 1_700_000_000_100,
    })).toBe("restored");
    expect(secondClient.getQueryData(queryKeys.projects)).toEqual([{ id: "project-1" }]);
  });

  it("does not hydrate or persist when the cache owner is unknown", () => {
    const storage = createMemoryStorage();
    const queryClient = new QueryClient();

    queryClient.setQueryData(queryKeys.projects, [{ id: "project-1" }]);

    expect(persistMainPageCache(queryClient, {
      ownerKey: null,
      storage,
      now: 1_700_000_000_000,
    })).toBe("unavailable");
    expect(hydrateMainPageCache(queryClient, {
      ownerKey: null,
      storage,
      now: 1_700_000_000_100,
    })).toBe("unavailable");
    expect(storage.length).toBe(0);
  });

  it("clears all persisted main-page cache entries on logout", () => {
    const storage = createMemoryStorage();

    storage.setItem(getMainPageCacheStorageKey("employee-1"), "cache-a");
    storage.setItem(getMainPageCacheStorageKey("employee-2"), "cache-b");
    storage.setItem("unrelated", "keep");

    expect(clearMainPageCaches(storage)).toBe(2);
    expect(storage.getItem(getMainPageCacheStorageKey("employee-1"))).toBeNull();
    expect(storage.getItem(getMainPageCacheStorageKey("employee-2"))).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });

  it("uses a stable resource-planner main-page cache key prefix", () => {
    expect(MAIN_PAGE_CACHE_STORAGE_KEY_PREFIX).toBe("resource-planner:main-page-cache:v1:");
    expect(getMainPageCacheStorageKey("employee-1")).toBe(
      "resource-planner:main-page-cache:v1:employee-1"
    );
  });
});
