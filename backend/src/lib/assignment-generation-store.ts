/**
 * Assignment Generation Job Store
 *
 * In-memory store that holds the outcome of an async AI question-generation
 * job. The flow mirrors the timetable feature:
 *
 *   1. POST /api/assignments/generate creates a jobId, fires the Inngest
 *      "assignments/generate" event and returns the jobId immediately (202).
 *   2. The Inngest function performs the Gemini call in the background and
 *      writes the generated questions (or an error) back to this store.
 *   3. The client polls GET /api/assignments/generate/:jobId until the job
 *      reaches a terminal state ("completed" | "failed").
 *
 * Because the Inngest serve handler runs inside the same Express process
 * (see server.ts), a module-level Map is shared between the controller and
 * the function. This is suitable for the current single-instance deployment;
 * if the API ever scales horizontally this store should be swapped for a
 * shared cache (e.g. Redis).
 *
 * @module lib/assignment-generation-store
 */

import { randomUUID } from "node:crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single generated question. answerKey only present for WITH_ANSWERS type. */
export interface GeneratedQuestion {
  id: string;
  question: string;
  points: number;
  answerKey?: string;
}

/** Job states surfaced to the polling client. */
export type GenerationJobStatus = "pending" | "completed" | "failed";

export interface GenerationJob {
  jobId: string;
  status: GenerationJobStatus;
  questions?: GeneratedQuestion[];
  error?: string;
  createdAt: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Jobs are evicted 30 minutes after creation (drafts the teacher never saves). */
const TTL_MS = 30 * 60 * 1000;

// ─── Internal state ─────────────────────────────────────────────────────────

const jobs = new Map<string, GenerationJob>();

/** Lazily removes expired entries on access. */
const sweepExpired = (): void => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > TTL_MS) {
      jobs.delete(id);
    }
  }
};

// ─── Store API ──────────────────────────────────────────────────────────────

export const assignmentGenerationStore = {
  /**
   * Creates a pending job and returns its unique id.
   * The Inngest function resolves it via complete()/fail().
   */
  create(): string {
    const jobId = randomUUID();
    jobs.set(jobId, { jobId, status: "pending", createdAt: Date.now() });
    return jobId;
  },

  /** Marks the job as successfully generated with its question draft. */
  complete(jobId: string, questions: GeneratedQuestion[]): void {
    jobs.set(jobId, {
      jobId,
      status: "completed",
      questions,
      createdAt: Date.now(),
    });
  },

  /** Marks the job as failed with a human-readable error message. */
  fail(jobId: string, error: string): void {
    jobs.set(jobId, {
      jobId,
      status: "failed",
      error,
      createdAt: Date.now(),
    });
  },

  /** Returns the current job state (or undefined if unknown/expired). */
  get(jobId: string): GenerationJob | undefined {
    sweepExpired();
    return jobs.get(jobId);
  },
};
