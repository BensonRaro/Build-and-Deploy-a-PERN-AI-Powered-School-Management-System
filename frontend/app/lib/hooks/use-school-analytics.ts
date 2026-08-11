/**
 * use-school-analytics — TanStack Query hook for the whole-school analytics
 * overview shown on the management dashboard.
 *
 * Provides:
 * - useSchoolAnalytics — GET /api/analytics/overview
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/analytics/overview */
export interface SchoolAnalytics {
  summary: {
    students: number;
    teachers: number;
    staff: number;
    parents: number;
    grades: number;
    subjects: number;
    currentYear: { id: string; name: string } | null;
    currentTerm: string | null;
  };
  finance: {
    billed: string;
    collected: string;
    outstanding: string;
    collectionRate: number;
    invoiceCount: number;
    paymentCount: number;
  };
  assignments: {
    total: number;
    published: number;
    pendingGrading: number;
  };
  timetable: {
    totalGrades: number;
    gradesWithTimetable: number;
    gradesWithoutTimetable: number;
  };
  enrollmentByGrade: {
    gradeId: string;
    name: string;
    section: string;
    students: number;
  }[];
  recentActivity: {
    id: string;
    activity: string;
    details: string | null;
    createdAt: string;
    userName: string;
  }[];
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

// ─── Query key ──────────────────────────────────────────────────────────────

export const schoolAnalyticsKeys = {
  all: ["school-analytics"] as const,
  overview: () => [...schoolAnalyticsKeys.all, "overview"] as const,
};

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fetch the whole-school analytics overview (management roles only).
 */
export function useSchoolAnalytics() {
  return useQuery({
    queryKey: schoolAnalyticsKeys.overview(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<SchoolAnalytics>>(
        "/api/analytics/overview",
      );
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}
