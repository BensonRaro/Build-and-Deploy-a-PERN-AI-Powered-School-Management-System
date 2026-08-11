/**
 * announcements/columns — Column definitions for the Announcements table.
 *
 * Design ("Aura v2"):
 * - Gradient megaphone icon for each announcement
 * - Content preview with truncation
 * - Target role chips with color coding
 * - Author avatar + name display
 * - Relative timestamp
 * - Hover-reveal action buttons
 */

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { SortHeader } from "@/components/globals/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  MegaphoneIcon,
  CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/lib/hooks/use-announcements";

// ─── Options ────────────────────────────────────────────────────────────────

interface AnnouncementColumnsOptions {
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (announcement: Announcement) => void;
}

// ─── Shared Components ──────────────────────────────────────────────────────

/** Role badge colors */
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-gradient-to-r from-purple-500/15 to-purple-500/5 text-purple-600 dark:text-purple-400 ring-purple-500/10",
  PRINCIPAL: "bg-gradient-to-r from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 ring-indigo-500/10",
  VICE_PRINCIPAL: "bg-gradient-to-r from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 ring-indigo-500/10",
  TEACHER: "bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 ring-amber-500/10",
  LIBRARIAN: "bg-gradient-to-r from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400 ring-teal-500/10",
  ACCOUNTANT: "bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400 ring-cyan-500/10",
  COUNSELOR: "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10",
  STAFF: "bg-gradient-to-r from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400 ring-slate-500/10",
  STUDENT: "bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 ring-rose-500/10",
  PARENT: "bg-gradient-to-r from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400 ring-sky-500/10",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Admin",
  VICE_PRINCIPAL: "V. Principal",
};

/** Target role chip */
function TargetRoleChip({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] shadow-sm ring-1",
        ROLE_COLORS[role] ?? "bg-muted/30 text-muted-foreground ring-border/20",
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

/** Relative time display */
function TimeAgo({ dateStr }: { dateStr: string }) {
  const date = parseISO(dateStr);
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={format(date, "MMM d, yyyy 'at' h:mm a")}>
      <CalendarIcon className="size-3 text-muted-foreground/30" />
      <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
    </span>
  );
}

/** Author display with avatar */
function AuthorDisplay({ author }: { author: Announcement["author"] }) {
  const initials = author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <span className="inline-flex items-center gap-2">
      <Avatar className="size-6 ring-1 ring-border/20">
        <AvatarFallback className="bg-gradient-to-br from-purple-500/20 to-purple-500/10 text-[9px] font-semibold text-purple-600 dark:text-purple-400">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-foreground/80">{author.name}</span>
    </span>
  );
}

/** Action buttons */
function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onEdit}
          aria-label="Edit announcement"
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
          aria-label="Delete announcement"
          className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildAnnouncementColumns(
  options?: AnnouncementColumnsOptions,
): ColumnDef<Announcement>[] {
  const { onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "title",
      size: 300,
      header: ({ column }) => SortHeader("Announcement", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-600 shadow-sm ring-1 ring-purple-500/10 dark:text-purple-400">
            <MegaphoneIcon className="size-4.5" />
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">
              {row.original.title}
            </span>
            <span className="max-w-[240px] truncate text-[11px] text-muted-foreground/40">
              {row.original.content}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "targetRoles",
      size: 200,
      header: "Targets",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.original.targetRoles.map((role) => (
            <TargetRoleChip key={role} role={role} />
          ))}
        </div>
      ),
    },
    {
      accessorKey: "author",
      size: 180,
      header: "Author",
      cell: ({ row }) => <AuthorDisplay author={row.original.author} />,
    },
    {
      accessorKey: "createdAt",
      size: 140,
      header: ({ column }) => SortHeader("Published", { column }),
      cell: ({ row }) => <TimeAgo dateStr={row.original.createdAt} />,
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
