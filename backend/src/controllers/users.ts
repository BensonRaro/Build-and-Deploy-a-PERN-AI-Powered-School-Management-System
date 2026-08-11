/**
 * Users Controller
 *
 * Request handlers for User CRUD operations.
 * User creation uses Better Auth's admin API for proper password hashing
 * and account setup, then creates the corresponding profile (StudentProfile,
 * ParentProfile, or StaffProfile) via Prisma based on the user's role.
 *
 * Staff roles (TEACHER, PRINCIPAL, VICE_PRINCIPAL, SUPER_ADMIN, etc.)
 * get a StaffProfile. STUDENT and PARENT get their respective profiles.
 *
 * @module users/controller
 */

import type { Request, Response } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { fromNodeHeaders } from "better-auth/node";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
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
 * Staff roles that get a StaffProfile.
 */
const STAFF_ROLES = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "TEACHER",
  "LIBRARIAN",
  "ACCOUNTANT",
  "COUNSELOR",
  "STAFF",
] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

const isStaffRole = (role: string): role is StaffRole =>
  STAFF_ROLES.includes(role as StaffRole);

/**
 * Slimmed student-profile include — only the fields the frontend reads.
 * Keeping this to a `select` avoids over-fetching the full StudentProfile
 * row (plus nested relations) for every user in a list response.
 */
const studentProfileInclude = {
  select: {
    id: true,
    gradeId: true,
    academicYearId: true,
    admissionNumber: true,
    dateOfBirth: true,
    gender: true,
    bloodGroup: true,
    address: true,
    grade: { select: { id: true, name: true, section: true } },
    academicYear: { select: { id: true, name: true } },
  },
} as const;

/**
 * Base Prisma include for fetching user profiles.
 * Used in get/create/update endpoints to attach profile data.
 */
const userInclude = {
  studentProfile: studentProfileInclude,
  parentProfile: true,
  staffProfile: true,
} as const;

/**
 * Role-aware include for the list endpoint.
 *
 * When a `?role=` filter is active, every returned user can only ever carry
 * the matching profile type — so we only fetch that one instead of all three
 * (student + parent + staff), cutting the payload substantially for the
 * Students / Teachers / Parents / Staff tables.
 */
const listUserInclude = (role?: string): Prisma.UserInclude => {
  if (role === "STUDENT") return { studentProfile: studentProfileInclude };
  if (role === "PARENT") return { parentProfile: true };
  if ((STAFF_ROLES as readonly string[]).includes(role ?? "")) {
    return { staffProfile: true };
  }
  return userInclude;
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/users
 *
 * Returns all non-deleted users with their profile data.
 * Optionally filtered via query params:
 *   ?role=STUDENT       — filter by role
 *   ?academicYearId=    — filter students by academic year
 *   ?gradeId=           — filter students by grade
 *   ?search=john        — search by name or email (case-insensitive contains)
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, STAFF — can also read
 */
export const listUsers = async (req: Request, res: Response) => {
  try {
    const role = asStr(req.query.role);
    const academicYearId = asStr(req.query.academicYearId);
    const gradeId = asStr(req.query.gradeId);
    const search = asStr(req.query.search);

    // Build Prisma where clause
    const where: Record<string, unknown> = {
      deletedAt: null, // exclude soft-deleted users
    };

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by academic year or grade — applies to student profiles
    if (academicYearId || gradeId) {
      where.studentProfile =
        academicYearId && gradeId
          ? { academicYearId, gradeId }
          : academicYearId
            ? { academicYearId }
            : { gradeId };
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // Role-aware include — only fetch the profile type the filtered
      // list can contain (big payload win for role-filtered tables).
      include: listUserInclude(role),
    });

    return res.json({ data: users });
  } catch (error) {
    console.error("[Users] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve users.",
      },
    });
  }
};

