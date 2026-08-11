/**
 * use-grades — TanStack Query hooks for Grades CRUD.
 *
 * Provides:
 * - useGrades             — GET /api/grades (list with _count + academicYear)
 * - useGrade              — GET /api/grades/:id
 * - useCreateGrade        — POST /api/grades
 * - useUpdateGrade        — PATCH /api/grades/:id
 * - useDeleteGrade        — DELETE /api/grades/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Grade {
  id: string;
  name: string;
  section: string;
  academicYearId: string;
  roomNumber: string | null;
  capacity: number;
  createdAt: string;
  updatedAt: string;
  academicYear: { id: string; name: string };
  /** Fee structures set for this grade (one per term), ordered by term */
  fees: {
    id: string;
    termId: string;
    amount: string;
    term: { id: string; name: string };
  }[];
  _count: {
    students: number;
    subjects: number;
  };
}

interface ApiResponse<T> {
  data: T;
}

export interface GradePayload {
  name: string;
  section: string;
  academicYearId: string;
  roomNumber?: string;
  capacity?: number;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const gradeKeys = {
  all: ["grades"] as const,
  lists: () => [...gradeKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...gradeKeys.lists(), filters] as const,
  details: () => [...gradeKeys.all, "detail"] as const,
  detail: (id: string) => [...gradeKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch all grades, ordered by name ascending.
 * Optionally filtered by academicYearId.
 */
export function useGrades(academicYearId?: string) {
  return useQuery({
    queryKey: gradeKeys.list({ academicYearId }),
    queryFn: async () => {
      const params = academicYearId ? { academicYearId } : {};
      const response = await api.get<ApiResponse<Grade[]>>("/api/grades", {
        params,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single grade by ID.
 */
export function useGrade(id: string) {
  return useQuery({
    queryKey: gradeKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Grade>>(`/api/grades/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new grade.
 */
export function useCreateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GradePayload) => {
      const response = await api.post<ApiResponse<Grade>>(
        "/api/grades",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gradeKeys.lists() });
      toast.success("Grade created", {
        description: `"${data.name} - ${data.section}" has been created.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create grade", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing grade.
 */
export function useUpdateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<GradePayload>;
    }) => {
      const response = await api.patch<ApiResponse<Grade>>(
        `/api/grades/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gradeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gradeKeys.detail(data.id) });
      toast.success("Grade updated", {
        description: `"${data.name} - ${data.section}" has been updated.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update grade", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete a grade.
 */
export function useDeleteGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/grades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gradeKeys.lists() });
      toast.success("Grade deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete grade", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}
