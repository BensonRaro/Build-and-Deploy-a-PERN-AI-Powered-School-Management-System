/**
 * use-payments — TanStack Query hooks for school-fee payments (Stripe).
 *
 * A student (or parent on their child's behalf) pays a FeeStructure through
 * Stripe Checkout. The backend creates the Checkout session, and a webhook
 * (handled by the @better-auth/stripe plugin's onEvent) records the Payment
 * when it completes.
 *
 * Provides:
 * - useMyPayments      — GET /api/payments/my (fee bills + status for the user)
 * - usePaymentsLedger  — GET /api/payments (management ledger)
 * - useCreateCheckout  — POST /api/payments/checkout → { url } (redirect)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Payment record attached to a fee bill */
export interface BillPayment {
  id: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
}

/** A single fee bill (one term of one student's grade) */
export interface FeeBill {
  feeStructureId: string;
  term: string;
  termId: string;
  amount: string;
  paidAmount: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  payments: BillPayment[];
}

/** Fee bills grouped per student (parents may have several children) */
export interface StudentBills {
  studentProfileId: string;
  studentName: string;
  admissionNumber: string;
  academicYear: string;
  grade: { id: string; name: string; section: string };
  bills: FeeBill[];
}

/** Response envelope for GET /api/payments/my */
interface MyPaymentsResponse {
  data: { students: StudentBills[] };
}

/** Payment row from the management ledger (GET /api/payments) */
export interface LedgerPayment {
  id: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  createdAt: string;
  invoice: {
    student: {
      user: { name: string };
      grade: { name: string; section: string };
    };
  };
  feeStructure: { term: { name: string } } | null;
  recordedBy: { name: string } | null;
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const paymentKeys = {
  all: ["payments"] as const,
  my: () => [...paymentKeys.all, "my"] as const,
  ledger: () => [...paymentKeys.all, "ledger"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's fee bills with payment status.
 * Students see their own fees; parents see all linked children.
 * Management roles pass `enabled: false` — they use the ledger instead.
 */
export function useMyPayments(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: paymentKeys.my(),
    queryFn: async () => {
      const response = await api.get<MyPaymentsResponse>("/api/payments/my");
      return response.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000, // refresh after returning from Stripe checkout
  });
}

/**
 * Fetch the full payments ledger (management roles only).
 */
export function usePaymentsLedger() {
  return useQuery({
    queryKey: paymentKeys.ledger(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<LedgerPayment[]>>(
        "/api/payments",
        { params: { limit: 100 } },
      );
      return response.data.data;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Create a Stripe Checkout session for a fee.
 * On success, redirects the browser to the returned Stripe URL.
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      feeStructureId: string;
      studentProfileId?: string;
    }) => {
      const response = await api.post<ApiResponse<{ url: string }>>(
        "/api/payments/checkout",
        payload,
      );
      return response.data.data;
    },
    onSuccess: ({ url }) => {
      // Let Stripe handle the redirect — no toast needed
      window.location.href = url;
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ??
        error.message ??
        "Please try again.";
      toast.error("Payment could not be started", {
        description: message,
      });
    },
    onSettled: () => {
      // Nothing to invalidate server-side, but keep queries fresh on return
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    },
  });
}
