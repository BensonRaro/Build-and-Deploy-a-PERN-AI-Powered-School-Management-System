/**
 * use-finance — TanStack Query hook for whole-school finance analytics.
 *
 * Provides:
 * - useFinanceAnalytics — GET /api/finance/analytics (management summary:
 *   totals, by term, by grade, by method, monthly trend, recent payments)
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Whole-school totals */
export interface FinanceSummary {
  totalBilled: string;
  totalCollected: string;
  totalOutstanding: string;
  collectionRate: number;
  itemCount: number;
  studentCount: number;
  paymentCount: number;
}

/** Invoice status breakdown row */
export interface InvoiceStatusRow {
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  count: number;
  amount: number;
}

/** Per-term breakdown row */
export interface TermFinanceRow {
  termId: string;
  termName: string;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
}

/** Per-grade breakdown row */
export interface GradeFinanceRow {
  gradeId: string;
  gradeName: string;
  section: string;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
}

/** Payment-method breakdown row */
export interface MethodFinanceRow {
  method: string;
  count: number;
  amount: number;
}

/** Monthly collection trend point */
export interface MonthlyFinancePoint {
  month: string;
  label: string;
  collected: number;
}

/** Recent payment row for the dashboard feed */
export interface RecentPaymentRow {
  id: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  studentName: string;
  grade: string;
  term: string;
}

/** Full analytics payload returned by GET /api/finance/analytics */
export interface FinanceAnalytics {
  summary: FinanceSummary;
  invoiceStatuses: InvoiceStatusRow[];
  byTerm: TermFinanceRow[];
  byGrade: GradeFinanceRow[];
  byMethod: MethodFinanceRow[];
  monthly: MonthlyFinancePoint[];
  recentPayments: RecentPaymentRow[];
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const financeKeys = {
  all: ["finance"] as const,
  analytics: (academicYearId?: string) =>
    [...financeKeys.all, "analytics", academicYearId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch the whole-school finance analytics summary.
 *
 * @param academicYearId - optionally scope to a single academic year
 */
export function useFinanceAnalytics(academicYearId?: string) {
  return useQuery({
    queryKey: financeKeys.analytics(academicYearId),
    queryFn: async () => {
      const response = await api.get<ApiResponse<FinanceAnalytics>>(
        "/api/finance/analytics",
        { params: academicYearId ? { academicYearId } : {} },
      );
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}
