/**
 * use-assignments — TanStack Query hooks for AI-generated Assignments.
 *
 * Provides:
 * - useAssignments             — GET /api/assignments (role-aware list)
 * - useAssignment              — GET /api/assignments/:id
 * - useGenerateAssignment      — POST /api/assignments/generate (start AI draft job)
 * - useGenerationJob           — GET /api/assignments/generate/:jobId (poll job result)
 * - useCreateAssignment        — POST /api/assignments
 * - useUpdateAssignment        — PATCH /api/assignments/:id
 * - useDeleteAssignment        — DELETE /api/assignments/:id
 * - useSubmitAssignment        — POST /api/assignments/:id/submit (instant AI grading)
 * - useAssignmentSubmissions   — GET /api/assignments/:id/submissions
 * - useGradeSubmission         — PATCH /api/assignments/submissions/:submissionId
 */

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AssignmentType = "WITH_ANSWERS" | "QUESTIONS_ONLY";
export type AssignmentStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

/** A single question. answerKey only present for WITH_ANSWERS assignments. */
export interface AssignmentQuestion {
  id: string;
  question: string;
  points: number;
  answerKey?: string;
}

/** Full assignment shape returned by the API. */
export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  status: AssignmentStatus;
  gradeId: string;
  academicYearId: string;
  subjectId: string | null;
  questions: AssignmentQuestion[];
  dueDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  grade: { id: string; name: string; section: string };
  academicYear: { id: string; name: string };
  subject: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string };
  _count: { submissions: number };
  /** Present on GET /:id when the requester is a student. */
  mySubmission?: MySubmission | null;
}

/** Per-question feedback returned after grading. */
export interface QuestionFeedback {
  questionId: string;
  earned: number;
  correct: boolean;
  feedback: string;
  correctAnswer?: string;
}

/** The submitting student's own submission (attached to GET /:id for students). */
export interface MySubmission {
  id: string;
  status: "SUBMITTED" | "GRADED";
  score: number | null;
  totalPoints: number;
  feedback: QuestionFeedback[] | null;
  answers: Array<{ questionId: string; answer: string }>;
  submittedAt: string;
  gradedAt: string | null;
}

/** A student's submission. */
export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  answers: Array<{ questionId: string; answer: string }>;
  score: number | null;
  totalPoints: number;
  feedback: QuestionFeedback[] | null;
  status: "SUBMITTED" | "GRADED";
  submittedAt: string;
  gradedAt: string | null;
  gradedById: string | null;
  createdAt: string;
  updatedAt: string;
  assignment?: {
    id: string;
    title: string;
    type: AssignmentType;
    grade: { name: string; section: string };
  };
  student?: {
    id: string;
    admissionNumber: string;
    user: { id: string; name: string; email: string; image: string | null };
  };
}

