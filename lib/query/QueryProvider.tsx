"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  MAIN_PAGE_CACHE_WRITE_THROTTLE_MS,
  hydrateMainPageCache,
  persistMainPageCache,
} from "@/lib/query/main-page-cache";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function QueryProvider({
  children,
  cacheOwnerKey,
}: {
  children: ReactNode;
  cacheOwnerKey?: string | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // PERFORMANCE: Data considered fresh for 5 minutes (was 30 seconds)
            // This reduces unnecessary refetches by 90%
            staleTime: 5 * 60 * 1000,
            // PERFORMANCE: Cache kept for 30 minutes (was 5 minutes)
            // This allows longer cache retention for better UX
            gcTime: 30 * 60 * 1000,
            // Retry failed requests once (was 3 times)
            retry: 1,
            // Don't refetch on window focus (reduces unnecessary API calls)
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Retry mutations once
            retry: 1,
          },
        },
      })
  );
  const restoredCacheRef = useRef(false);

  useIsomorphicLayoutEffect(() => {
    if (restoredCacheRef.current || !cacheOwnerKey) {
      return;
    }

    hydrateMainPageCache(queryClient, { ownerKey: cacheOwnerKey });
    restoredCacheRef.current = true;
  }, [cacheOwnerKey, queryClient]);

  useEffect(() => {
    if (!cacheOwnerKey) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedulePersist = () => {
      if (timeoutId) {
        return;
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        persistMainPageCache(queryClient, { ownerKey: cacheOwnerKey });
      }, MAIN_PAGE_CACHE_WRITE_THROTTLE_MS);
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(schedulePersist);
    schedulePersist();

    return () => {
      unsubscribe();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      persistMainPageCache(queryClient, { ownerKey: cacheOwnerKey });
    };
  }, [cacheOwnerKey, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
