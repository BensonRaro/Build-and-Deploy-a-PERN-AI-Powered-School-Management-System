/**
 * Assignments Page — /dashboard/assignments
 *
 * Design ("Aura v2" with violet theme — AI/Sparkles identity):
 * - Gradient hero banner with animated decorative blobs
 * - Role-aware: staff manage assignments (list + AI generation + grading),
 *   students take published assignments and get instant results
 * - Live stat cards, premium DataTable, stunning generation dialog
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  SparklesIcon,
  BookOpenIcon,
  UsersIcon,
  GraduationCapIcon,
  CheckCircle2Icon,
  FileTextIcon,
  CalendarIcon,
  ListChecksIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/globals/data-table";
import { buildAssignmentColumns } from "@/components/assignments/columns";
import { GenerationDialog } from "@/components/assignments/generation-dialog";
import { AssignmentDetailDialog } from "@/components/assignments/detail-dialog";
import { TakeAssignmentDialog } from "@/components/assignments/take-assignment-dialog";
import {
  useAssignments,
  useDeleteAssignment,
  type Assignment,
} from "@/lib/hooks/use-assignments";
import { useGrades } from "@/lib/hooks/use-grades";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/types";
import type { Route } from "./+types/assignments";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Roles that manage (create/edit/delete/grade) assignments.
 *  COUNSELOR reads published assignments only (backend strips answer keys for them). */
const MANAGER_ROLES: Role[] = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "TEACHER",
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

// ─── Student Assignment Card ────────────────────────────────────────────────

