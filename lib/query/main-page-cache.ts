import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";

export const MAIN_PAGE_CACHE_VERSION = 1;
export const MAIN_PAGE_CACHE_STORAGE_KEY_PREFIX = "resource-planner:main-page-cache:v1:";
export const MAIN_PAGE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
export const MAIN_PAGE_CACHE_WRITE_THROTTLE_MS = 1000;

const MAIN_PAGE_QUERY_ROOTS = new Set([
  "brands",
  "projects",
  "departments",
  "business-units",
  "project-categories",
  "channel-classifications",
]);

type MainPageCacheEnvelope = {
  version: number;
  savedAt: number;
  state: DehydratedState;
};

type MainPageCacheOptions = {
  ownerKey: string | null | undefined;
  storage?: Storage | null;
  now?: number;
};

export type MainPageCacheHydrateResult =
  | "restored"
  | "miss"
  | "expired"
  | "invalid"
  | "unavailable";

export type MainPageCachePersistResult =
  | "saved"
  | "empty"
  | "unavailable"
  | "quota-exceeded"
  | "failed";

function isStorageAvailable(storage?: Storage | null): storage is Storage {
  return !!storage;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getMainPageCacheStorageKey(ownerKey: string): string {
  return `${MAIN_PAGE_CACHE_STORAGE_KEY_PREFIX}${ownerKey}`;
}

function getCacheStorageKey(ownerKey: string | null | undefined): string | null {
  return ownerKey ? getMainPageCacheStorageKey(ownerKey) : null;
}

function getQueryRoot(queryKey: readonly unknown[]): string | null {
  const root = queryKey[0];
  return typeof root === "string" ? root : null;
}

function isEnvelope(value: unknown): value is MainPageCacheEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<MainPageCacheEnvelope>;

  return (
    envelope.version === MAIN_PAGE_CACHE_VERSION &&
    typeof envelope.savedAt === "number" &&
    !!envelope.state &&
    typeof envelope.state === "object" &&
    Array.isArray((envelope.state as DehydratedState).queries)
  );
}

function markRestoredQueriesStale(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: state.queries.map((query) => ({
      ...query,
      state: {
        ...query.state,
        dataUpdatedAt: 0,
      },
    })),
  };
}

export function isMainPageCacheQueryKey(queryKey: readonly unknown[]): boolean {
  const root = getQueryRoot(queryKey);
  return !!root && MAIN_PAGE_QUERY_ROOTS.has(root);
}

export function clearMainPageCaches(
  storage: Storage | null = getBrowserStorage()
): number {
  if (!isStorageAvailable(storage)) {
    return 0;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(MAIN_PAGE_CACHE_STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }

  return keysToRemove.length;
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function hydrateMainPageCache(
  queryClient: QueryClient,
  {
    ownerKey,
    storage = getBrowserStorage(),
    now = Date.now(),
  }: MainPageCacheOptions
): MainPageCacheHydrateResult {
  const cacheKey = getCacheStorageKey(ownerKey);
  if (!cacheKey || !isStorageAvailable(storage)) {
    return "unavailable";
  }

  const raw = storage.getItem(cacheKey);
  if (!raw) {
    return "miss";
  }

  try {
    const parsed = JSON.parse(raw);

    if (!isEnvelope(parsed)) {
      storage.removeItem(cacheKey);
      return "invalid";
    }

    if (now - parsed.savedAt > MAIN_PAGE_CACHE_MAX_AGE_MS) {
      storage.removeItem(cacheKey);
      return "expired";
    }

    hydrate(queryClient, markRestoredQueriesStale(parsed.state));
    return "restored";
  } catch (error) {
    console.warn("[MainPageCache] Failed to restore persisted query cache", error);
    storage.removeItem(cacheKey);
    return "invalid";
  }
}

export function persistMainPageCache(
  queryClient: QueryClient,
  {
    ownerKey,
    storage = getBrowserStorage(),
    now = Date.now(),
  }: MainPageCacheOptions
): MainPageCachePersistResult {
  const cacheKey = getCacheStorageKey(ownerKey);
  if (!cacheKey || !isStorageAvailable(storage)) {
    return "unavailable";
  }

  try {
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === "success" && isMainPageCacheQueryKey(query.queryKey),
    });

    if (state.queries.length === 0) {
      return "empty";
    }

    const envelope: MainPageCacheEnvelope = {
      version: MAIN_PAGE_CACHE_VERSION,
      savedAt: now,
      state,
    };

    storage.setItem(cacheKey, JSON.stringify(envelope));
    return "saved";
  } catch (error) {
    if (isQuotaExceededError(error)) {
      storage.removeItem(cacheKey);
      return "quota-exceeded";
    }

    console.warn("[MainPageCache] Failed to persist query cache", error);
    return "failed";
  }
}
