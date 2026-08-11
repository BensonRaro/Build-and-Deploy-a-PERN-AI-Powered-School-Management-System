/**
 * Activity Log Helper
 *
 * Provides a reusable `logActivity` function that can be called from anywhere
 * in the backend (middlewares, controllers, services) to record auditable
 * events in the ActivityLog table.
 *
 * Usage:
 *   import { logActivity } from "@/lib/activity-log.js";
 *
 *   // Log a simple event
 *   await logActivity({
 *     userId: session.user.id,
 *     activity: "grade:updated",
 *     details: "Updated grade 'A' — added math subject",
 *   });
 *
 *   // Log an event without details
 *   await logActivity({
 *     userId: req.user.id,
 *     activity: "auth:login",
 *   });
 */

import { prisma } from "./prisma.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Parameters accepted by the `logActivity` function. */
export interface LogActivityParams {
  /** ID of the user who performed the action. */
  userId: string;
  /**
   * Short, machine-readable activity identifier (e.g. "grade:updated",
   * "payment:created", "user:deleted").
   */
  activity: string;
  /** Optional human-readable context about what happened. */
  details?: string;
}

// ─── Logging Function ─────────────────────────────────────────────────────────

/**
 * Records an auditable event in the ActivityLog table.
 *
 * This is the single entry-point for all audit logging across the system.
 * It returns the created ActivityLog record so callers can inspect or
 * attach it to responses if needed.
 *
 * @param params - The activity event details.
 * @returns The newly created ActivityLog record.
 */
export async function logActivity(
  params: LogActivityParams,
): Promise<{
  id: string;
  userId: string;
  activity: string;
  details: string | null;
  createdAt: Date;
}> {
  const record = await prisma.activityLog.create({
    data: {
      userId: params.userId,
      activity: params.activity,
      details: params.details ?? null,
    },
    select: {
      id: true,
      userId: true,
      activity: true,
      details: true,
      createdAt: true,
    },
  });

  return record;
}

/**
 * Fire-and-forget audit logging.
 *
 * Records an auditable event WITHOUT blocking the request/response cycle.
 * Audit-log writes are deferred to the background and failures are logged
 * (never thrown), so CRUD endpoints don't pay an extra database round-trip
 * before responding — a meaningful latency win when the database is remote.
 *
 * Use this in request handlers where the audit entry is important but not
 * critical to the response. Example:
 *
 *   logActivityAsync({ userId, activity: "grade:updated", details: "..." });
 */
export function logActivityAsync(params: LogActivityParams): void {
  logActivity(params).catch((error) => {
    // Audit failures must never break the primary operation — log & move on.
    console.error("[activity-log] Failed to record activity:", error);
  });
}
