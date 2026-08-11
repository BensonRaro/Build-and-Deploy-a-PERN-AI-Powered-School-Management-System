/**
 * stat-card — Shared dashboard stat card ("Aura v2").
 *
 * Gradient icon tile + label + value with a hover lift and a decorative
 * gradient blob. Used across every role dashboard for consistency.
 */

import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04]">
      {/* Decorative gradient blob */}
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
          {sub && (
            <span className="text-[10px] text-muted-foreground/40">{sub}</span>
          )}
        </div>
      </div>
    </div>
  );
}