function StudentAssignmentCard({
  assignment,
  onTake,
}: {
  assignment: Assignment;
  onTake: (a: Assignment) => void;
}) {
  const totalPoints = assignment.questions.reduce(
    (s, q) => s + (q.points || 0),
    0,
  );
  const isOverdue =
    assignment.dueDate && new Date(assignment.dueDate) < new Date();

  return (
    <button
      type="button"
      onClick={() => onTake(assignment)}
      className="group relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/90 to-background/40 p-5 text-left shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-500/25 hover:shadow-lg hover:shadow-violet-500/[0.07]"
    >
      {/* Decorative glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-3xl transition-all duration-500 group-hover:from-violet-500/20"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-600 shadow-sm ring-1 ring-violet-500/10 dark:text-violet-400">
            <BookOpenIcon className="size-5" />
          </span>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 border-0 bg-muted/30 px-2 py-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60",
            )}
          >
            {assignment.type === "WITH_ANSWERS" ? "Q&A" : "Questions"}
          </Badge>
        </div>

        <h3 className="mt-3 text-sm font-bold leading-snug tracking-tight text-foreground">
          {assignment.title}
        </h3>
        {assignment.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground/50">
            {assignment.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/50">
          {assignment.subject && (
            <span className="inline-flex items-center gap-1">
              <FileTextIcon className="size-3" />
              {assignment.subject.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <ListChecksIcon className="size-3" />
            {assignment.questions.length} Qs · {totalPoints} pts
          </span>
          {assignment.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                isOverdue && "text-red-500/70",
              )}
            >
              <CalendarIcon className="size-3" />
              Due {assignment.dueDate.split("T")[0]}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/10 pt-3">
          <span className="text-[11px] font-medium text-violet-600/80 dark:text-violet-400/80">
            {assignment.type === "WITH_ANSWERS"
              ? "Instant results on submit"
              : "Take & await grading"}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground/60 transition-all duration-200 group-hover:gap-1.5 group-hover:text-violet-600">
            Open
            <ChevronRightIcon className="size-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Assignments — Biasly" },
    {
      name: "description",
      content:
        "AI-generated assignments and grading — staff create and score, students take and get instant results.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const { data: session } = authClient.useSession();
  const userRole = session?.user.role as Role | undefined;
  const isManager = userRole ? MANAGER_ROLES.includes(userRole) : false;

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: assignments, isLoading, isError, refetch } = useAssignments();
  const { data: academicYears } = useAcademicYears();
  const currentYear = academicYears?.find((y) => y.isCurrent);
  const { data: grades } = useGrades(currentYear?.id);
  const deleteAssignment = useDeleteAssignment();

  // ── Dialog state ─────────────────────────────────────────────────────
  const [genOpen, setGenOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [takingAssignmentId, setTakingAssignmentId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // ── Aggregate stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!assignments)
      return { total: 0, published: 0, submissions: 0, avgPoints: 0 };
    const total = assignments.length;
    const published = assignments.filter(
      (a) => a.status === "PUBLISHED",
    ).length;
    const submissions = assignments.reduce(
      (s, a) => s + a._count.submissions,
      0,
    );
    const avgPoints =
      total > 0
        ? Math.round(
            assignments.reduce(
              (s, a) =>
                s + a.questions.reduce((q, x) => q + (x.points || 0), 0),
              0,
            ) / total,
          )
        : 0;
    return { total, published, submissions, avgPoints };
  }, [assignments]);

  // ── Column definitions ───────────────────────────────────────────────
  const columns = buildAssignmentColumns({
    onView: (a) => setViewingAssignment(a),
    onEdit: (a) => {
      setEditingAssignment(a);
      setGenOpen(true);
    },
    onDelete: (a) => {
      setPendingDelete({
        id: a.id,
        title: a.title,
        description: "This will permanently delete the assignment and all submissions.",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setGenOpen(true);
  };

  const handleGenerationClose = (open: boolean) => {
    setGenOpen(open);
    if (!open) setEditingAssignment(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-violet-500/[0.05] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-violet-500/5 via-violet-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-violet-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
              <BookOpenIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Assignments
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                {isManager
                  ? "Create AI-generated assignments per grade. Students get instant, auto-graded results."
                  : "Complete your assignments and get instant results."}
              </p>
            </div>
          </div>
          {isManager && (
            <Button
              onClick={handleOpenCreate}
              className="mt-3 shrink-0 bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30 sm:mt-0"
            >
              <SparklesIcon className="mr-1.5 size-4" />
              Generate with AI
            </Button>
          )}
        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────── */}
        {!isLoading && assignments && assignments.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={BookOpenIcon}
              label={isManager ? "Total" : "Available"}
              value={stats.total}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={CheckCircle2Icon}
              label="Published"
              value={stats.published}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={UsersIcon}
              label="Submissions"
              value={stats.submissions}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={GraduationCapIcon}
              label="Avg Points"
              value={stats.avgPoints}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           CONTENT — role-aware
           ═══════════════════════════════════════════════════════════════════ */}
      {isManager ? (
        /* ── MANAGER: DataTable ─────────────────────────────────────── */
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-10 rounded-full bg-violet-500/[0.02] blur-3xl"
          />

          <DataTable
            columns={columns}
            data={assignments ?? []}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            searchPlaceholder="Search assignments…"
            emptyMessage="No assignments found."
            emptyDescription="Generate your first AI assignment to get started."
            pageSize={8}
          />
        </div>
      ) : (
        /* ── STUDENT / PARENT: card grid ────────────────────────────── */
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-10 rounded-full bg-violet-500/[0.02] blur-3xl"
          />

          {isLoading ? (
            <DataTable
              columns={[]}
              data={[]}
              isLoading
              showSearch={false}
              showPagination={false}
            />
          ) : isError ? (
            <DataTable
              columns={[]}
              data={[]}
              isError
              errorMessage="Failed to load assignments."
              onRetry={() => refetch()}
              showSearch={false}
              showPagination={false}
            />
          ) : assignments && assignments.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => (
                <StudentAssignmentCard
                  key={a.id}
                  assignment={a}
                  onTake={(assignment) => setTakingAssignmentId(assignment.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 p-8 backdrop-blur-sm">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-violet-500/5 blur-xl" />
                <BookOpenIcon className="relative size-16 text-muted-foreground/20" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground/70">
                  No assignments yet
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground/50">
                  Published assignments for your grade will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           DIALOGS
           ═══════════════════════════════════════════════════════════════════ */}
      <GenerationDialog
        open={genOpen}
        onOpenChange={handleGenerationClose}
        grades={grades}
        academicYears={academicYears}
        editing={editingAssignment}
      />

      {viewingAssignment && (
        <AssignmentDetailDialog
          assignment={viewingAssignment}
          onOpenChange={(o) => !o && setViewingAssignment(null)}
        />
      )}

      {takingAssignmentId && (
        <TakeAssignmentDialog
          key={takingAssignmentId}
          assignmentId={takingAssignmentId}
          onOpenChange={(o) => !o && setTakingAssignmentId(null)}
        />
      )}

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete) deleteAssignment.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
