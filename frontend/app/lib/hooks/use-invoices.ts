/**
 * use-invoices — TanStack Query hooks for school-fee invoices.
 *
 * Invoices are generated when students/parents pay fee structures through
 * Stripe Checkout. Each invoice carries one item per term and a set of
 * payments. This module provides:
 *
 * - useInvoices       — GET /api/invoices (management: full list) or
 *                       GET /api/invoices/my (student/parent: own invoices),
 *                       selected via the `scope` option
 * - useInvoiceDetail  — GET /api/invoices/:id (full payment breakdown)
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

/** One line item on an invoice (a fee for a term) */
export interface InvoiceItemLite {
  id: string;
  amount: string;
  feeStructureId: string;
  term?: { id: string; name: string };
  grade?: { id: string; name: string; section: string };
}

/** A payment recorded against an invoice */
export interface InvoicePaymentLite {
  id: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  stripeCheckoutSessionId?: string | null;
  recordedBy?: { name: string } | null;
}

/** An invoice row in the list (with computed billed/paid/balance) */
export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  academicYear?: { id: string; name: string };
  student?: {
    id: string;
    admissionNumber: string;
    user: { name: string };
    grade?: { id: string; name: string; section: string };
  };
  items: InvoiceItemLite[];
  payments: InvoicePaymentLite[];
  totals: { billed: number; paid: number; balance: number };
}

/** Scoped summary + per-status counts returned alongside the list */
export interface InvoiceTotals {
  count: number;
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  statusCounts: {
    UNPAID: number;
    PARTIALLY_PAID: number;
    PAID: number;
    CANCELLED: number;
  };
}

/** Response envelope for the list endpoints */
export interface InvoicesResponse {
  invoices: InvoiceListItem[];
  totals: InvoiceTotals;
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (filters: Record<string, unknown>) =>
    [...invoiceKeys.all, "list", filters] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch invoices with optional filters.
 *
 * @param filters  { status?: InvoiceStatus, academicYearId?: string }
 * @param options  { scope?: "all" | "mine"; enabled?: boolean }
 *   - "all"  → GET /api/invoices       (management: full list)
 *   - "mine" → GET /api/invoices/my    (student: own, parent: children's)
 */
export function useInvoices(
  filters: { status?: string; academicYearId?: string },
  options?: { scope?: "all" | "mine"; enabled?: boolean },
) {
  const scope = options?.scope ?? "all";
  const path = scope === "mine" ? "/api/invoices/my" : "/api/invoices";

  return useQuery({
    queryKey: invoiceKeys.list({ ...filters, scope }),
    queryFn: async () => {
      const response = await api.get<ApiResponse<InvoicesResponse>>(path, {
        params: filters,
      });
      return response.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000, // refresh after returning from Stripe checkout
  });
}

/**
 * Fetch a single invoice's full breakdown (items per term + every payment).
 *
 * @param id — invoice id, or null to keep the query disabled
 */
export function useInvoiceDetail(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ""),
    queryFn: async () => {
      const response = await api.get<ApiResponse<InvoiceListItem>>(
        `/api/invoices/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
