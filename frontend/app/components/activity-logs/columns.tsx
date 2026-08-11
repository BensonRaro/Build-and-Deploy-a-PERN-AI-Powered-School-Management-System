/**
 * activity-logs/columns — Column definitions for the Activity Logs table.
 *
 * Design ("Aura v2"):
 * - Timeline-style with colored activity type indicators
 * - User avatar + name display
 * - Relative timestamps with full-date tooltip
 * - Hover-reveal detail preview
 */

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { SortHeader } from "@/components/globals/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ActivityLog,
  formatActivityLabel,
  getActivityColor,
} from "@/lib/hooks/use-activity-logs";

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Colored activity type badge */
function ActivityBadge({ activity }: { activity: string }) {
  const colors = getActivityColor(activity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-inset",
        colors.bg,
        colors.text,
        colors.bg.replace("bg-", "ring-").replace("/10", "/20"),
      )}
    >
      <span className={cn("inline-block size-1.5 rounded-full", colors.dot)} />
      {formatActivityLabel(activity)}
    </span>
  );
}

/** User display with avatar */
function UserDisplay({ user }: { user: ActivityLog["user"] }) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <span className="inline-flex items-center gap-2">
      <Avatar className="size-6 ring-1 ring-border/20">
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-[9px] font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm text-foreground/80">{user.name}</span>
    </span>
  );
}

/** Relative time with tooltip */
function TimeDisplay({ dateStr }: { dateStr: string }) {
  const date = parseISO(dateStr);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-muted-foreground"
      title={format(date, "MMM d, yyyy 'at' h:mm:ss a")}
    >
      <CalendarIcon className="size-3 text-muted-foreground/30" />
      <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
    </span>
  );
}

/** Detail preview with truncation */
function DetailCell({ details }: { details: string | null }) {
  if (!details) {
    return (
      <span className="text-xs italic text-muted-foreground/30">
        No details
      </span>
    );
  }
  return (
    <span
      className="line-clamp-2 max-w-[280px] text-xs text-muted-foreground/60"
      title={details}
    >
      {details}
    </span>
  );
}

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildActivityLogColumns(): ColumnDef<ActivityLog>[] {
  return [
    {
      accessorKey: "activity",
      size: 180,
      header: ({ column }) => SortHeader("Activity", { column }),
      cell: ({ row }) => <ActivityBadge activity={row.original.activity} />,
    },
    {
      accessorKey: "user",
      size: 180,
      header: "User",
      cell: ({ row }) => <UserDisplay user={row.original.user} />,
    },
    {
      accessorKey: "details",
      size: 300,
      header: "Details",
      cell: ({ row }) => <DetailCell details={row.original.details} />,
    },
    {
      accessorKey: "createdAt",
      size: 140,
      header: ({ column }) => SortHeader("Timestamp", { column }),
      cell: ({ row }) => <TimeDisplay dateStr={row.original.createdAt} />,
    },
  ];
}
