/**
 * people/columns — Column definitions for the People tables.
 *
 * Design ("Aura v2"):
 * - Gradient icon circle for each person
 * - Role/status badges with color coding
 * - Profile-specific data chips (grade, department, phone, etc.)
 * - Hover-reveal action buttons
 *
 * Builders:
 * - buildStudentColumns — admission number, grade, gender, academic year
 * - buildTeacherColumns — employee ID, department, qualification
 * - buildParentColumns  — phone, occupation, linked students count
 * - buildStaffColumns   — employee ID, department, role, joining date
 */

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { SortHeader } from "@/components/globals/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  GraduationCapIcon,
  BookOpenIcon,
  UserCheckIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  BuildingIcon,
  AwardIcon,
  BriefcaseIcon,
  UsersIcon,
  MailIcon,
  VenusAndMarsIcon,
  HeartIcon,
} from "lucide-react";
import type { User } from "@/lib/hooks/use-users";

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/** Gradient icon for a person row */
function PersonIcon({
  gradient,
  icon: Icon,
}: {
  gradient: string;
  icon: React.ElementType;
}) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02] ${gradient}`}
    >
      <Icon className="size-4.5 text-white" />
    </span>
  );
}

/** Profile info chip */
function Chip({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/60">
      <Icon className="size-3 text-muted-foreground/35" />
      {label}
    </span>
  );
}

/** Formatted date cell with calendar icon */
function DateCell({ dateStr }: { dateStr: string }) {
  const date = parseISO(dateStr);
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CalendarIcon className="size-3 text-muted-foreground/30" />
      <span>{format(date, "MMM d, yyyy")}</span>
    </span>
  );
}

/** Role badge with color coding */
function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    STUDENT: "bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 ring-rose-500/10",
    TEACHER: "bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 ring-amber-500/10",
    PARENT: "bg-gradient-to-r from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400 ring-sky-500/10",
    SUPER_ADMIN: "bg-gradient-to-r from-purple-500/15 to-purple-500/5 text-purple-600 dark:text-purple-400 ring-purple-500/10",
    PRINCIPAL: "bg-gradient-to-r from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 ring-indigo-500/10",
    VICE_PRINCIPAL: "bg-gradient-to-r from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 ring-indigo-500/10",
    LIBRARIAN: "bg-gradient-to-r from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400 ring-teal-500/10",
    ACCOUNTANT: "bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400 ring-cyan-500/10",
    COUNSELOR: "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10",
    STAFF: "bg-gradient-to-r from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400 ring-slate-500/10",
  };

  const labelMap: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    VICE_PRINCIPAL: "Vice Principal",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] shadow-sm ring-1 ${colorMap[role] ?? "bg-muted/30 text-muted-foreground ring-border/20"}`}
    >
      {labelMap[role] ?? role}
    </span>
  );
}

