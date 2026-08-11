/**
 * use-subjects — TanStack Query hooks for Subjects CRUD.
 *
 * Provides:
 * - useSubjects             — GET /api/subjects (list with grade, academicYear, _count)
 * - useSubject              — GET /api/subjects/:id
 * - useCreateSubject        — POST /api/subjects
 * - useUpdateSubject        — PATCH /api/subjects/:id
 * - useDeleteSubject        — DELETE /api/subjects/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  gradeId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
  grade: { id: string; name: string; section: string };
  academicYear: { id: string; name: string };
  _count: {
    teachers: number;
  };
}

interface ApiResponse<T> {
  data: T;
}

export interface SubjectPayload {
  name: string;
  code: string;
  gradeId: string;
  academicYearId: string;
  description?: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const subjectKeys = {
  all: ["subjects"] as const,
  lists: () => [...subjectKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...subjectKeys.lists(), filters] as const,
  details: () => [...subjectKeys.all, "detail"] as const,
  detail: (id: string) => [...subjectKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch all subjects, ordered by name ascending.
 * Optionally filtered by gradeId and/or academicYearId.
 */
export function useSubjects(gradeId?: string, academicYearId?: string) {
  return useQuery({
    queryKey: subjectKeys.list({ gradeId, academicYearId }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (gradeId) params.gradeId = gradeId;
      if (academicYearId) params.academicYearId = academicYearId;
      const response = await api.get<ApiResponse<Subject[]>>("/api/subjects", {
        params,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single subject by ID.
 */
export function useSubject(id: string) {
  return useQuery({
    queryKey: subjectKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Subject>>(
        `/api/subjects/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new subject.
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubjectPayload) => {
      const response = await api.post<ApiResponse<Subject>>(
        "/api/subjects",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: subjectKeys.lists() });
      toast.success("Subject created", {
        description: `"${data.name} (${data.code})" has been created.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create subject", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing subject.
 */
export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SubjectPayload>;
    }) => {
      const response = await api.patch<ApiResponse<Subject>>(
        `/api/subjects/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: subjectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: subjectKeys.detail(data.id) });
      toast.success("Subject updated", {
        description: `"${data.name} (${data.code})" has been updated.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update subject", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete a subject.
 */
export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subjectKeys.lists() });
      toast.success("Subject deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete subject", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}
