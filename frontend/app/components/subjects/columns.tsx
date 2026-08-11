/**
 * subjects/columns — Column definitions for the Subjects table.
 *
 * Design (\"Aura v2\"):
 * - Gradient icon circle for each subject
 * - Code badge + description preview
 * - Grade chip and academic year label
 * - Teacher count chip
 * - Hover-reveal action buttons
 */

import type { ColumnDef } from "@tanstack/react-table";
import { SortHeader } from "@/components/globals/data-table";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  BookOpenIcon,
  UsersIcon,
  GraduationCapIcon,
} from "lucide-react";
import type { Subject } from "@/lib/hooks/use-subjects";

interface SubjectColumnsOptions {
  onEdit?: (subject: Subject) => void;
  onDelete?: (subject: Subject) => void;
}

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

export function buildSubjectColumns(
  options?: SubjectColumnsOptions,
): ColumnDef<Subject>[] {
  const { onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 280,
      header: ({ column }) => SortHeader("Subject", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 shadow-sm ring-1 ring-emerald-500/10 dark:text-emerald-400">
            <BookOpenIcon className="size-4.5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {row.getValue("name")}
              </span>
              <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground/60 uppercase tracking-wider">
                {row.original.code}
              </span>
            </div>
            {row.original.description && (
              <span className="max-w-[200px] truncate text-[11px] text-muted-foreground/40">
                {row.original.description}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "grade",
      size: 160,
      header: ({ column }) => SortHeader("Grade", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
          <GraduationCapIcon className="size-3.5 text-muted-foreground/30" />
          {row.original.grade.name} - {row.original.grade.section}
        </span>
      ),
    },
    {
      accessorKey: "academicYear",
      size: 140,
      header: "Academic Year",
      cell: ({ row }) => (
        <span className="text-sm text-foreground/70">
          {row.original.academicYear.name}
        </span>
      ),
    },
    {
      id: "teachers",
      size: 120,
      header: "Teachers",
      cell: ({ row }) => {
        const { teachers } = row.original._count;
        return (
          <ResourceChip
            count={teachers}
            label="assigned"
            icon={UsersIcon}
          />
        );
      },
    },
    {
      id: "actions",
      size: 80,
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-xs"
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
              size="icon-xs"
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
