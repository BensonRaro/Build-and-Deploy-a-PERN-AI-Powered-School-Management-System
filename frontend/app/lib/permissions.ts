/**
 * Permissions & Role Definitions for Better Auth RBAC
 *
 * Defines the application's access control resources, actions, and role-based
 * permissions using Better Auth's createAccessControl utility.
 *
 * Each role maps to the `Role` enum values in the Prisma schema:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, LIBRARIAN,
 *   ACCOUNTANT, COUNSELOR, STAFF, STUDENT, PARENT
 *
 * Usage:
 *   import { ac, superAdmin, hasPermission } from "./permissions.js";
 *   admin({ ac, roles: { SUPER_ADMIN: superAdmin, ... } });
 *
 *   // Check a specific permission directly (no API call needed)
 *   hasPermission(req.user.role, "fees", ["read"]);
 */

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

// ─── Resources & Actions ─────────────────────────────────────────────────────

/**
 * Define custom resources and their available actions.
 * `defaultStatements` includes the built-in "user" resource with actions
 * like create, list, set-role, ban, impersonate, etc.
 */
const statement = {
  // Retain default admin plugin resource (user management)
  ...defaultStatements,

  // School Management Resources — each with full CRUD
  "activity-logs": ["create", "read", "update", "delete"],
  "academic-years": ["create", "read", "update", "delete"],
  students: ["create", "read", "update", "delete"],
  teachers: ["create", "read", "update", "delete"],
  grades: ["create", "read", "update", "delete"],
  subjects: ["create", "read", "update", "delete"],
  assessments: ["create", "read", "update", "delete"],
  assignments: ["create", "read", "update", "delete"],
  fees: ["create", "read", "update", "delete"],
  timetable: ["create", "read", "update", "delete"],
  announcements: ["create", "read", "update", "delete"],
  reports: ["create", "read", "update", "delete"],
  settings: ["create", "read", "update", "delete"],
} as const;

// Create the access control instance from our statement definition
export const ac = createAccessControl(statement);

/** Union type of all valid resource names. */
export type Resource = keyof typeof statement;

/** Union type of all valid action names across all resources. */
export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "list"
  | "set-role"
  | "ban"
  | "impersonate"
  | "impersonate-admins"
  | "set-password"
  | "set-email"
  | "get"
  | "revoke";

// ─── Role Definitions ─────────────────────────────────────────────────────────

/**
 * SUPER_ADMIN — Full system access. Can manage users, roles, and all resources.
 */
export const superAdmin = ac.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
  "activity-logs": ["create", "read", "update", "delete"],
  "academic-years": ["create", "read", "update", "delete"],
  students: ["create", "read", "update", "delete"],
  teachers: ["create", "read", "update", "delete"],
  grades: ["create", "read", "update", "delete"],
  subjects: ["create", "read", "update", "delete"],
  assessments: ["create", "read", "update", "delete"],
  assignments: ["create", "read", "update", "delete"],
  fees: ["create", "read", "update", "delete"],
  timetable: ["create", "read", "update", "delete"],
  announcements: ["create", "read", "update", "delete"],
  reports: ["create", "read", "update", "delete"],
  settings: ["create", "read", "update", "delete"],
});

/**
 * PRINCIPAL — School-wide administrative access. Full control over academic
 * operations but cannot manage system-level settings or sensitive user data.
 */
export const principal = ac.newRole({
  user: ["create", "list", "get", "update"],
  session: ["list", "revoke"],
  "activity-logs": ["read"],
  "academic-years": ["create", "read", "update"],
  students: ["create", "read", "update"],
  teachers: ["create", "read", "update"],
  grades: ["create", "read", "update"],
  subjects: ["create", "read", "update"],
  assessments: ["create", "read", "update"],
  assignments: ["create", "read", "update"],
  fees: ["create", "read", "update"],
  timetable: ["create", "read", "update"],
  announcements: ["create", "read", "update", "delete"],
  reports: ["create", "read"],
  settings: ["read"],
});