/**
 * GET /api/users/:id
 *
 * Returns a single non-deleted user with their profile data.
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "User ID is required." },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: userInclude,
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    return res.json({ data: user });
  } catch (error) {
    console.error("[Users] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve user.",
      },
    });
  }
};

/**
 * POST /api/users
 *
 * Creates a new user with Better Auth (handles password hashing),
 * then creates the corresponding profile via Prisma.
 *
 * Body (common):
 *   name      (string, required)  — user's full name
 *   email     (string, required)  — unique email address
 *   password  (string, required)  — login password
 *   role      (string, required)  — one of the Role enum values
 *   image     (string, optional)  — avatar/profile image URL
 *
 * Body (profile — varies by role):
 *
 * For role = STUDENT:
 *   profile.gradeId         (string, required) — ID of the grade
 *   profile.academicYearId  (string, required) — ID of the academic year
 *   profile.dateOfBirth     (string, required) — ISO 8601 date
 *   profile.gender          (string, required) — e.g. "Male", "Female"
 *   profile.bloodGroup      (string, optional)
 *   profile.address         (string, optional)
 *   Admission number is AUTO-GENERATED as: {GradeName}/{count}/{yearSuffix}
 *
 * For role = PARENT:
 *   profile.phone      (string, required) — contact phone number
 *   profile.occupation (string, optional)
 *   profile.address    (string, optional)
 *
 * For staff roles (TEACHER, PRINCIPAL, etc.):
 *   profile.department   (string, optional)
 *   profile.qualification (string, optional)
 *   profile.joiningDate  (string, required) — ISO 8601 date
 *   Employee ID is AUTO-GENERATED as: EMP/{count}/{yearSuffix}
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, image, profile } = req.body;

    // ── Validate common required fields ───────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name is required and must be a non-empty string.",
        },
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required and must be a non-empty string.",
        },
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Password is required and must be at least 6 characters.",
        },
      });
    }

    if (!role || typeof role !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Role is required.",
        },
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // ── Step 1: Create the auth user via Better Auth ──────────────────
    // Better Auth handles password hashing and creates the User + Account records.
    let authUser: { id: string; name: string; email: string; role: string };
    try {
      const result = await auth.api.createUser({
        body: {
          name: trimmedName,
          email: trimmedEmail,
          password,
          role: role as any,
        },
        headers: fromNodeHeaders(req.headers),
      });
      authUser = result.user as { id: string; name: string; email: string; role: string };
    } catch (baError: any) {
      // Better Auth error codes for duplicate email
      if (
        baError?.body?.code === "USER_ALREADY_EXISTS" ||
        baError?.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
      ) {
        return res.status(409).json({
          error: {
            code: "CONFLICT",
            message: `A user with email "${trimmedEmail}" already exists.`,
          },
        });
      }

      console.error("[Users] Better Auth create error:", baError);
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create user account. Please try again.",
        },
      });
    }

    // ── Step 2: Create the profile based on role ──────────────────────
    try {
      if (role === "STUDENT") {
        await createStudentProfile(authUser.id, profile);
      } else if (role === "PARENT") {
        await createParentProfile(authUser.id, profile);
      } else if (isStaffRole(role)) {
        await createStaffProfile(authUser.id, profile);
      }
      // SUPER_ADMIN or other roles without profiles are fine without one
    } catch (profileError: any) {
      // Profile creation failed — roll back the user account
      await auth.api.removeUser({
        body: { userId: authUser.id },
        headers: fromNodeHeaders(req.headers),
      }).catch(() => {
        // Silently ignore cleanup failures — log for monitoring
        console.error("[Users] Failed to clean up user after profile error:", authUser.id);
      });

      if (profileError.code === "P2002") {
        return res.status(409).json({
          error: {
            code: "CONFLICT",
            message: `A profile with this ${profileError?.meta?.target?.join(", ") ?? "value"} already exists.`,
          },
        });
      }

      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: profileError.message ?? "Invalid profile data.",
        },
      });
    }

    // ── Fetch the complete user with profile ──────────────────────────
    const createdUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: userInclude,
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      const roleLabel = role === "STUDENT" ? "student" : role === "PARENT" ? "parent" : "staff";
      logActivityAsync({
        userId,
        activity: "user:created",
        details: `Created ${roleLabel} user "${trimmedName}" (${trimmedEmail}) with role ${role}`,
      });
    }

    return res.status(201).json({ data: createdUser });
  } catch (error) {
    console.error("[Users] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create user.",
      },
    });
  }
};

/**
 * PATCH /api/users/:id
 *
 * Updates an existing user's auth-level fields and/or profile fields.
 * For password updates, use Better Auth's setUserPassword endpoint.
 *
 * Body (all optional):
 *   name      (string)  — new name
 *   email     (string)  — new email
 *   role      (string)  — new role
 *   image     (string)  — new avatar URL
 *   profile   (object)  — profile fields based on the user's role
 *
 * Note: Changing a user's role does NOT automatically change their profile type.
 * Profile updates only work for the profile type that matches the user's role.
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "User ID is required." },
      });
    }

    // ── Verify user exists (not soft-deleted) ─────────────────────────
    const existing = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: userInclude,
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    const { name, email, role, image, profile } = req.body;

    // ── Build user-level update payload ───────────────────────────────
    const userData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Name must be a non-empty string.",
          },
        });
      }
      userData.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Email must be a non-empty string.",
          },
        });
      }
      userData.email = email.trim().toLowerCase();
    }

    if (role !== undefined) {
      if (typeof role !== "string") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Role must be a string.",
          },
        });
      }
      userData.role = role;
    }

    if (image !== undefined) {
      userData.image = image;
    }

    // ── Update user-level fields ──────────────────────────────────────
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userData as any,
      });
    }

    // ── Update profile fields ─────────────────────────────────────────
    if (profile && typeof profile === "object") {
      const currentRole = role ?? existing.role;

      if (currentRole === "STUDENT") {
        await updateStudentProfile(id, profile);
      } else if (currentRole === "PARENT") {
        await updateParentProfile(id, profile);
      } else if (isStaffRole(currentRole)) {
        await updateStaffProfile(id, profile);
      }
    }

    // ── Fetch the updated user ────────────────────────────────────────
    const updated = await prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      const changes = Object.keys(userData).length > 0
        ? Object.keys(userData).map((k) => `${k}: ${JSON.stringify(userData[k])}`).join(", ")
        : "profile updated";
      logActivityAsync({
        userId,
        activity: "user:updated",
        details: `Updated user "${existing.name}" (${existing.email}) — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = error?.meta?.target as string[] | undefined;
      const field = target?.join(", ") ?? "unknown";
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `A user with this ${field} already exists.`,
        },
      });
    }

    console.error("[Users] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update user.",
      },
    });
  }
};

/**
 * DELETE /api/users/:id
 *
 * Soft-deletes a user by setting `deletedAt`. This preserves audit trails  * and prevents data loss in related records (grades, payments).
 * SUPER_ADMIN or PRINCIPAL only.
 *
 * Query params:
 *   ?permanent=true  — permanently removes the user via Better Auth
 *                      (use with caution, destroys all related data)
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "User ID is required." },
      });
    }

    const permanent = req.query.permanent === "true";

    // ── Verify user exists ────────────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found or already deleted.",
        },
      });
    }

    if (permanent) {
      // Permanent delete via Better Auth (hard delete)
      await auth.api.removeUser({
        body: { userId: id },
        headers: fromNodeHeaders(req.headers),
      });
    } else {
      // Soft delete — mark as deleted
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: permanent ? "user:permanently-deleted" : "user:soft-deleted",
        details: `${permanent ? "Permanently deleted" : "Soft-deleted"} user "${existing.name}" (${existing.email}) — role: ${existing.role}`,
      });
    }

    return res.json({
      message: permanent
        ? `User "${existing.name}" permanently deleted.`
        : `User "${existing.name}" soft-deleted.`,
    });
  } catch (error) {
    console.error("[Users] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete user.",
      },
    });
  }
};

// ─── Profile Creation Helpers ──────────────────────────────────────────────────

/**
 * Generates an auto-incrementing admission number for a student.
 *
 * Format: {GradeNamePrefix}/{sequentialCount}/{academicYearLast2Digits}
 *   e.g. "Grade-10/5/26" for the 5th student in Grade 10, academic year 2026-2027
 *
 * Accepts pre-fetched grade name and academic year name to avoid redundant DB queries.
 */
