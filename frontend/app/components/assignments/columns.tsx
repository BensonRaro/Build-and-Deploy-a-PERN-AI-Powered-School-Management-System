/**
 * assignments/columns — Column definitions for the Assignments table.
 *
 * Design ("Aura v2"):
 * - Gradient file/pen icon for each assignment
 * - Type badge (Q&A with answers / Questions only)
 * - Status chip (Draft / Published / Closed) with color coding
 * - Subject + grade chips, due date, question count, submissions count
 * - Hover-reveal action buttons (view, edit, delete)
 */

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { SortHeader } from "@/components/globals/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  BookOpenIcon,
  GraduationCapIcon,
  ListChecksIcon,
  UsersIcon,
  CalendarIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/lib/hooks/use-assignments";

// ─── Options ────────────────────────────────────────────────────────────────

interface AssignmentColumnsOptions {
  onView?: (assignment: Assignment) => void;
  onEdit?: (assignment: Assignment) => void;
  onDelete?: (assignment: Assignment) => void;
}

// ─── Shared Components ──────────────────────────────────────────────────────

/** Gradient icon circle for assignment rows */
function AssignmentIcon() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-600 shadow-sm ring-1 ring-violet-500/10 dark:text-violet-400">
      <BookOpenIcon className="size-4.5" />
    </span>
  );
}

/** Type badge — Q&A (with answers) vs Questions-only */
function TypeBadge({ type }: { type: Assignment["type"] }) {
  return type === "WITH_ANSWERS" ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-violet-500/15 to-violet-500/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 ring-1 ring-violet-500/10 dark:text-violet-400">
      <CheckCircle2Icon className="size-3" />
      Q&A
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 ring-1 ring-amber-500/10 dark:text-amber-400">
      <ListChecksIcon className="size-3" />
      Questions
    </span>
  );
}

/** Status chip with color coding */
function StatusChip({ status }: { status: Assignment["status"] }) {
  const styles: Record<Assignment["status"], string> = {
    DRAFT: "bg-gradient-to-r from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400 ring-slate-500/10",
    PUBLISHED: "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10",
    CLOSED: "bg-gradient-to-r from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 ring-red-500/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] shadow-sm ring-1",
        styles[status],
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

/** Small chip for grade/subject metadata */
function MetaChip({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
      <Icon className="size-3 text-muted-foreground/30" />
      {children}
    </span>
  );
}

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildAssignmentColumns(
  options?: AssignmentColumnsOptions,
): ColumnDef<Assignment>[] {
  const { onView, onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "title",
      size: 300,
      header: ({ column }) => SortHeader("Assignment", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <AssignmentIcon />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">
              {row.original.title}
            </span>
            {row.original.description && (
              <span className="max-w-[220px] truncate text-[11px] text-muted-foreground/40">
                {row.original.description}
              </span>
            )}
            <div className="mt-1 flex items-center gap-3">
              <TypeBadge type={row.original.type} />
              <MetaChip icon={ListChecksIcon}>
                {row.original.questions.length} Qs
              </MetaChip>
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "grade",
      size: 150,
      header: ({ column }) => SortHeader("Grade", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
          <GraduationCapIcon className="size-3.5 text-muted-foreground/30" />
          {row.original.grade.name} - {row.original.grade.section}
        </span>
      ),
    },
    {
      accessorKey: "subject",
      size: 140,
      header: "Subject",
      cell: ({ row }) => (
        <span className="text-sm text-foreground/70">
          {row.original.subject?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "submissions",
      size: 120,
      header: "Submissions",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <UsersIcon className="size-3.5 text-muted-foreground/30" />
          <span className="font-medium text-foreground/80">
            {row.original._count.submissions}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      size: 130,
      header: ({ column }) => SortHeader("Due", { column }),
      cell: ({ row }) =>
        row.original.dueDate ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarIcon className="size-3 text-muted-foreground/30" />
            <span>{format(parseISO(row.original.dueDate), "MMM d, yyyy")}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/40">No due date</span>
        ),
    },
    {
      id: "status",
      size: 110,
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "actions",
      size: 110,
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
          {onView && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onView(row.original)}
              aria-label={`View ${row.original.title}`}
              className="transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <EyeIcon className="size-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onEdit(row.original)}
              aria-label={`Edit ${row.original.title}`}
              className="transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onDelete(row.original)}
              aria-label={`Delete ${row.original.title}`}
              className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashIcon className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