/** Action buttons shared across all tables */
function ActionButtons({
  onEdit,
  onDelete,
  extraActions,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
      {extraActions}
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onEdit}
          aria-label="Edit user"
          className="transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <PencilIcon className="size-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          aria-label="Delete user"
          className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Column Builder Options ─────────────────────────────────────────────────

interface PeopleColumnOptions {
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
  onViewGuardians?: (user: User) => void;
}

// ─── Student Columns ────────────────────────────────────────────────────────

export function buildStudentColumns(
  options?: PeopleColumnOptions,
): ColumnDef<User>[] {
  const { onEdit, onDelete, onViewGuardians } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 280,
      header: ({ column }) => SortHeader("Student", { column }),
      cell: ({ row }) => {
        const profile = row.original.studentProfile;
        return (
          <div className="flex items-center gap-3">
            <PersonIcon
              gradient="bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400"
              icon={GraduationCapIcon}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {row.original.name}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground/40">
                {profile?.admissionNumber ?? "—"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      size: 200,
      header: ({ column }) => SortHeader("Email", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MailIcon className="size-3 text-muted-foreground/30" />
          <span>{row.original.email}</span>
        </span>
      ),
    },
    {
      id: "grade",
      size: 150,
      header: "Grade",
      cell: ({ row }) => {
        const profile = row.original.studentProfile;
        if (!profile?.grade) return <span className="text-muted-foreground/30">—</span>;
        return (
          <Chip
            icon={BookOpenIcon}
            label={`${profile.grade.name} - ${profile.grade.section}`}
          />
        );
      },
    },
    {
      id: "gender",
      size: 100,
      header: "Gender",
      cell: ({ row }) => {
        const gender = row.original.studentProfile?.gender;
        return gender ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <VenusAndMarsIcon className="size-3 text-muted-foreground/30" />
            <span>{gender}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "academicYear",
      size: 140,
      header: "Academic Year",
      cell: ({ row }) => (
        <span className="text-sm text-foreground/70">
          {row.original.studentProfile?.academicYear?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      size: 80,
      header: "",
      cell: ({ row }) => (
        <RoleBadge role={row.original.role} />
      ),
    },
    {
      id: "actions",
      size: 100,
      header: "",
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => onEdit?.(row.original)}
          onDelete={() => onDelete?.(row.original)}
          extraActions={
            onViewGuardians && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onViewGuardians(row.original)}
                aria-label={`View guardians for ${row.original.name}`}
                className="transition-all duration-200 hover:bg-sky-500/10 hover:text-sky-600"
              >
                <HeartIcon className="size-3.5" />
              </Button>
            )
          }
        />
      ),
    },
  ];
}

// ─── Teacher Columns ────────────────────────────────────────────────────────

export function buildTeacherColumns(
  options?: PeopleColumnOptions,
): ColumnDef<User>[] {
  const { onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 280,
      header: ({ column }) => SortHeader("Teacher", { column }),
      cell: ({ row }) => {
        const profile = row.original.staffProfile;
        return (
          <div className="flex items-center gap-3">
            <PersonIcon
              gradient="bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400"
              icon={UserCheckIcon}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                {row.original.name}
              </span>
              <span className="text-[11px] text-muted-foreground/40">
                {profile?.employeeId ?? "—"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      size: 200,
      header: ({ column }) => SortHeader("Email", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MailIcon className="size-3 text-muted-foreground/30" />
          <span>{row.original.email}</span>
        </span>
      ),
    },
    {
      id: "department",
      size: 140,
      header: "Department",
      cell: ({ row }) => {
        const dept = row.original.staffProfile?.department;
        return dept ? (
          <Chip icon={BuildingIcon} label={dept} />
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "qualification",
      size: 140,
      header: "Qualification",
      cell: ({ row }) => {
        const qual = row.original.staffProfile?.qualification;
        return qual ? (
          <Chip icon={AwardIcon} label={qual} />
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "joiningDate",
      size: 130,
      header: "Joined",
      cell: ({ row }) => {
        const date = row.original.staffProfile?.joiningDate;
        return date ? <DateCell dateStr={date} /> : <span className="text-muted-foreground/30">—</span>;
      },
    },
    {
      id: "role",
      size: 80,
      header: "",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      id: "actions",
      size: 80,
      header: "",
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => onEdit?.(row.original)}
          onDelete={() => onDelete?.(row.original)}
        />
      ),
    },
  ];
}

// ─── Parent Columns ─────────────────────────────────────────────────────────

export function buildParentColumns(
  options?: PeopleColumnOptions,
): ColumnDef<User>[] {
  const { onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 260,
      header: ({ column }) => SortHeader("Parent", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <PersonIcon
            gradient="bg-gradient-to-br from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400"
            icon={UsersIcon}
          />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">
              {row.original.name}
            </span>
            <span className="text-[11px] text-muted-foreground/40">
              Parent
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "email",
      size: 200,
      header: ({ column }) => SortHeader("Email", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MailIcon className="size-3 text-muted-foreground/30" />
          <span>{row.original.email}</span>
        </span>
      ),
    },
    {
      id: "phone",
      size: 150,
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.original.parentProfile?.phone;
        return phone ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <PhoneIcon className="size-3 text-muted-foreground/30" />
            <span>{phone}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "occupation",
      size: 140,
      header: "Occupation",
      cell: ({ row }) => {
        const occ = row.original.parentProfile?.occupation;
        return occ ? (
          <Chip icon={BriefcaseIcon} label={occ} />
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "address",
      size: 160,
      header: "Address",
      cell: ({ row }) => {
        const address = row.original.parentProfile?.address;
        return address ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPinIcon className="size-3 text-muted-foreground/30" />
            <span className="truncate max-w-[120px]">{address}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "role",
      size: 80,
      header: "",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      id: "actions",
      size: 80,
      header: "",
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => onEdit?.(row.original)}
          onDelete={() => onDelete?.(row.original)}
        />
      ),
    },
  ];
}

// ─── Staff Columns ──────────────────────────────────────────────────────────

export function buildStaffColumns(
  options?: PeopleColumnOptions,
): ColumnDef<User>[] {
  const { onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 280,
      header: ({ column }) => SortHeader("Staff", { column }),
      cell: ({ row }) => {
        const profile = row.original.staffProfile;
        return (
          <div className="flex items-center gap-3">
            <PersonIcon
              gradient="bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 text-indigo-600 dark:text-indigo-400"
              icon={BriefcaseIcon}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                {row.original.name}
              </span>
              <span className="text-[11px] text-muted-foreground/40">
                {profile?.employeeId ?? "—"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      size: 200,
      header: ({ column }) => SortHeader("Email", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MailIcon className="size-3 text-muted-foreground/30" />
          <span>{row.original.email}</span>
        </span>
      ),
    },
    {
      id: "department",
      size: 140,
      header: "Department",
      cell: ({ row }) => {
        const dept = row.original.staffProfile?.department;
        return dept ? (
          <Chip icon={BuildingIcon} label={dept} />
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "qualification",
      size: 140,
      header: "Qualification",
      cell: ({ row }) => {
        const qual = row.original.staffProfile?.qualification;
        return qual ? (
          <Chip icon={AwardIcon} label={qual} />
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      id: "role",
      size: 100,
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      id: "joiningDate",
      size: 130,
      header: "Joined",
      cell: ({ row }) => {
        const date = row.original.staffProfile?.joiningDate;
        return date ? <DateCell dateStr={date} /> : <span className="text-muted-foreground/30">—</span>;
      },
    },
    {
      id: "actions",
      size: 80,
      header: "",
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => onEdit?.(row.original)}
          onDelete={() => onDelete?.(row.original)}
        />
      ),
    },
  ];
}