async function generateAdmissionNumber(
  gradeId: string,
  academicYearId: string,
  gradeName: string,
  academicYearName: string,
): Promise<string> {
  // Sanitize grade name: replace non-alphanumeric chars with hyphens, collapse runs
  const gradePrefix = gradeName.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  // Count existing students in this grade + academic year
  const existingCount = await prisma.studentProfile.count({
    where: { gradeId, academicYearId },
  });
  const count = existingCount + 1;

  // Extract first 4-digit year from the academic year name (e.g. "2026-2027" → "2026" → "26")
  const yearMatch = academicYearName.match(/(\d{4})/);
  const yearSuffix = yearMatch?.[1] ?? new Date().getFullYear().toString().slice(-2);

  return `${gradePrefix}/${count}/${yearSuffix}`;
}

/**
 * Validates and creates a StudentProfile for a given user.
 *
 * Expected profile shape:
 *   gradeId, academicYearId, dateOfBirth, gender,
 *   bloodGroup?, address?
 *
 * admissionNumber is auto-generated as {gradeName}/{count}/{year}.
 */
async function createStudentProfile(
  userId: string,
  profile: any,
) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Profile data is required for student users.");
  }

  const { gradeId, academicYearId, dateOfBirth, gender, bloodGroup, address } = profile;

  // Validate required fields
  if (!gradeId || typeof gradeId !== "string") throw new Error("profile.gradeId is required.");
  if (!academicYearId || typeof academicYearId !== "string") throw new Error("profile.academicYearId is required.");
  if (!dateOfBirth) throw new Error("profile.dateOfBirth is required.");
  if (!gender || typeof gender !== "string" || !gender.trim()) throw new Error("profile.gender is required.");

  const parsedDob = new Date(dateOfBirth);
  if (Number.isNaN(parsedDob.getTime())) {
    throw new Error("profile.dateOfBirth must be a valid ISO 8601 date.");
  }

  // Verify grade exists & get name for admission number generation
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { id: true, name: true },
  });
  if (!grade) throw new Error("Grade not found.");

  // Verify academic year exists & get name for admission number generation
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true, name: true },
  });
  if (!academicYear) throw new Error("Academic year not found.");

  // ── Auto-generate admission number (pass pre-fetched names to avoid redundant queries) ──
  const admissionNumber = await generateAdmissionNumber(
    gradeId,
    academicYearId,
    grade.name,
    academicYear.name,
  );

  await prisma.studentProfile.create({
    data: {
      userId,
      gradeId,
      academicYearId,
      admissionNumber,
      dateOfBirth: parsedDob,
      gender: gender.trim(),
      bloodGroup: (bloodGroup as string | null | undefined) ?? null,
      address: (address as string | null | undefined) ?? null,
    },
  });
}

