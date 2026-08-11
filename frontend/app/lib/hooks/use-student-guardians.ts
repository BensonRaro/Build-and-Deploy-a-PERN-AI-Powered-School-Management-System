/**
 * use-student-guardians — TanStack Query hooks for Student-Guardian links.
 *
 * Provides:
 * - useStudentGuardians       — GET /api/student-guardians (list, optionally filtered)
 * - useCreateStudentGuardian  — POST /api/student-guardians
 * - useDeleteStudentGuardian  — DELETE /api/student-guardians/:id
 *
 * StudentGuardian records link a StudentProfile to a ParentProfile with
 * a relation type (FATHER, MOTHER, GUARDIAN, OTHER) and contact flags.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A student's user info as returned in the guardian link */
interface StudentUser {
  id: string;
  name: string;
  email: string;
}

/** A parent's user info as returned in the guardian link */
interface ParentUser {
  id: string;
  name: string;
  email: string;
}

/** A guardian's relation type */
export type GuardianRelation = "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER";

/** Full StudentGuardian shape returned by the backend */
export interface StudentGuardian {
  id: string;
  studentId: string;
  parentId: string;
  relation: GuardianRelation;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  createdAt: string;
  student: {
    user: StudentUser;
    grade?: { id: string; name: string; section: string };
  };
  parent: {
    user: ParentUser;
  };
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

/** Payload for creating a guardian link */
export interface CreateStudentGuardianPayload {
  studentId: string;
  parentId: string;
  relation: GuardianRelation;
  isPrimaryContact?: boolean;
  isEmergencyContact?: boolean;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const studentGuardianKeys = {
  all: ["student-guardians"] as const,
  lists: () => [...studentGuardianKeys.all, "list"] as const,
  list: (filters?: Record<string, string>) =>
    [...studentGuardianKeys.lists(), filters] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch student-guardian links, optionally filtered by student or parent.
 *
 * @example
 * const { data } = useStudentGuardians({ studentId: "cm0..." }); // guardians for a student
 * const { data } = useStudentGuardians({ parentId: "cm0..." });  // children of a parent
 * const { data } = useStudentGuardians();                          // all links
 */
export function useStudentGuardians(filters?: {
  studentId?: string;
  parentId?: string;
}) {
  return useQuery({
    queryKey: studentGuardianKeys.list(
      filters as Record<string, string> | undefined,
    ),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.studentId) params.studentId = filters.studentId;
      if (filters?.parentId) params.parentId = filters.parentId;
      const response = await api.get<ApiResponse<StudentGuardian[]>>(
        "/api/student-guardians",
        { params },
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new student-guardian link.
 * Automatically invalidates the links list on success.
 *
 * @example
 * const create = useCreateStudentGuardian();
 * create.mutate({
 *   studentId: "student-profile-id",
 *   parentId: "parent-profile-id",
 *   relation: "FATHER",
 *   isPrimaryContact: true,
 * });
 */
export function useCreateStudentGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateStudentGuardianPayload) => {
      const response = await api.post<ApiResponse<StudentGuardian>>(
        "/api/student-guardians",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: studentGuardianKeys.lists(),
      });
      const parentName = data.parent.user.name;
      const relationLabel = data.relation.toLowerCase();
      toast.success("Guardian linked", {
        description: `${parentName} added as ${relationLabel}.`,
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ??
        error.message ??
        "Please try again.";
      toast.error("Failed to link guardian", {
        description: message,
      });
    },
  });
}

/**
 * Delete a student-guardian link.
 *
 * @example
 * const remove = useDeleteStudentGuardian();
 * remove.mutate("link-id");
 */
export function useDeleteStudentGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/student-guardians/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentGuardianKeys.lists(),
      });
      toast.success("Guardian link removed");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ??
        error.message ??
        "Please try again.";
      toast.error("Failed to remove guardian link", {
        description: message,
      });
    },
  });
}