/**
 * VICE_PRINCIPAL — Similar to Principal but without teacher management
 * and restricted from modifying certain sensitive academic records.
 */
export const vicePrincipal = ac.newRole({
  user: ["list", "get"],
  session: ["list"],
  "activity-logs": ["read"],
  "academic-years": ["read"],
  students: ["create", "read", "update"],
  teachers: ["read"],
  grades: ["create", "read", "update"],
  subjects: ["create", "read", "update"],
  assessments: ["create", "read", "update"],
  assignments: ["create", "read", "update"],
  fees: ["read"],
  timetable: ["create", "read", "update"],
  announcements: ["create", "read", "update", "delete"],
  reports: ["create", "read"],
  settings: ["read"],
});

/**
 * TEACHER — Classroom-level access. Can manage assessments and
 * view student/class information.
 */
export const teacher = ac.newRole({
  "academic-years": ["read"],
  students: ["read"],
  assessments: ["create", "read", "update"],
  assignments: ["create", "read", "update"],
  timetable: ["read"],
  announcements: ["read"],
});

/**
 * LIBRARIAN — Library management access.
 */
export const librarian = ac.newRole({
  students: ["read"],
  reports: ["read"],
  announcements: ["read"],
});

/**
 * ACCOUNTANT — Financial operations access. Can manage fee structures,
 * invoices, and payments, and view financial reports.
 */
export const accountant = ac.newRole({
  students: ["read"],
  fees: ["create", "read", "update"],
  reports: ["read"],
  announcements: ["read"],
});

/**
 * COUNSELOR — Student support access. Can view student profiles and
 * manage counseling-related reports and assessments.
 */
export const counselor = ac.newRole({
  students: ["read", "update"],
  assessments: ["read"],
  assignments: ["read"],
  reports: ["create", "read"],
  announcements: ["read"],
});

/**
 * STAFF — General non-teaching staff. Basic read access to schedules
 * and announcements.
 */
export const staff = ac.newRole({
  "academic-years": ["read"],
  students: ["read"],
  timetable: ["read"],
  announcements: ["read"],
});

/**
 * STUDENT — Self-service access. Can view their own schedule, grades,
 * and announcements.
 */
export const student = ac.newRole({
  "academic-years": ["read"],
  timetable: ["read"],
  assessments: ["read"],
  assignments: ["read"],
  announcements: ["read"],
});

/**
 * PARENT — Guardian access. Can view their children's information,
 * grades, and school announcements.
 */
export const parent = ac.newRole({
  "academic-years": ["read"],
  assessments: ["read"],
  assignments: ["read"],
  announcements: ["read"],
  reports: ["read"],
});

// ─── Role Map ─────────────────────────────────────────────────────────────────
//
// Maps Prisma Role enum values to their access control definitions.
// Used by both the server-side auth config and client-side auth client.

export const roles = {
  SUPER_ADMIN: superAdmin,
  PRINCIPAL: principal,
  VICE_PRINCIPAL: vicePrincipal,
  TEACHER: teacher,
  LIBRARIAN: librarian,
  ACCOUNTANT: accountant,
  COUNSELOR: counselor,
  STAFF: staff,
  STUDENT: student,
  PARENT: parent,
} as const;

/** Union type of all valid role keys. */
export type Role = keyof typeof roles;

// ---------------------------------------------------------------------------
// All possible actions across every resource in the School Management System
// ---------------------------------------------------------------------------
export const allPermissions = [
  // CRUD
  "create",
  "read",
  "update",
  "delete",
  // Student lifecycle
  "enroll",
  "promote",
  "transfer",
  // Teacher / class
  "assign",
  // Grades
  "publish",
  // Fees
  "pay",
  "waive",
  // Events / announcements
  "publish",
  // Reports
  "view",
  "generate",
  "export",
  // User management
  "ban",
  "set-role",
  // Sessions
  "list",
  "revoke",
] as const;

export type Permission = (typeof allPermissions)[number];
