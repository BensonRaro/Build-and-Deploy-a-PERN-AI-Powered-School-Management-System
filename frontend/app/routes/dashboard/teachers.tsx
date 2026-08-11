/**
 * Teachers Page — /dashboard/teachers
 *
 * Design ("Aura v2") — amber/orange tones for Teachers:
 * - Gradient hero banner with animated decorative blobs
 * - Live stat cards showing aggregate metrics
 * - Premium DataTable with search, pagination, hover effects
 * - Stunning Dialog for create/edit with gradient header
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  GraduationCapIcon,
  UsersIcon,
  BookOpenIcon,
  BuildingIcon,
  XIcon,
  SparklesIcon,
  AwardIcon,
  CalendarIcon,
  MailIcon,
  LockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/globals/data-table";
import { buildTeacherColumns } from "@/components/people/columns";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
} from "@/lib/hooks/use-users";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/teachers";

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
    { title: "Teachers — Biasly" },
    {
      name: "description",
      content:
        "Manage teacher accounts, profiles, and class assignments.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TeachersPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: teachers, isLoading, isError, refetch } = useUsers({ role: "TEACHER" });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formQualification, setFormQualification] = useState("");
  const [formJoiningDate, setFormJoiningDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!teachers) return { total: 0, departments: 0, qualified: 0 };
    const total = teachers.length;
    const deptSet = new Set(teachers.map((t) => t.staffProfile?.department).filter(Boolean));
    const qualified = teachers.filter((t) => t.staffProfile?.qualification).length;
    return { total, departments: deptSet.size, qualified };
  }, [teachers]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildTeacherColumns({
    onEdit: (user) => {
      setEditingUser(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormPassword("");
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
          role: "TEACHER",            profile: {
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
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-amber-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-amber-500/5 via-amber-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-amber-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20">
              <GraduationCapIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Teachers
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Manage teacher profiles, assignments, and qualifications.
                Track teaching staff across departments.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Teacher
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && teachers && teachers.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={UsersIcon}
              label="Total Teachers"
              value={stats.total}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatCard
              icon={BuildingIcon}
              label="Departments"
              value={stats.departments}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={AwardIcon}
              label="Qualified"
              value={stats.qualified}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Assignments"
              value="—"
              gradient="bg-gradient-to-br from-sky-500 to-sky-600"
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
          className="pointer-events-none absolute -inset-10 rounded-full bg-amber-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={teachers ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search teachers…"
          emptyMessage="No teachers found."
          emptyDescription="Add your first teacher to get started."
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
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-500/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-amber-500/10 to-transparent blur-3xl"
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
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 shadow-sm ring-1 ring-amber-500/10 dark:text-amber-400">
                  <GraduationCapIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingUser ? "Edit Teacher" : "Add Teacher"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingUser
                      ? `Update the details for "${editingUser.name}".`
                      : "Add a new teacher to the school system."}
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
                      <GraduationCapIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="text"
                        placeholder="e.g. John Smith"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10"
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
                        placeholder="john@school.edu"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10"
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
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10"
                      />
                    </div>
                  </div>
                )}

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
                        placeholder="e.g. Mathematics"
                        value={formDepartment}
                        onChange={(e) => setFormDepartment(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10"
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
                        placeholder="e.g. B.Ed., M.Sc."
                        value={formQualification}
                        onChange={(e) => setFormQualification(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10"
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
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Saving…
                      </span>
                    ) : editingUser ? (
                      "Update Teacher"
                    ) : (
                      "Add Teacher"
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
        title={`Delete teacher "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete) deleteUser.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
