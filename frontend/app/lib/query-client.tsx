/**
 * TanStack Query Client Configuration
 *
 * Central QueryClient setup with sensible defaults for the Biasly SMS.
 * Provides the provider component and a singleton client instance.
 *
 * Defaults:
 * - staleTime: 5 minutes (data considered fresh for 5 min)
 * - gcTime: 30 minutes (cache kept in memory for 30 min)
 * - retry: 2 failed attempts before showing error state
 * - refetchOnWindowFocus: false (avoid excessive refetches)
 * - refetchOnReconnect: true (refetch on network recovery)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

// ─── QueryClient instance ────────────────────────────────────────────────────

/**
 * Singleton QueryClient configured with application-wide defaults.
 * Export this for direct use in loaders/actions or test utilities.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (garbage collection)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0, // Don't retry mutations by default
    },
  },
});

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * QueryProvider wraps the application with TanStack Query's context.
 * Use this in the root layout to enable useQuery/useMutation hooks everywhere.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
