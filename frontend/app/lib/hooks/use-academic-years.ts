/**
 * use-academic-years — TanStack Query hooks for Academic Years and Terms.
 *
 * Provides:
 * - useAcademicYears   — GET /api/academic-years (list with _count)
 * - useAcademicYear    — GET /api/academic-years/:id (single with terms)
 * - useCreateAcademicYear  — POST /api/academic-years
 * - useUpdateAcademicYear  — PATCH /api/academic-years/:id
 * - useDeleteAcademicYear  — DELETE /api/academic-years/:id
 * - useTerms           — GET /api/terms?academicYearId=xxx
 * - useCreateTerm      — POST /api/terms
 * - useUpdateTerm      — PATCH /api/terms/:id
 * - useDeleteTerm      — DELETE /api/terms/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/academic-years */
export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    terms: number;
    gradees: number;
    subjects: number;
    students: number;
  };
}

/** Shape returned by GET /api/terms */
export interface Term {
  id: string;
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  academicYear?: { id: string; name: string };
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

/** Payload for creating/updating an academic year */
export interface AcademicYearPayload {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

/** Payload for creating/updating a term */
export interface TermPayload {
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const academicYearKeys = {
  all: ["academic-years"] as const,
  lists: () => [...academicYearKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...academicYearKeys.lists(), filters] as const,
  details: () => [...academicYearKeys.all, "detail"] as const,
  detail: (id: string) => [...academicYearKeys.details(), id] as const,
};

export const termKeys = {
  all: ["terms"] as const,
  lists: () => [...termKeys.all, "list"] as const,
  list: (academicYearId?: string) =>
    [...termKeys.lists(), { academicYearId }] as const,
  details: () => [...termKeys.all, "detail"] as const,
  detail: (id: string) => [...termKeys.details(), id] as const,
};

// ─── Academic Year Hooks ────────────────────────────────────────────────────

/**
 * Fetch all academic years (newest first).
 *
 * @example
 * const { data, isLoading } = useAcademicYears();
 * // data = AcademicYear[]
 */
export function useAcademicYears() {
  return useQuery({
    queryKey: academicYearKeys.list(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<AcademicYear[]>>(
        "/api/academic-years",
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single academic year with its terms.
 *
 * @example
 * const { data } = useAcademicYear("cm0...");
 */
export function useAcademicYear(id: string) {
  return useQuery({
    queryKey: academicYearKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<AcademicYear & { terms: Term[] }>>(
        `/api/academic-years/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new academic year.
 * Automatically invalidates the academic years list on success.
 *
 * @example
 * const create = useCreateAcademicYear();
 * create.mutate({ name: "2027-2028", startDate: "2027-01-15", endDate: "2027-12-20" });
 */
export function useCreateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AcademicYearPayload) => {
      const response = await api.post<ApiResponse<AcademicYear>>(
        "/api/academic-years",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: academicYearKeys.lists() });
      toast.success("Academic year created", {
        description: `"${data.name}" has been created successfully.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create academic year", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing academic year.
 *
 * @example
 * const update = useUpdateAcademicYear();
 * update.mutate({ id: "cm0...", data: { name: "2027-2028 Updated" } });
 */
export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AcademicYearPayload>;
    }) => {
      const response = await api.patch<ApiResponse<AcademicYear>>(
        `/api/academic-years/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: academicYearKeys.lists() });
      queryClient.invalidateQueries({ queryKey: academicYearKeys.detail(data.id) });
      toast.success("Academic year updated", {
        description: `"${data.name}" has been updated.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update academic year", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete an academic year.
 *
 * @example
 * const remove = useDeleteAcademicYear();
 * remove.mutate("cm0...");
 */
export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/academic-years/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearKeys.lists() });
      toast.success("Academic year deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete academic year", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

// ─── Term Hooks ─────────────────────────────────────────────────────────────

/**
 * Fetch terms for a specific academic year.
 *
 * @example
 * const { data } = useTerms("cm0...");
 * // data = Term[]
 */
export function useTerms(academicYearId?: string) {
  return useQuery({
    queryKey: termKeys.list(academicYearId),
    queryFn: async () => {
      const params = academicYearId
        ? { academicYearId }
        : {};
      const response = await api.get<ApiResponse<Term[]>>("/api/terms", {
        params,
      });
      return response.data.data;
    },
    enabled: !!academicYearId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new term within an academic year.
 * Automatically invalidates the terms list and the parent academic year detail.
 *
 * @example
 * const create = useCreateTerm();
 * create.mutate({ name: "Term 1", academicYearId: "cm0...", startDate: "...", endDate: "..." });
 */
export function useCreateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TermPayload) => {
      const response = await api.post<ApiResponse<Term>>(
        "/api/terms",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: termKeys.list(data.academicYearId) });
      queryClient.invalidateQueries({
        queryKey: academicYearKeys.detail(data.academicYearId),
      });
      toast.success("Term created", {
        description: `"${data.name}" has been created.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create term", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing term.
 *
 * @example
 * const update = useUpdateTerm();
 * update.mutate({ id: "cm0...", data: { name: "Term 1 (Updated)" } });
 */
export function useUpdateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      academicYearId,
    }: {
      id: string;
      data: Partial<TermPayload>;
      academicYearId: string;
    }) => {
      const response = await api.patch<ApiResponse<Term>>(
        `/api/terms/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: termKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: academicYearKeys.detail(data.academicYearId),
      });
      toast.success("Term updated", {
        description: `"${data.name}" has been updated.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update term", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete a term.
 *
 * @example
 * const remove = useDeleteTerm();
 * remove.mutate({ id: "cm0...", academicYearId: "cm0..." });
 */
export function useDeleteTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      academicYearId,
    }: {
      id: string;
      academicYearId: string;
    }) => {
      await api.delete(`/api/terms/${id}`);
      return { academicYearId };
    },
    onSuccess: ({ academicYearId }) => {
      queryClient.invalidateQueries({ queryKey: termKeys.list(academicYearId) });
      queryClient.invalidateQueries({
        queryKey: academicYearKeys.detail(academicYearId),
      });
      toast.success("Term deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete term", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}
