/**
 * use-activity-logs — TanStack Query hooks for Activity Logs.
 *
 * Activity logs are read-only (audit trail) with server-side pagination,
 * date-range filtering, activity search, and user filtering.
 *
 * API: GET /api/activity-logs?page=&limit=&userId=&activity=&from=&to=
 * Response: { data: ActivityLog[], pagination: Pagination }
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

/** User info returned by the API */
export interface ActivityLogUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
}

/** Full activity log shape */
export interface ActivityLog {
  id: string;
  userId: string;
  activity: string;
  details: string | null;
  createdAt: string;
  updatedAt: string;
  user: ActivityLogUser;
}

/** Pagination metadata from the API */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** API response wrapper */
interface ActivityLogsResponse {
  data: ActivityLog[];
  pagination: Pagination;
}

/** Filters for the activity log query */
export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  activity?: string;
  from?: string;
  to?: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const activityLogKeys = {
  all: ["activity-logs"] as const,
  lists: () => [...activityLogKeys.all, "list"] as const,
  list: (filters?: ActivityLogFilters) =>
    [...activityLogKeys.lists(), filters] as const,
  details: () => [...activityLogKeys.all, "detail"] as const,
  detail: (id: string) => [...activityLogKeys.details(), id] as const,
};

// ─── Format helpers ─────────────────────────────────────────────────────────

/**
 * Format an activity string into a human-readable label.
 * e.g. "grade:updated" → "Grade Updated", "auth:login" → "Auth Login"
 */
export function formatActivityLabel(activity: string): string {
  return activity
    .replace(/[:_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a color class pair for the activity type.
 */
export function getActivityColor(
  activity: string,
): { dot: string; bg: string; text: string } {
  const prefix = activity.split(":")[0]?.toLowerCase() ?? "";

  switch (prefix) {
    case "auth":
      return {
        dot: "bg-blue-500",
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
      };
    case "grade":
    case "assessment":
    case "assignment":
      return {
        dot: "bg-emerald-500",
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
      };
    case "payment":
    case "finance":
      return {
        dot: "bg-amber-500",
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
      };
    case "user":
      return {
        dot: "bg-purple-500",
        bg: "bg-purple-500/10",
        text: "text-purple-600 dark:text-purple-400",
      };
    case "announcement":
      return {
        dot: "bg-rose-500",
        bg: "bg-rose-500/10",
        text: "text-rose-600 dark:text-rose-400",
      };
    case "health":
      return {
        dot: "bg-slate-400",
        bg: "bg-slate-400/10",
        text: "text-slate-500 dark:text-slate-400",
      };
    default:
      return {
        dot: "bg-slate-500",
        bg: "bg-slate-500/10",
        text: "text-slate-600 dark:text-slate-400",
      };
  }
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated, filterable list of activity logs.
 * Pass filters as an object — the hook automatically rebuilds the query key.
 */
export function useActivityLogs(filters?: ActivityLogFilters) {
  return useQuery({
    queryKey: activityLogKeys.list(filters),
    queryFn: async () => {
      // Build query string from filters, omitting undefined values
      const params = new URLSearchParams();
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.userId) params.set("userId", filters.userId);
      if (filters?.activity) params.set("activity", filters.activity);
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);

      const qs = params.toString();
      const url = `/api/activity-logs${qs ? `?${qs}` : ""}`;

      const response = await api.get<ActivityLogsResponse>(url);
      return response.data;
    },
    staleTime: 30 * 1000, // 30s — logs update frequently
  });
}

/**
 * Fetch a single activity log by ID.
 */
export function useActivityLog(id: string) {
  return useQuery({
    queryKey: activityLogKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: ActivityLog }>(
        `/api/activity-logs/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}
