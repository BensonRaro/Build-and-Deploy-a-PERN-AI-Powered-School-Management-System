/**
 * use-announcements — TanStack Query hooks for Announcements CRUD.
 *
 * Provides:
 * - useAnnouncements             — GET /api/announcements (list with author)
 * - useAnnouncement              — GET /api/announcements/:id
 * - useCreateAnnouncement        — POST /api/announcements
 * - useUpdateAnnouncement        — PATCH /api/announcements/:id
 * - useDeleteAnnouncement        — DELETE /api/announcements/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Author info as returned by the backend */
interface AnnouncementAuthor {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role?: string;
}

/** Full Announcement shape returned by the backend */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRoles: string[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: AnnouncementAuthor;
}

/** Generic API response wrapper */
interface ApiResponse<T> {
  data: T;
}

/** Payload for creating/updating an announcement */
export interface AnnouncementPayload {
  title: string;
  content: string;
  targetRoles: string[];
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const announcementKeys = {
  all: ["announcements"] as const,
  lists: () => [...announcementKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...announcementKeys.lists(), filters] as const,
  details: () => [...announcementKeys.all, "detail"] as const,
  detail: (id: string) => [...announcementKeys.details(), id] as const,
};

// ─── Available roles for targeting ──────────────────────────────────────────

export const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "PRINCIPAL", label: "Principal" },
  { value: "VICE_PRINCIPAL", label: "Vice Principal" },
  { value: "TEACHER", label: "Teacher" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "COUNSELOR", label: "Counselor" },
  { value: "STAFF", label: "Staff" },
  { value: "STUDENT", label: "Student" },
  { value: "PARENT", label: "Parent" },
] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch all announcements, ordered by most recent first.
 */
export function useAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.list(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Announcement[]>>(
        "/api/announcements",
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single announcement by ID.
 */
export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Announcement>>(
        `/api/announcements/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new announcement.
 * The authenticated user is automatically set as the author by the backend.
 */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AnnouncementPayload) => {
      const response = await api.post<ApiResponse<Announcement>>(
        "/api/announcements",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.lists() });
      toast.success("Announcement created", {
        description: `"${data.title}" has been published.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create announcement", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing announcement.
 */
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AnnouncementPayload>;
    }) => {
      const response = await api.patch<ApiResponse<Announcement>>(
        `/api/announcements/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: announcementKeys.detail(data.id),
      });
      toast.success("Announcement updated", {
        description: `"${data.title}" has been updated.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update announcement", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete an announcement.
 */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.lists() });
      toast.success("Announcement deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete announcement", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}
