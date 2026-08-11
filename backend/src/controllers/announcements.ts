/**
 * Announcements Controller
 *
 * Request handlers for Announcement CRUD operations.
 * Announcements are broadcast messages that can be targeted to specific
 * roles (e.g. only TEACHER, or both STUDENT and PARENT). Each announcement
 * is authored by a User (typically a SUPER_ADMIN, PRINCIPAL, or VICE_PRINCIPAL).
 *
 * @module announcements/controller
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { logActivityAsync } from "../lib/activity-log.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely extracts a string value from Express v5's multi-type params/query.
 */
const asStr = (val: unknown): string | undefined => {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  if (val) return String(val);
  return undefined;
};

/**
 * Returns the authenticated user's ID from the request.
 * `req.user` is attached by the `requireAuth` middleware.
 */
const getUserId = (req: Request): string | null => req.user?.id ?? null;

/**
 * All valid Role enum values — used to validate targetRoles input.
 */
const VALID_ROLES = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "TEACHER",
  "LIBRARIAN",
  "ACCOUNTANT",
  "COUNSELOR",
  "STAFF",
  "STUDENT",
  "PARENT",
] as const;

/**
 * Normalizes and validates target role strings.
 * Returns the validated & normalized role array, or throws a 400 response.
 */
const normalizeRoles = (
  roles: unknown[],
): { error: { code: string; message: string } } | { normalized: string[] } => {
  if (!Array.isArray(roles) || roles.length === 0) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message:
          "targetRoles must be a non-empty array of role strings (e.g. ['TEACHER', 'STUDENT']).",
      },
    } as const;
  }

  const normalized: string[] = [];
  for (const role of roles) {
    if (typeof role !== "string") {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Each targetRole must be a string.",
        },
      };
    }
    const normalizedRole = role.toUpperCase().trim();
    if (!(VALID_ROLES as readonly string[]).includes(normalizedRole)) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid role: "${role}". Valid roles are: ${VALID_ROLES.join(", ")}.`,
        },
      };
    }
    normalized.push(normalizedRole);
  }

  return { normalized };
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/announcements
 *
 * Returns all announcements, ordered by most recent first.
 * Optionally filtered via query params:
 *   ?authorId=<id>    — filter by author
 *   ?targetRole=<role> — filter to announcements targeting a specific role
 *   ?search=<term>    — search title/content (case-insensitive, simple contains)
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, LIBRARIAN, ACCOUNTANT, COUNSELOR, STAFF, STUDENT, PARENT — can also read
 */
export const listAnnouncements = async (req: Request, res: Response) => {
  try {
    const authorId = asStr(req.query.authorId);
    const targetRole = asStr(req.query.targetRole);
    const search = asStr(req.query.search);

    const where: Record<string, unknown> = {};

    if (authorId) {
      where.authorId = authorId;
    }

    if (targetRole) {
      // Filter announcements that contain the target role in their targetRoles array
      where.targetRoles = { has: targetRole };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return res.json({ data: announcements });
  } catch (error) {
    console.error("[Announcements] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve announcements.",
      },
    });
  }
};

/**
 * GET /api/announcements/:id
 *
 * Returns a single announcement with its author details.
 */
export const getAnnouncement = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Announcement ID is required." },
      });
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
    });

    if (!announcement) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Announcement not found.",
        },
      });
    }

    return res.json({ data: announcement });
  } catch (error) {
    console.error("[Announcements] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve announcement.",
      },
    });
  }
};

/**
 * POST /api/announcements
 *
 * Creates a new announcement. The authenticated user is set as the author.
 *
 * Body:
 *   title        (string, required)  — announcement headline
 *   content      (string, required)  — announcement body / message
 *   targetRoles  (string[], required) — array of roles to target (e.g. ["TEACHER", "STUDENT"])
 *                           Must include at least one valid Role enum value.
 */
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const { title, content, targetRoles } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Title is required and must be a non-empty string.",
        },
      });
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Content is required and must be a non-empty string.",
        },
      });
    }

    if (!Array.isArray(targetRoles) || targetRoles.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "targetRoles is required and must be a non-empty array of role strings (e.g. ['TEACHER', 'STUDENT']).",
        },
      });
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    // ── Validate each target role is a valid Role enum value ──────────
    const roleResult = normalizeRoles(targetRoles);
    if ("error" in roleResult) {
      return res.status(400).json({ error: roleResult.error });
    }
    const normalizedRoles = roleResult.normalized;

    // ── Get the authenticated user's ID ───────────────────────────────
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required to create announcements.",
        },
      });
    }

    // ── Create the announcement ───────────────────────────────────────
    const announcement = await prisma.announcement.create({
      data: {
        title: trimmedTitle,
        content: trimmedContent,
        targetRoles: normalizedRoles as any, // Prisma accepts the Role[] enum
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    logActivityAsync({
      userId,
      activity: "announcement:created",
      details: `Created announcement "${trimmedTitle}" targeting ${normalizedRoles.join(", ")}`,
    });

    return res.status(201).json({ data: announcement });
  } catch (error) {
    console.error("[Announcements] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create announcement.",
      },
    });
  }
};

/**
 * PATCH /api/announcements/:id
 *
 * Updates an existing announcement. Only the author or a SUPER_ADMIN/PRINCIPAL
 * should be allowed (role-based guard on the route level).
 *
 * Body (all optional):
 *   title        (string)   — new headline
 *   content      (string)   — new body
 *   targetRoles  (string[]) — new target roles array
 */
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Announcement ID is required." },
      });
    }

    // ── Verify announcement exists ────────────────────────────────────
    const existing = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Announcement not found.",
        },
      });
    }

    const { title, content, targetRoles } = req.body;

    let normalizedRoles: string[] | undefined;

    if (targetRoles !== undefined) {
      const roleResult = normalizeRoles(targetRoles);
      if ("error" in roleResult) {
        return res.status(400).json({ error: roleResult.error });
      }
      normalizedRoles = roleResult.normalized;
    }

    // ── Build update payload ──────────────────────────────────────────
    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Title must be a non-empty string.",
          },
        });
      }
      data.title = title.trim();
    }

    if (content !== undefined) {
      if (typeof content !== "string" || !content.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Content must be a non-empty string.",
          },
        });
      }
      data.content = content.trim();
    }

    if (normalizedRoles !== undefined) {
      data.targetRoles = normalizedRoles;
    }

    // ── Update ────────────────────────────────────────────────────────
    const updated = await prisma.announcement.update({
      where: { id },
      data,
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      const changes = Object.keys(data)
        .map((k) => `${k}: ${JSON.stringify(data[k])}`)
        .join(", ");
      logActivityAsync({
        userId,
        activity: "announcement:updated",
        details: `Updated announcement "${existing.title}" — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error("[Announcements] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update announcement.",
      },
    });
  }
};

/**
 * DELETE /api/announcements/:id
 *
 * Permanently deletes an announcement. SUPER_ADMIN or PRINCIPAL only.
 */
export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Announcement ID is required." },
      });
    }

    // ── Verify existence ──────────────────────────────────────────────
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { name: true } },
      },
    });

    if (!announcement) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Announcement not found.",
        },
      });
    }

    await prisma.announcement.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "announcement:deleted",
        details: `Deleted announcement "${announcement.title}" by ${announcement.author.name}`,
      });
    }

    return res.json({
      message: `Announcement "${announcement.title}" deleted successfully.`,
    });
  } catch (error) {
    console.error("[Announcements] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete announcement.",
      },
    });
  }
};
