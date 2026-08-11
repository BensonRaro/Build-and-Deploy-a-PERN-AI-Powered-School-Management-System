/**
 * use-fees — TanStack Query hooks for Fee Structure CRUD.
 *
 * A fee structure links a Grade to a Term with a single amount
 * (e.g. "Grade 10 — Term 1 — 250.00"). The backend enforces one fee
 * per (grade, term) pair.
 *
 * Provides:
 * - useFees            — GET /api/fees (list, filterable by gradeId/termId/academicYearId)
 * - useCreateFee       — POST /api/fees
 * - useUpdateFee       — PATCH /api/fees/:id
 * - useDeleteFee       — DELETE /api/fees/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/fees (amount arrives as a string from Prisma Decimal) */
export interface Fee {
  id: string;
  gradeId: string;
  termId: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
  grade: { id: string; name: string; section: string; academicYearId: string };
  term: { id: string; name: string; academicYearId: string };
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

/** Payload for creating/updating a fee structure */
export interface FeePayload {
  gradeId: string;
  termId: string;
  amount: number | string;
}

/** Optional filters for the list query */
export interface FeeFilters {
  gradeId?: string;
  termId?: string;
  academicYearId?: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const feeKeys = {
  all: ["fees"] as const,
  lists: () => [...feeKeys.all, "list"] as const,
  list: (filters?: FeeFilters) => [...feeKeys.lists(), filters] as const,
  details: () => [...feeKeys.all, "detail"] as const,
  detail: (id: string) => [...feeKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch all fee structures, ordered by grade name ascending.
 * Optionally filtered by gradeId, termId, and/or academicYearId.
 */
export function useFees(filters?: FeeFilters) {
  return useQuery({
    queryKey: feeKeys.list(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.gradeId) params.gradeId = filters.gradeId;
      if (filters?.termId) params.termId = filters.termId;
      if (filters?.academicYearId) params.academicYearId = filters.academicYearId;

      const response = await api.get<ApiResponse<Fee[]>>("/api/fees", {
        params,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new fee structure.
 */
export function useCreateFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FeePayload) => {
      const response = await api.post<ApiResponse<Fee>>("/api/fees", payload);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: feeKeys.lists() });
      toast.success("Fee structure created", {
        description: `Set for "${data.grade.name}" in "${data.term.name}".`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create fee structure", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing fee structure.
 */
export function useUpdateFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<FeePayload>;
    }) => {
      const response = await api.patch<ApiResponse<Fee>>(`/api/fees/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: feeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: feeKeys.detail(data.id) });
      toast.success("Fee structure updated", {
        description: `Updated for "${data.grade.name}" in "${data.term.name}".`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update fee structure", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete a fee structure.
 */
export function useDeleteFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/fees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeKeys.lists() });
      toast.success("Fee structure deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete fee structure", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}
