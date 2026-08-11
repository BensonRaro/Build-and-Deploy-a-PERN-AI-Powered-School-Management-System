/**
 * Students Page — /dashboard/students
 *
 * Design ("Aura v2") — rose/red tones for Students:
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
  CalendarRangeIcon,
  XIcon,
  SparklesIcon,
  VenusAndMarsIcon,
  MapPinIcon,
  CakeIcon,
  DropletsIcon,
  MailIcon,
  LockIcon,
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
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { DataTable } from "@/components/globals/data-table";
import { buildStudentColumns } from "@/components/people/columns";
import { GuardiansSheet } from "@/components/student-guardians/guardians-sheet";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
} from "@/lib/hooks/use-users";
import { useAcademicYears, type AcademicYear } from "@/lib/hooks/use-academic-years";
import { useGrades } from "@/lib/hooks/use-grades";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/students";

/** Format an academic year for display with optional (Current) badge */
const formatYearLabel = (year: AcademicYear) =>
  `${year.name}${year.isCurrent ? " (Current)" : ""}`;

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
    { title: "Students — Biasly" },
    {
      name: "description",
      content:
        "Manage student records — profiles, grades, and class assignments.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StudentsPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: students, isLoading, isError, refetch } = useUsers({ role: "STUDENT" });
  const { data: academicYears } = useAcademicYears();
  const { data: grades } = useGrades();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guardiansSheetOpen, setGuardiansSheetOpen] = useState(false);
  const [guardiansStudent, setGuardiansStudent] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formGradeId, setFormGradeId] = useState("");
  const [formYearId, setFormYearId] = useState("");
  const [formDateOfBirth, setFormDateOfBirth] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formBloodGroup, setFormBloodGroup] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // Select options (first item is the null-value placeholder — shown before
  // any selection; `value={state || null}` keeps the real state a "" so null
  // never reaches the backend)
  const gradeOptions = useMemo(
    () => [
      { label: "Select grade", value: null as string | null },
      ...(grades ?? []).map((g) => ({
        label: `${g.name} - ${g.section}`,
        value: g.id,
      })),
    ],
    [grades],
  );
  const yearOptions = useMemo(
    () => [
      { label: "Select year", value: null as string | null },
      ...(academicYears ?? []).map((y) => ({
        label: formatYearLabel(y),
        value: y.id,
      })),
    ],
    [academicYears],
  );
  const genderOptions = [
    { label: "Select gender", value: null as string | null },
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
    { label: "Other", value: "Other" },
  ];

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!students) return { total: 0, grades: 0, years: 0, male: 0, female: 0 };
    const total = students.length;
    const gradeSet = new Set(students.map((s) => s.studentProfile?.gradeId));
    const yearSet = new Set(students.map((s) => s.studentProfile?.academicYearId));
    const male = students.filter((s) => s.studentProfile?.gender === "Male").length;
    const female = students.filter((s) => s.studentProfile?.gender === "Female").length;
    return {
      total,
      grades: gradeSet.size,
      years: yearSet.size,
      male,
      female,
    };
  }, [students]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildStudentColumns({
    onViewGuardians: (user) => {
      setGuardiansStudent(user);
      setGuardiansSheetOpen(true);
    },
    onEdit: (user) => {
      setEditingUser(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormPassword(""); // password not editable
      setFormGradeId(user.studentProfile?.gradeId ?? "");
      setFormYearId(user.studentProfile?.academicYearId ?? "");
      setFormDateOfBirth(
        user.studentProfile?.dateOfBirth
          ? user.studentProfile.dateOfBirth.split("T")[0]
          : "",
      );
      setFormGender(user.studentProfile?.gender ?? "");
      setFormBloodGroup(user.studentProfile?.bloodGroup ?? "");
      setFormAddress(user.studentProfile?.address ?? "");
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
    setFormGradeId("");
    setFormYearId(academicYears?.find((y) => y.isCurrent)?.id ?? academicYears?.[0]?.id ?? "");
    setFormDateOfBirth("");
    setFormGender("");
    setFormBloodGroup("");
    setFormAddress("");
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formYearId || !formGradeId) return;

    setIsSaving(true);
    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          id: editingUser.id,
          data: {
            name: formName.trim(),
            email: formEmail.trim(),
            profile: {
              gradeId: formGradeId,
              academicYearId: formYearId,
              dateOfBirth: formDateOfBirth,
              gender: formGender,
              bloodGroup: formBloodGroup.trim() || undefined,
              address: formAddress.trim() || undefined,
            },
          },
        });
      } else {
        await createUser.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          role: "STUDENT",
          profile: {
            gradeId: formGradeId,
            academicYearId: formYearId,                dateOfBirth: formDateOfBirth,
            gender: formGender,
            bloodGroup: formBloodGroup.trim() || undefined,
            address: formAddress.trim() || undefined,
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
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-rose-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-rose-500/5 via-rose-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-rose-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20">
              <GraduationCapIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Students
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Manage student profiles, enrollments, and academic records.
                Track student information across grades and academic years.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-rose-500/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Student
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && students && students.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={UsersIcon}
              label="Total Students"
              value={stats.total}
              gradient="bg-gradient-to-br from-rose-500 to-rose-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Grades"
              value={stats.grades}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={CalendarRangeIcon}
              label="Academic Years"
              value={stats.years}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
            icon={VenusAndMarsIcon}
            label="Male / Female"
              value={`${stats.male} / ${stats.female}`}
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
          className="pointer-events-none absolute -inset-10 rounded-full bg-rose-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={students ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search students…"
          emptyMessage="No students found."
          emptyDescription="Enroll your first student to get started."
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
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient header strip */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-rose-500/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-rose-500/10 to-transparent blur-3xl"
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
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-600 shadow-sm ring-1 ring-rose-500/10 dark:text-rose-400">
                  <GraduationCapIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingUser ? "Edit Student" : "Enroll Student"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingUser
                      ? `Update the details for "${editingUser.name}".`
                      : "Add a new student to the school system."}
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
                        placeholder="e.g. Jane Doe"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10"
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
                        placeholder="jane@school.edu"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10"
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
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10"
                      />
                    </div>
                  </div>
                )}



                {/* Grade & Academic Year */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Grade
                    </label>
                    <ReusableMultiSelect
                      value={formGradeId}
                      onValueChange={(v) => setFormGradeId(v)}
                      options={gradeOptions}
                      placeholder="Select grade"
                      icon={BookOpenIcon}
                      accent="rose"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Academic Year
                    </label>
                    <ReusableMultiSelect
                      value={formYearId}
                      onValueChange={(v) => setFormYearId(v)}
                      options={yearOptions}
                      placeholder="Select year"
                      icon={CalendarRangeIcon}
                      accent="rose"
                    />
                  </div>
                </div>

                {/* Date of Birth & Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <CakeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="date"
                        value={formDateOfBirth}
                        onChange={(e) => setFormDateOfBirth(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Gender
                    </label>
                    <div className="relative">
                      <VenusAndMarsIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Select
                        value={formGender || null}
                        onValueChange={(v) => setFormGender(v ?? "")}
                        items={genderOptions}
                      >
                        <SelectTrigger className="h-9 w-full border-border/30 bg-background/60 pl-9 text-sm backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent className="border-border/30">
                          {genderOptions.map((option) => (
                            <SelectItem
                              key={option.value ?? "__placeholder__"}
                              value={option.value}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Blood Group & Address */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Blood Group
                    </label>
                    <div className="relative">
                      <DropletsIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="text"
                        placeholder="e.g. O+"
                        value={formBloodGroup}
                        onChange={(e) => setFormBloodGroup(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Address
                    </label>
                    <div className="relative">
                      <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        type="text"
                        placeholder="Home address"
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-rose-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Saving…
                      </span>
                    ) : editingUser ? (
                      "Update Student"
                    ) : (
                      "Enroll Student"
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
           GUARDIANS SHEET
           ═════════════════════════════════════════════════════════════════════ */}
      <GuardiansSheet
        student={guardiansStudent}
        open={guardiansSheetOpen}
        onOpenChange={(open) => {
          setGuardiansSheetOpen(open);
          if (!open) setGuardiansStudent(null);
        }}
      />

      {/* ═════════════════════════════════════════════════════════════════════
           DELETE CONFIRMATION DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete student "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete) deleteUser.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
