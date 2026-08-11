/**
 * use-timetable — TanStack Query hooks for Timetable operations.
 *
 * Provides:
 * - useTimetableSlots        — GET /api/timetable?gradeId=
 * - useMyTimetable           — GET /api/timetable/my (personalized, role-aware)
 * - useGenerateTimetable     — POST /api/timetable/generate (trigger AI gen)
 * - useUpdateTimetableSlot   — PATCH /api/timetable/:id
 * - useDeleteTimetableSlot   — DELETE /api/timetable/:id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimetableSlot {
  id: string;
  teachergradeSubjectId: string;
  teacherId: string;
  gradeId: string;
  room: string | null;
  dayOfWeek: number; // 1=Monday … 5=Friday
  startTime: number; // minutes since midnight
  endTime: number; // minutes since midnight
  subjectName: string | null;
  teacherName: string | null;
  createdAt: string;
  updatedAt: string;
  teachergradeSubject: {
    id: string;
    subject: { id: string; name: string; code: string };
    teacher: {
      user: { id: string; name: string };
    };
    grade?: { id: string; name: string; section: string; roomNumber: string | null };
  };
}

interface TimetableSlotPayload {
  startTime?: number;
  endTime?: number;
  dayOfWeek?: number;
  room?: string;
}

interface ApiResponse<T> {
  data: T;
}

interface GenerateResponse {
  message: string;
  runId: string;
  grade: { id: string; name: string; section: string };
}

/**
 * Response of GET /api/timetable/my — the current user's personalized timetable.
 *
 * - STUDENT → `grade` + `slots` for their grade
 * - TEACHER → `classes` (grade + subject per assignment) + their own `slots`
 * - PARENT  → `children` (each with name, admission number, grade)
 * - others  → empty payload
 */
export interface MyTimetable {
  scope: "STUDENT" | "TEACHER" | "PARENT" | "OTHER" | string;
  grade?: {
    id: string;
    name: string;
    section: string;
    roomNumber: string | null;
  } | null;
  classes?: {
    id: string;
    subject: { id: string; name: string; code: string };
    grade: { id: string; name: string; section: string };
  }[];
  children?: {
    studentId: string;
    name: string;
    admissionNumber: string;
    grade: { name: string; section: string };
  }[];
  slots: TimetableSlot[];
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const timetableKeys = {
  all: ["timetable"] as const,
  lists: () => [...timetableKeys.all, "list"] as const,
  list: (gradeId?: string) => [...timetableKeys.lists(), gradeId] as const,
  my: () => [...timetableKeys.all, "my"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch timetable slots for a specific grade.
 * Ordered by dayOfWeek then startTime.
 */
export function useTimetableSlots(gradeId?: string) {
  return useQuery({
    queryKey: timetableKeys.list(gradeId),
    queryFn: async () => {
      if (!gradeId) return [];
      const response = await api.get<ApiResponse<TimetableSlot[]>>(
        "/api/timetable",
        { params: { gradeId } },
      );
      return response.data.data;
    },
    enabled: !!gradeId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Trigger AI timetable generation via Inngest.
 * Returns a runId for tracking async progress.
 */
/**
 * Fetch the current user's personalized timetable (role-aware).
 * Students get their grade's timetable; teachers get their own lessons
 * across all their classes.
 */
export function useMyTimetable() {
  return useQuery({
    queryKey: timetableKeys.my(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<MyTimetable>>(
        "/api/timetable/my",
      );
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Trigger AI timetable generation via Inngest.
 * Returns a runId for tracking async progress.
 */
export function useGenerateTimetable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      gradeId: string;
      academicYearId: string;
    }) => {
      const response = await api.post<ApiResponse<GenerateResponse>>(
        "/api/timetable/generate",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: timetableKeys.list(data?.grade?.id),
      });
      toast.success("Timetable generation started", {
        description: "AI is generating the timetable. This may take a moment.",
      });
    },
    onError: (error) => {
      toast.error("Failed to generate timetable", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update a single timetable slot (admin edit).
 */
export function useUpdateTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: TimetableSlotPayload;
    }) => {
      const response = await api.patch<ApiResponse<TimetableSlot>>(
        `/api/timetable/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.lists() });
      toast.success("Lesson updated", {
        description: "The timetable slot has been updated.",
      });
    },
    onError: (error) => {
      toast.error("Failed to update lesson", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete a single timetable slot (admin only).
 */
export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/timetable/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timetableKeys.lists() });
      toast.success("Lesson removed", {
        description: "The timetable slot has been deleted.",
      });
    },
    onError: (error) => {
      toast.error("Failed to delete lesson", {
        description: error.message ?? "Please try again.",
      });
    },
  });
}