/**
 * Validates and creates a ParentProfile for a given user.
 *
 * Expected profile shape:
 *   phone, occupation?, address?
 */
async function createParentProfile(
  userId: string,
  profile: any,
) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Profile data is required for parent users.");
  }

  const { phone, occupation, address } = profile;

  if (!phone || typeof phone !== "string" || !phone.trim()) {
    throw new Error("profile.phone is required and must be a non-empty string.");
  }

  await prisma.parentProfile.create({
    data: {
      userId,
      phone: phone.trim(),
      occupation: (occupation as string | null | undefined) ?? null,
      address: (address as string | null | undefined) ?? null,
    },
  });
}

/**
 * Generates an auto-incrementing employee ID for a staff member.
 *
 * Format: EMP/{sequentialCount}/{currentYearLast2Digits}
 *   e.g. "EMP/12/26" for the 12th staff member in 2026
 *
 * The count is the total number of existing StaffProfile records + 1.
 * Year is the last 2 digits of the current calendar year.
 */
async function generateEmployeeId(): Promise<string> {
  const existingCount = await prisma.staffProfile.count();
  const count = existingCount + 1;
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  return `EMP/${count}/${yearSuffix}`;
}

/**
 * Validates and creates a StaffProfile for a given user.
 *
 * Expected profile shape:
 *   department?, qualification?, joiningDate
 *
 * employeeId is auto-generated as EMP/{count}/{year}.
 */
