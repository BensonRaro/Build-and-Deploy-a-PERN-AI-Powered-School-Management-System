/**
 * Staff Page — /dashboard/staff
 *
 * Design ("Aura v2") — indigo/slate tones for Staff:
 * - Gradient hero banner with animated decorative blobs
 * - Live stat cards showing aggregate metrics
 * - Premium DataTable with search, pagination, hover effects
 * - Stunning Dialog for create/edit with gradient header
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  UsersIcon,
  BuildingIcon,
  AwardIcon,
  BriefcaseIcon,
  XIcon,
  SparklesIcon,
  CalendarIcon,
  MailIcon,
  LockIcon,
  ShieldIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/globals/data-table";
import { buildStaffColumns } from "@/components/people/columns";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
} from "@/lib/hooks/use-users";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/staff";

// Staff roles that get a StaffProfile (excluding STUDENT, PARENT)
const STAFF_ROLES = [
  { value: "TEACHER", label: "Teacher" },
  { value: "PRINCIPAL", label: "Principal" },
  { value: "VICE_PRINCIPAL", label: "Vice Principal" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "COUNSELOR", label: "Counselor" },
  { value: "STAFF", label: "Staff" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04] hover:-translate-y-0.5">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-30 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-50",
          gradient,
        )}
      />
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02]",
            gradient,
          )}
        >
          <Icon className="size-4.5 text-white" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
            {label}
          </span>
          <span className="text-xl font-bold tracking-tight text-foreground">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Staff — Biasly" },
    {
      name: "description",
      content:
        "Manage staff accounts and roles across the school.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StaffPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  // Fetch all users, then filter client-side to show only staff roles
  // (excluding STUDENT and PARENT who have different profile types)
  const { data: allUsers, isLoading, isError, refetch } = useUsers();
  const staff = useMemo(
    () => (allUsers ?? []).filter((u) => u.role !== "STUDENT" && u.role !== "PARENT"),
    [allUsers],
  );
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("STAFF");
  const [formDepartment, setFormDepartment] = useState("");
  const [formQualification, setFormQualification] = useState("");
  const [formJoiningDate, setFormJoiningDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (staff.length === 0) return { total: 0, departments: 0, roles: 0, qualified: 0 };
    const total = staff.length;
    const deptSet = new Set(staff.map((s) => s.staffProfile?.department).filter(Boolean));
    const roleSet = new Set(staff.map((s) => s.role));
    const qualified = staff.filter((s) => s.staffProfile?.qualification).length;
    return { total, departments: deptSet.size, roles: roleSet.size, qualified };
  }, [staff]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildStaffColumns({
    onEdit: (user) => {
      setEditingUser(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormPassword("");
      setFormRole(user.role);
      setFormDepartment(user.staffProfile?.department ?? "");
      setFormQualification(user.staffProfile?.qualification ?? "");
      setFormJoiningDate(
        user.staffProfile?.joiningDate
          ? user.staffProfile.joiningDate.split("T")[0]
          : "",
      );
      setDialogOpen(true);
    },
    onDelete: (user) => {
      setPendingDelete({
        id: user.id,
        title: user.name,
        description: "This will soft-delete the user and preserve audit history.",
      });
    },
  });

  // ── Form handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("STAFF");
    setFormDepartment("");
    setFormQualification("");
    setFormJoiningDate("");
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    setIsSaving(true);
    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          id: editingUser.id,
          data: {
            name: formName.trim(),
            email: formEmail.trim(),
            role: formRole,
            profile: {
              department: formDepartment.trim() || undefined,
              qualification: formQualification.trim() || undefined,
              joiningDate: formJoiningDate,
            },
          },
        });
      } else {
        await createUser.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          role: formRole,            profile: {
              department: formDepartment.trim() || undefined,
            qualification: formQualification.trim() || undefined,
            joiningDate: formJoiningDate,
          },
        });
      }
      setDialogOpen(false);
      setEditingUser(null);
    } catch {
      // Toast handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-indigo-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-indigo-500/5 via-indigo-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-indigo-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <BriefcaseIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Staff
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Manage all non-teaching and administrative staff. Including
                super admins, principals, librarians, accountants, and more.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Staff
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && staff && staff.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={UsersIcon}
              label="Total Staff"
              value={stats.total}
              gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            />
            <StatCard
              icon={BuildingIcon}
              label="Departments"
              value={stats.departments}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={ShieldIcon}
              label="Roles"
              value={stats.roles}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={AwardIcon}
              label="Qualified"
              value={stats.qualified}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           DATA TABLE SECTION
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-indigo-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={staff ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search staff…"
          emptyMessage="No staff found."
          emptyDescription="Add your first staff member to get started."
          pageSize={8}
        />
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           PREMIUM CREATE/EDIT DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
          onClick={handleCloseDialog}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient header strip */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-indigo-500/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-indigo-500/10 to-transparent blur-3xl"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseDialog}
              aria-label="Close dialog"
              className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>

            <div className="relative px-6 pb-6 pt-8">
              {/* Header with icon */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 text-indigo-600 shadow-sm ring-1 ring-indigo-500/10 dark:text-indigo-400">
                  <BriefcaseIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingUser ? "Edit Staff" : "Add Staff"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingUser
                      ? `Update the details for "${editingUser.name}".`
                      : "Add a new staff member to the school system."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Name & Email */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Full Name
                    </label>
                    <div className="relative">
                      <BriefcaseIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="text"
                        placeholder="e.g. Sarah Johnson"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Email
                    </label>
                    <div className="relative">
                      <MailIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="email"
                        placeholder="staff@school.edu"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Password (only for create) */}
                {!editingUser && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Password
                    </label>
                    <div className="relative">
                      <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="password"
                        placeholder="Min. 6 characters"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        required={!editingUser}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10"
                      />
                    </div>
                  </div>
                )}

                {/* Role Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Staff Role
                  </label>
                  <div className="relative">
                    <ShieldIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    <Select value={formRole} onValueChange={(v) => setFormRole(v ?? "STAFF")} items={STAFF_ROLES}>
                      <SelectTrigger className="h-9 w-full border-border/30 bg-background/60 pl-9 text-sm backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="border-border/30">
                        {STAFF_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>



                {/* Department & Qualification */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Department
                    </label>
                    <div className="relative">
                      <BuildingIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="text"
                        placeholder="e.g. Administration"
                        value={formDepartment}
                        onChange={(e) => setFormDepartment(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Qualification
                    </label>
                    <div className="relative">
                      <AwardIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="text"
                        placeholder="e.g. MBA, B.Sc."
                        value={formQualification}
                        onChange={(e) => setFormQualification(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Joining Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Joining Date
                  </label>
                  <div className="relative">
                    <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      type="date"
                      value={formJoiningDate}
                      onChange={(e) => setFormJoiningDate(e.target.value)}
                      required
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Saving…
                      </span>
                    ) : editingUser ? (
                      "Update Staff"
                    ) : (
                      "Add Staff"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    disabled={isSaving}
                    className="border-border/30"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
           DELETE CONFIRMATION DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete staff "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete) deleteUser.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
