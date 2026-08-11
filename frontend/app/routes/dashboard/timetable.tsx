/**
 * Timetable Page — /dashboard/timetable
 *
 * Design ("Aura v2" with Sky Blue theme):
 * - Gradient hero banner with animated decorative blobs (sky/cyan tones)
 * - Grade selector dropdown with academic year context
 * - Weekly timetable grid: days as columns, time slots as rows
 * - Each lesson is a card in the grid showing subject + teacher
 * - SUPER_ADMIN/PRINCIPAL/VICE_PRINCIPAL can click lessons to edit
 * - "Generate with AI" button for admins
 * - Responsive: horizontal scroll on mobile, full grid on desktop
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  CalendarClockIcon,
  SparklesIcon,
  XIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  BookOpenIcon,
  GraduationCapIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  Trash2Icon,
  SaveIcon,
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
import {
  useTimetableSlots,
  useGenerateTimetable,
  useUpdateTimetableSlot,
  useDeleteTimetableSlot,
  type TimetableSlot,
} from "@/lib/hooks/use-timetable";
import { useGrades } from "@/lib/hooks/use-grades";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { Loader } from "@/components/globals/loader";
import { TimetableGrid } from "@/components/dashboard/timetable-grid";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/types";
import type { Route } from "./+types/timetable";

// ─── Constants ──────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

/** Day options as { label, value } for Base UI's `items` prop (string values) */
const DAY_OPTIONS = DAYS.map((d) => ({ label: d.label, value: String(d.value) }));

/** Period duration in minutes (used for the weekly-hours stat) */
const PERIOD_DURATION = 40;

/** Format minutes since midnight to display time */
const fmtTime = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// ─── Helper: Check if user can edit timetable ────────────────────────────────

const CAN_EDIT_ROLES: Role[] = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"];

// ─── Edit Lesson Dialog ──────────────────────────────────────────────────────