async function createStaffProfile(
  userId: string,
  profile: any,
) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Profile data is required for staff users.");
  }

  const { department, qualification, joiningDate } = profile;

  if (!joiningDate) throw new Error("profile.joiningDate is required.");

  const parsedDate = new Date(joiningDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("profile.joiningDate must be a valid ISO 8601 date.");
  }

  // ── Auto-generate employee ID ────────────────────────────────────────────
  const employeeId = await generateEmployeeId();

  await prisma.staffProfile.create({
    data: {
      userId,
      employeeId,
      department: (department as string | null | undefined) ?? null,
      qualification: (qualification as string | null | undefined) ?? null,
      joiningDate: parsedDate,
    },
  });
}

// ─── Profile Update Helpers ───────────────────────────────────────────────────

/**
 * Updates a StudentProfile for the given user.
 * Only updates fields that are provided.
 */
async function updateStudentProfile(
  userId: string,
  profile: any,
) {
  const data: Record<string, any> = {};

  if (profile.gradeId !== undefined) data.gradeId = profile.gradeId;
  if (profile.academicYearId !== undefined) data.academicYearId = profile.academicYearId;
  if (profile.admissionNumber !== undefined) data.admissionNumber = profile.admissionNumber;
  if (profile.gender !== undefined) data.gender = profile.gender;
  if (profile.bloodGroup !== undefined) data.bloodGroup = profile.bloodGroup;
  if (profile.address !== undefined) data.address = profile.address;

  if (profile.dateOfBirth !== undefined) {
    const parsed = new Date(profile.dateOfBirth);
    if (Number.isNaN(parsed.getTime())) throw new Error("profile.dateOfBirth must be a valid date.");
    data.dateOfBirth = parsed;
  }

  if (Object.keys(data).length > 0) {
    await prisma.studentProfile.update({
      where: { userId },
      data: data as any,
    });
  }
}

/**
 * Updates a ParentProfile for the given user.
 */
async function updateParentProfile(
  userId: string,
  profile: any,
) {
  const data: Record<string, any> = {};

  if (profile.phone !== undefined) data.phone = profile.phone;
  if (profile.occupation !== undefined) data.occupation = profile.occupation;
  if (profile.address !== undefined) data.address = profile.address;

  if (Object.keys(data).length > 0) {
    await prisma.parentProfile.update({
      where: { userId },
      data: data as any,
    });
  }
}

/**
 * Updates a StaffProfile for the given user.
 */
async function updateStaffProfile(
  userId: string,
  profile: any,
) {
  const data: Record<string, any> = {};

  if (profile.employeeId !== undefined) data.employeeId = profile.employeeId;
  if (profile.department !== undefined) data.department = profile.department;
  if (profile.qualification !== undefined) data.qualification = profile.qualification;

  if (profile.joiningDate !== undefined) {
    const parsed = new Date(profile.joiningDate);
    if (Number.isNaN(parsed.getTime())) throw new Error("profile.joiningDate must be a valid date.");
    data.joiningDate = parsed;
  }

  if (Object.keys(data).length > 0) {
    await prisma.staffProfile.update({
      where: { userId },
      data: data as any,
    });
  }
}
