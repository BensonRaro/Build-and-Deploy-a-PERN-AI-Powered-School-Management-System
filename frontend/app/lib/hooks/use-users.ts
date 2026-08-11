/**
 * use-users — TanStack Query hooks for User CRUD (Students, Teachers, Parents, Staff).
 *
 * Provides:
 * - useUsers             — GET /api/users (list with optional role filter + profile includes)
 * - useUser              — GET /api/users/:id
 * - useCreateUser        — POST /api/users
 * - useUpdateUser        — PATCH /api/users/:id
 * - useDeleteUser        — DELETE /api/users/:id
 *
 * The backend /api/users endpoint handles all role types (STUDENT, TEACHER, PARENT,
 * and staff roles) with their respective profiles (StudentProfile, ParentProfile,
 * StaffProfile).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shape of a Grade in profile context */
interface ProfileGrade {
  id: string;
  name: string;
  section: string;
}

/** Shape of an AcademicYear in profile context */
interface ProfileAcademicYear {
  id: string;
  name: string;
}

/** Student-specific profile data */
interface StudentProfile {
  id: string;
  gradeId: string;
  grade: ProfileGrade;
  academicYearId: string;
  academicYear: ProfileAcademicYear;
  admissionNumber: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string | null;
  address: string | null;
}

/** Parent-specific profile data */
interface ParentProfile {
  id: string;
  phone: string;
  occupation: string | null;
  address: string | null;
}

/** Staff-specific profile data */
interface StaffProfile {
  id: string;
  employeeId: string;
  department: string | null;
  qualification: string | null;
  joiningDate: string;
}

/** Full User shape returned by the backend */
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  banned: boolean;
  active: boolean;
  role: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  studentProfile: StudentProfile | null;
  parentProfile: ParentProfile | null;
  staffProfile: StaffProfile | null;
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

/** Payload for creating a user with profile data */
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  image?: string;
  profile?: Record<string, unknown>;
}

/** Payload for updating a user */
export interface UpdateUserPayload {
  id: string;
  data: {
    name?: string;
    email?: string;
    role?: string;
    image?: string;
    profile?: Record<string, unknown>;
  };
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch users, optionally filtered by role and/or search query.
 *
 * @example
 * const { data: students } = useUsers({ role: "STUDENT" });
 * const { data: teachers } = useUsers({ role: "TEACHER" });
 * const { data: parents } = useUsers({ role: "PARENT" });
 * const { data: staff } = useUsers({ role: "STAFF" });
 * const { data: all } = useUsers();
 */
export function useUsers(
  filters?: {
    role?: string;
    search?: string;
    academicYearId?: string;
    gradeId?: string;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: userKeys.list(filters ?? {}),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.role) params.role = filters.role;
      if (filters?.search) params.search = filters.search;
      if (filters?.academicYearId) params.academicYearId = filters.academicYearId;
      if (filters?.gradeId) params.gradeId = filters.gradeId;
      const response = await api.get<ApiResponse<User[]>>("/api/users", {
        params,
      });
      return response.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single user by ID.
 */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<User>>(`/api/users/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new user with profile data.
 * Automatically invalidates the users list on success.
 *
 * @example
 * const create = useCreateUser();
 * create.mutate({
 *   name: "John Doe",
 *   email: "john@school.edu",
 *   password: "secure123",
 *   role: "STUDENT",
 *   profile: { gradeId: "...", admissionNumber: "ADM-001", ... },
 * });
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const response = await api.post<ApiResponse<User>>(
        "/api/users",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success("User created", {
        description: `"${data.name}" has been created successfully.`,
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ??
        error.message ??
        "Please try again.";
      toast.error("Failed to create user", {
        description: message,
      });
    },
  });
}

/**
 * Update an existing user.
 *
 * @example
 * const update = useUpdateUser();
 * update.mutate({ id: "cm0...", data: { name: "Updated Name" } });
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateUserPayload) => {
      const response = await api.patch<ApiResponse<User>>(
        `/api/users/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) });
      toast.success("User updated", {
        description: `"${data.name}" has been updated.`,
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ??
        error.message ??
        "Please try again.";
      toast.error("Failed to update user", {
        description: message,
      });
    },
  });
}

/**
 * Delete (soft-delete) a user.
 *
 * @example
 * const remove = useDeleteUser();
 * remove.mutate("cm0...");
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success("User deleted");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ??
        error.message ??
        "Please try again.";
      toast.error("Failed to delete user", {
        description: message,
      });
    },
  });
}
