"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
