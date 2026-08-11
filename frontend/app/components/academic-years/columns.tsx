/**
 * academic-years/columns — Column definitions for the Academic Years table.
 *
 * Design ("Aura v2"):
 * - Gradient "Current" badge with subtle glow
 * - Icon-enhanced date cells
 * - Glass-styled action buttons with tooltip labels
 * - Resources cell with visual hierarchy (chip-style labels)
 */

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { SortHeader } from "@/components/globals/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  CalendarRangeIcon,
  CalendarIcon,
  GraduationCapIcon,
  BookOpenIcon,
  UsersIcon,
  SparklesIcon,
} from "lucide-react";
import type { AcademicYear } from "@/lib/hooks/use-academic-years";
// ─── Options ────────────────────────────────────────────────────────────────

interface AcademicYearColumnsOptions {
  onViewTerms?: (academicYear: AcademicYear) => void;
  onEdit?: (academicYear: AcademicYear) => void;
  onDelete?: (academicYear: AcademicYear) => void;
}

// ─── Shared Components ──────────────────────────────────────────────────────

/** Gradient "Current" badge with a soft glow */
function CurrentBadge() {
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/15 to-primary/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary shadow-sm shadow-primary/5">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
      </span>
      Current
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

/** Resource count chip */
function ResourceChip({
  count,
  label,
  icon: Icon,
}: {
  count: number;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/60">
      <Icon className="size-3 text-muted-foreground/35" />
      {count} {label}
    </span>
  );
}

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildAcademicYearColumns(
  options?: AcademicYearColumnsOptions,
): ColumnDef<AcademicYear>[] {
  const { onViewTerms, onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 320,
      header: ({ column }) => SortHeader("Name", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {/* Gradient icon circle */}
          <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
            <GraduationCapIcon className="size-4" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {row.getValue("name")}
              </span>
              {row.original.isCurrent && <CurrentBadge />}
            </div>
            <span className="text-[11px] text-muted-foreground/40">
              ID: {row.original.id.slice(0, 8)}…
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "startDate",
      size: 140,
      header: ({ column }) => SortHeader("Start Date", { column }),
      cell: ({ row }) => <DateCell dateStr={row.getValue("startDate")} />,
    },
    {
      accessorKey: "endDate",
      size: 140,
      header: ({ column }) => SortHeader("End Date", { column }),
      cell: ({ row }) => <DateCell dateStr={row.getValue("endDate")} />,
    },
    {
      id: "duration",
      size: 100,
      header: "Duration",
      cell: ({ row }) => {
        const start = parseISO(row.original.startDate);
        const end = parseISO(row.original.endDate);
        const days = Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
        return (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <SparklesIcon className="size-3 text-muted-foreground/30" />
            <span>{days} days</span>
          </span>
        );
      },
    },
    {
      id: "resources",
      size: 280,
      header: "Resources",
      cell: ({ row }) => {
        const { terms, gradees, subjects, students } = row.original._count;
        return (
          <div className="flex items-center gap-1.5">
            <ResourceChip count={terms} label="terms" icon={CalendarRangeIcon} />
            <ResourceChip count={gradees} label="grades" icon={GraduationCapIcon} />
            <ResourceChip count={subjects} label="subjects" icon={BookOpenIcon} />
            <ResourceChip count={students} label="students" icon={UsersIcon} />
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 80,
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5">
          {/*  opacity-0 transition-all duration-200  group-hover:opacity-100 */}
          {onViewTerms && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewTerms(row.original)}
              aria-label={`View terms for ${row.original.name}`}
              className="transition-all duration-200 hover:bg-primary/10 hover:text-primary"
            >
              <CalendarRangeIcon className="size-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original)}
              aria-label={`Edit ${row.original.name}`}
              className="transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(row.original)}
              aria-label={`Delete ${row.original.name}`}
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