/** Generic API response wrapper. */
interface ApiResponse<T> {
  data: T;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const assignmentKeys = {
  all: ["assignments"] as const,
  lists: () => [...assignmentKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...assignmentKeys.lists(), filters] as const,
  details: () => [...assignmentKeys.all, "detail"] as const,
  detail: (id: string) => [...assignmentKeys.details(), id] as const,
  submissions: (id: string) => [...assignmentKeys.all, "submissions", id] as const,
  generation: (jobId: string) => [...assignmentKeys.all, "generate", jobId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch assignments (role-aware — students/parents only see published ones
 * scoped to their grade). Optionally filter by grade/academic year/subject/status.
 */
export function useAssignments(filters?: {
  gradeId?: string;
  academicYearId?: string;
  subjectId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: assignmentKeys.list(filters ?? {}),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.gradeId) params.gradeId = filters.gradeId;
      if (filters?.academicYearId) params.academicYearId = filters.academicYearId;
      if (filters?.subjectId) params.subjectId = filters.subjectId;
      if (filters?.status) params.status = filters.status;
      const response = await api.get<ApiResponse<Assignment[]>>(
        "/api/assignments",
        { params },
      );
      return response.data.data;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch a single assignment by ID.
 */
export function useAssignment(id?: string) {
  return useQuery({
    queryKey: assignmentKeys.detail(id ?? "none"),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Assignment>>(
        `/api/assignments/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch all submissions for an assignment (staff view).
 */
export function useAssignmentSubmissions(assignmentId?: string) {
  return useQuery({
    queryKey: assignmentKeys.submissions(assignmentId ?? "none"),
    queryFn: async () => {
      const response = await api.get<ApiResponse<AssignmentSubmission[]>>(
        `/api/assignments/${assignmentId}/submissions`,
      );
      return response.data.data;
    },
    enabled: !!assignmentId,
    staleTime: 15 * 1000,
  });
}

/**
 * Start AI question-draft generation for a grade (runs async via Inngest).
 * Returns a jobId — poll it with useGenerationJob until it completes.
 */
export function useGenerateAssignment() {
  return useMutation({
    mutationFn: async (payload: {
      gradeId: string;
      academicYearId: string;
      subjectId?: string;
      topic?: string;
      difficulty?: string;
      questionCount?: number;
      type?: AssignmentType;
    }) => {
      const response = await api.post<
        ApiResponse<{ jobId: string; message: string }>
      >("/api/assignments/generate", payload);
      return response.data.data;
    },
    onError: (error: any) => {
      toast.error("AI generation failed", {
        description:
          error?.response?.data?.error?.message ?? error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Poll the state of an async question-generation job.
 * Stops polling automatically once the job reaches a terminal state, and
 * gives up (reports "failed") if the job is still pending after maxWaitMs
 * — e.g. the Inngest run was killed or every retry failed — so the UI never
 * polls forever.
 */
export function useGenerationJob(jobId?: string, maxWaitMs = 120_000) {
  // When polling began for the current job, used to enforce the max wait.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (jobId) startedAtRef.current = Date.now();
  }, [jobId]);

  return useQuery({
    queryKey: assignmentKeys.generation(jobId ?? "none"),
    queryFn: async () => {
      const response = await api.get<ApiResponse<GenerationJobStatus>>(
        `/api/assignments/generate/${jobId}`,
      );
      const job = response.data.data;
      // Safety net: a job stuck in "pending" past the max wait is reported
      // as failed so the dialog can surface a retry instead of hanging.
      const startedAt = startedAtRef.current ?? Date.now();
      if (job.status === "pending" && Date.now() - startedAt > maxWaitMs) {
        return {
          ...job,
          status: "failed" as const,
          error: "Generation is taking too long. Please try again.",
        };
      }
      return job;
    },
    enabled: !!jobId,
    refetchInterval: (query) =>
      query.state.data?.status === "completed" ||
      query.state.data?.status === "failed"
        ? false
        : 1500,
  });
}

/** State of an async generation job surfaced by GET /generate/:jobId. */
export interface GenerationJobStatus {
  jobId: string;
  status: "pending" | "completed" | "failed";
  questions?: AssignmentQuestion[];
  error?: string;
}

/**
 * Create a new assignment.
 */
export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      type: AssignmentType;
      status?: AssignmentStatus;
      gradeId: string;
      academicYearId: string;
      subjectId?: string;
      questions: AssignmentQuestion[];
      dueDate?: string;
    }) => {
      const response = await api.post<ApiResponse<Assignment>>(
        "/api/assignments",
        payload,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
      toast.success("Assignment created", {
        description: `"${data.title}" has been created.`,
      });
    },
    onError: (error: any) => {
      toast.error("Failed to create assignment", {
        description:
          error?.response?.data?.error?.message ?? error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Update an existing assignment.
 */
export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        title: string;
        description: string;
        type: AssignmentType;
        status: AssignmentStatus;
        subjectId: string | null;
        questions: AssignmentQuestion[];
        dueDate: string | null;
      }>;
    }) => {
      const response = await api.patch<ApiResponse<Assignment>>(
        `/api/assignments/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.detail(data.id),
      });
      toast.success("Assignment updated", {
        description: `"${data.title}" has been updated.`,
      });
    },
    onError: (error: any) => {
      toast.error("Failed to update assignment", {
        description:
          error?.response?.data?.error?.message ?? error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Delete an assignment.
 */
export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
      toast.success("Assignment deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete assignment", {
        description:
          error?.response?.data?.error?.message ?? error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Student submits answers — WITH_ANSWERS assignments return instant
 * AI-graded results (score + per-question feedback).
 */
export function useSubmitAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      answers,
    }: {
      id: string;
      answers: Array<{ questionId: string; answer: string }>;
    }) => {
      const response = await api.post<ApiResponse<AssignmentSubmission>>(
        `/api/assignments/${id}/submit`,
        { answers },
      );
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(variables.id),
      });
      if (data.status === "GRADED") {
        toast.success("Assignment graded!", {
          description: `You scored ${data.score}/${data.totalPoints}.`,
        });
      } else {
        toast.success("Assignment submitted", {
          description: "Your teacher will grade it shortly.",
        });
      }
    },
    onError: (error: any) => {
      toast.error("Failed to submit assignment", {
        description:
          error?.response?.data?.error?.message ?? error.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Manually grade a submission (teacher).
 */
export function useGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      score,
      feedback,
    }: {
      submissionId: string;
      score: number;
      feedback?: QuestionFeedback[];
    }) => {
      const response = await api.patch<ApiResponse<AssignmentSubmission>>(
        `/api/assignments/submissions/${submissionId}`,
        { score, feedback },
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.submissions(data.assignmentId),
      });
      toast.success("Submission graded", {
        description: `Score: ${data.score}/${data.totalPoints}`,
      });
    },
    onError: (error: any) => {
      toast.error("Failed to grade submission", {
        description:
          error?.response?.data?.error?.message ?? error.message ?? "Please try again.",
      });
    },
  });
}