function EditLessonDialog({
  slot,
  onClose,
  onSave,
  onDelete,
  isSaving,
}: {
  slot: TimetableSlot;
  onClose: () => void;
  onSave: (data: {
    startTime?: number;
    endTime?: number;
    dayOfWeek?: number;
    room?: string;
  }) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [startTime, setStartTime] = useState(slot.startTime);
  const [endTime, setEndTime] = useState(slot.endTime);
  const [dayOfWeek, setDayOfWeek] = useState(slot.dayOfWeek);
  const [room, setRoom] = useState(slot.room ?? "");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ startTime, endTime, dayOfWeek, room: room || undefined });
  };

  const subjectName =
    slot.subjectName ?? slot.teachergradeSubject?.subject?.name ?? "Unknown";
  const teacherName =
    slot.teacherName ??
    slot.teachergradeSubject?.teacher?.user?.name ??
    "Unknown";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient header strip */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-500/[0.06] to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-sky-500/10 to-transparent blur-3xl"
        />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        <div className="relative px-6 pb-6 pt-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 text-sky-600 shadow-sm ring-1 ring-sky-500/10 dark:text-sky-400">
              <BookOpenIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Edit Lesson
              </h2>
              <p className="text-xs text-muted-foreground/60">
                {subjectName} — {teacherName}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Subject (read-only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Subject
              </label>
              <div className="flex h-9 items-center rounded-md border border-border/30 bg-muted/30 px-3 text-sm text-muted-foreground/70">
                <BookOpenIcon className="mr-2 size-3.5 text-muted-foreground/40" />
                {subjectName}
              </div>
            </div>

            {/* Teacher (read-only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Teacher
              </label>
              <div className="flex h-9 items-center rounded-md border border-border/30 bg-muted/30 px-3 text-sm text-muted-foreground/70">
                <UserIcon className="mr-2 size-3.5 text-muted-foreground/40" />
                {teacherName}
              </div>
            </div>

            {/* Day of Week */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Day
              </label>
              <Select
                value={String(dayOfWeek)}
                onValueChange={(v) => setDayOfWeek(Number(v))}
                items={DAY_OPTIONS}
              >
                <SelectTrigger className="h-9 border-border/30 bg-background/60 text-sm backdrop-blur-sm transition-all duration-200 focus-visible:border-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-500/10">
                  <SelectValue placeholder="Select a day…" />
                </SelectTrigger>
                <SelectContent className="border-border/30">
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start & End Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Start Time
                </label>
                <div className="relative">
                  <ClockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                  <Input
                    type="time"
                    value={fmtTime(startTime)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      if (h !== undefined && m !== undefined) {
                        setStartTime(h * 60 + m);
                      }
                    }}
                    className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-500/10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  End Time
                </label>
                <div className="relative">
                  <ClockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                  <Input
                    type="time"
                    value={fmtTime(endTime)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      if (h !== undefined && m !== undefined) {
                        setEndTime(h * 60 + m);
                      }
                    }}
                    className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-500/10"
                  />
                </div>
              </div>
            </div>

            {/* Room */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Room
              </label>
              <div className="relative">
                <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                <Input
                  type="text"
                  placeholder="e.g. B-201"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-500/10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3">
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/30"
              >
                {isSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCwIcon className="size-4 animate-spin" />
                    Saving…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <SaveIcon className="size-4" />
                    Save Changes
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
                className="border-border/30"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                disabled={isSaving}
                className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-950/20"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

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
    { title: "Timetable — Biasly" },
    {
      name: "description",
      content:
        "Weekly class timetable — AI-generated drafts and manual editing in a visual grid.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const { data: session } = authClient.useSession();
  const userRole = session?.user.role as Role | undefined;
  const canEdit = userRole ? CAN_EDIT_ROLES.includes(userRole) : false;

  // ── Data queries ──────────────────────────────────────────────────────
  const { data: academicYears } = useAcademicYears();
  const currentYear = academicYears?.find((y) => y.isCurrent);
  const { data: grades } = useGrades(currentYear?.id);

  // ── Grade selection state ─────────────────────────────────────────────
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");

  // Grade options (null placeholder item shows before any selection)
  const gradeOptions = useMemo(
    () => [
      { label: "Select a grade…", value: null as string | null },
      ...(grades ?? []).map((g) => ({
        label: `${g.name} - ${g.section}`,
        value: g.id,
      })),
    ],
    [grades],
  );

  // Auto-select first grade when grades load
  const selectedGrade = useMemo(
    () => grades?.find((g) => g.id === selectedGradeId),
    [grades, selectedGradeId],
  );

  const {
    data: slots,
    isLoading,
    isError,
    refetch,
  } = useTimetableSlots(selectedGradeId);

  const generateTimetable = useGenerateTimetable();
  const updateSlot = useUpdateTimetableSlot();
  const deleteSlot = useDeleteTimetableSlot();

  // ── Editing state ─────────────────────────────────────────────────────
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);

  // ── Handle grade change (auto-select first if valid) ─────────────
  const handleGradeChange = useCallback((value: string | null) => {
    setSelectedGradeId(value ?? "");
  }, []);

  // ── Auto-refetch after generation completes ───────────────────────────
  const generationTriggered = useRef(false);

  useEffect(() => {
    // When generation mutation succeeds (isSuccess transitions to true),
    // wait a few seconds then refetch the timetable data
    if (generateTimetable.isSuccess && generationTriggered.current) {
      generationTriggered.current = false;
      const timer = setTimeout(() => {
        refetch();
      }, 3000); // 3 second delay for Inngest to process
      return () => clearTimeout(timer);
    }
  }, [generateTimetable.isSuccess, refetch]);

  // ── Handle AI generation ──────────────────────────────────────────────
  const handleGenerate = () => {
    if (!selectedGradeId || !currentYear) return;
    generationTriggered.current = true;
    generateTimetable.mutate({
      gradeId: selectedGradeId,
      academicYearId: currentYear.id,
    });
  };

  // ── Handle edit save ──────────────────────────────────────────────────
  const handleEditSave = (data: {
    startTime?: number;
    endTime?: number;
    dayOfWeek?: number;
    room?: string;
  }) => {
    if (!editingSlot) return;
    updateSlot.mutate(
      { id: editingSlot.id, data },
      {
        onSuccess: () => setEditingSlot(null),
      },
    );
  };

  // ── Handle delete ─────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!editingSlot) return;
    deleteSlot.mutate(editingSlot.id, {
      onSuccess: () => setEditingSlot(null),
    });
  };

  // ── Aggregate stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!slots) return { total: 0, subjects: 0, teachers: 0, weeklyHours: 0 };
    const total = slots.length;
    const subjects = new Set(slots.map((s) => s.subjectName)).size;
    const teachers = new Set(slots.map((s) => s.teacherName)).size;
    const weeklyHours = total * PERIOD_DURATION;
    return { total, subjects, teachers, weeklyHours };
  }, [slots]);

  const isGenerating = generateTimetable.isPending;
  const isSaving = updateSlot.isPending;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-sky-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-sky-500/5 via-sky-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-sky-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/20">
              <CalendarClockIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Timetable
              </h1>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground/70">
                View and manage weekly class schedules. AI-generated timetables
                intelligently avoid teacher and room conflicts.
              </p>
            </div>
          </div>

          {/* Grade selector */}
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <ReusableMultiSelect
              value={selectedGradeId}
              onValueChange={(v) => handleGradeChange(v)}
              options={gradeOptions}
              placeholder="Select a grade…"
              icon={GraduationCapIcon}
              accent="sky"
              triggerClassName="w-[200px]"
              emptyMessage={
                currentYear
                  ? "No grades for this academic year"
                  : "Select an academic year first"
              }
            />

            {canEdit && selectedGradeId && (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/30"
              >
                {isGenerating ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCwIcon className="size-4 animate-spin" />
                    Generating…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <SparklesIcon className="size-4" />
                    Generate with AI
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        {!isLoading && selectedGradeId && slots && slots.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={CalendarClockIcon}
              label="Weekly Lessons"
              value={stats.total}
              gradient="bg-gradient-to-br from-sky-500 to-sky-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Subjects"
              value={stats.subjects}
              gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
            <StatCard
              icon={UserIcon}
              label="Teachers"
              value={stats.teachers}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={ClockIcon}
              label="Weekly Hours"
              value={stats.weeklyHours}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           TIMETABLE GRID
           ═════════════════════════════════════════════════════════════════════ */}

      {!selectedGradeId ? (
        /* ── No grade selected ───────────────────────────────────────── */
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 p-12 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <CalendarClockIcon className="size-16 text-muted-foreground/20" />
            <div>
              <p className="text-lg font-medium text-muted-foreground/70">
                No grade selected
              </p>
              <p className="mt-1 text-sm text-muted-foreground/50">
                Select a grade above to view its timetable.
              </p>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        /* ── Loading state ──────────────────────────────────────────── */
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-sm">
          <Loader variant="page" size="md" text="Loading timetable…" />
        </div>
      ) : isError ? (
        /* ── Error state ────────────────────────────────────────────── */
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border border-destructive/15 bg-gradient-to-b from-destructive/[0.03] to-transparent p-8">
          <AlertTriangleIcon className="size-12 text-destructive/50" />
          <div className="text-center">
            <p className="text-sm font-medium text-destructive">
              Failed to load timetable.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Please try again or contact support.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Try Again
          </Button>
        </div>
      ) : slots && slots.length === 0 ? (
        /* ── Empty state ────────────────────────────────────────────── */
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 p-8 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-sky-500/5 blur-xl" />
            <CalendarClockIcon className="relative size-16 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground/70">
              No timetable yet
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground/50">
              {canEdit
                ? `Generate a timetable for "${selectedGrade?.name} - ${selectedGrade?.section}" using AI. Make sure teachers and subjects are assigned first.`
                : "The timetable has not been generated yet. Please contact an administrator."}
            </p>
          </div>
          {canEdit && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/30"
            >
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCwIcon className="size-4 animate-spin" />
                  Generating…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <SparklesIcon className="size-4" />
                  Generate Timetable
                </span>
              )}
            </Button>
          )}
        </div>
      ) : (
        /* ── Timetable Grid (shared component) ─────────────────────── */
        <TimetableGrid
          slots={slots ?? []}
          editable={canEdit}
          onLessonClick={(slot) => canEdit && setEditingSlot(slot)}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════════
           EDIT LESSON DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      {editingSlot && (
        <EditLessonDialog
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={handleEditSave}
          onDelete={handleDelete}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
