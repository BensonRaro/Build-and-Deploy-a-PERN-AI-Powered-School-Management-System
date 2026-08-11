/**
 * TimetableGrid — Reusable weekly timetable grid.
 *
 * Renders a week (Mon–Fri) × time-slot table with lesson cards, the same
 * visual language as the Timetable page ("Aura v2" sky theme). Used by the
 * Timetable page, the teacher dashboard (their own lessons), and the student
 * dashboard (their grade's lessons).
 *
 * Props:
 * - slots         — timetable slots to render
 * - onLessonClick — optional; when provided, lessons become clickable
 * - editable      — show "Click to edit" overlay + empty-cell hints
 * - showGrade     — show the class (grade) line instead of the teacher name
 *                   (useful on a teacher's personal schedule)
 */

import { useMemo } from "react";
import {
  ClockIcon,
  MapPinIcon,
  UserIcon,
  GraduationCapIcon,
  SparklesIcon,
} from "lucide-react";
import type { TimetableSlot } from "@/lib/hooks/use-timetable";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

/** School start time in minutes since midnight (8:00 AM = 480) */
const SCHOOL_START = 480;

/** School end time in minutes since midnight (3:00 PM = 900) */
const SCHOOL_END = 900;

/** Period duration in minutes */
const PERIOD_DURATION = 40;

/** Generate time slots for the grid (every 40 min) */
const TIME_SLOTS: Array<{ start: number; end: number; label: string }> = [];
for (let t = SCHOOL_START; t < SCHOOL_END; t += PERIOD_DURATION) {
  const startH = Math.floor(t / 60);
  const startM = t % 60;
  const endH = Math.floor((t + PERIOD_DURATION) / 60);
  const endM = (t + PERIOD_DURATION) % 60;
  TIME_SLOTS.push({
    start: t,
    end: t + PERIOD_DURATION,
    label: `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`,
  });
}

/** Format minutes since midnight to display time */
const fmtTime = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TimetableGrid({
  slots,
  onLessonClick,
  editable = false,
  showGrade = false,
  className,
}: {
  slots: TimetableSlot[];
  onLessonClick?: (slot: TimetableSlot) => void;
  editable?: boolean;
  showGrade?: boolean;
  className?: string;
}) {
  // Build slot lookup per (day, startTime)
  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlot>();
    for (const slot of slots) {
      for (const ts of TIME_SLOTS) {
        if (slot.startTime >= ts.start && slot.startTime < ts.end) {
          map.set(`${slot.dayOfWeek}-${ts.start}`, slot);
          break;
        }
      }
    }
    return map;
  }, [slots]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-b from-background/90 to-background/50 shadow-sm shadow-black/[0.02] backdrop-blur-sm",
        className,
      )}
    >
      {/* Scrollable container for responsive */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] table-auto border-collapse">
          {/* ── Header Row (Days) ────────────────────────────────────── */}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[80px] border-b border-r border-border/20 bg-gradient-to-b from-muted/40 via-muted/20 to-muted/40 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                Time
              </th>
              {DAYS.map((day) => (
                <th
                  key={day.value}
                  className="min-w-[130px] border-b border-border/20 bg-gradient-to-b from-muted/40 via-muted/20 to-muted/40 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Time Slot Rows ───────────────────────────────────────── */}
          <tbody>
            {TIME_SLOTS.map((timeSlot, rowIdx) => {
              const isOddRow = rowIdx % 2 === 0;
              return (
                <tr
                  key={timeSlot.start}
                  className={cn(
                    "transition-colors duration-150",
                    isOddRow ? "bg-background/30" : "bg-background/60",
                  )}
                >
                  {/* Time label cell */}
                  <td className="sticky left-0 z-10 border-b border-r border-border/10 bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground/60 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="size-3 text-muted-foreground/30" />
                      {timeSlot.label}
                    </div>
                  </td>

                  {/* Day cells */}
                  {DAYS.map((day) => {
                    const slot = slotMap.get(`${day.value}-${timeSlot.start}`);
                    const clickable = slot && onLessonClick;
                    return (
                      <td
                        key={`${day.value}-${timeSlot.start}`}
                        className={cn(
                          "border-b border-r border-border/10 px-2 py-1.5",
                          clickable ? "cursor-pointer" : "cursor-default",
                        )}
                        onClick={() => {
                          if (clickable) onLessonClick(slot);
                        }}
                      >
                        {slot ? (
                          /* ── Lesson Card ───────────────────────────── */
                          <div
                            className={cn(
                              "group relative rounded-xl border px-2.5 py-2 transition-all duration-200",
                              "border-sky-200/40 bg-gradient-to-br from-sky-50/80 to-sky-50/40 hover:border-sky-300/60 hover:shadow-sm hover:shadow-sky-200/20",
                              "dark:border-sky-800/30 dark:from-sky-950/40 dark:to-sky-950/20 dark:hover:border-sky-700/40",
                              clickable &&
                                "hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-200/30 dark:hover:shadow-sky-900/20",
                            )}
                          >
                            {/* Subject name */}
                            <p className="truncate text-xs font-semibold text-sky-900 dark:text-sky-200">
                              {slot.subjectName ??
                                slot.teachergradeSubject?.subject?.name ??
                                "Unknown"}
                            </p>

                            {/* Teacher or class line */}
                            {showGrade ? (
                              <div className="mt-0.5 flex items-center gap-1">
                                <GraduationCapIcon className="size-2.5 shrink-0 text-sky-500/50 dark:text-sky-400/50" />
                                <p className="truncate text-[10px] text-sky-600/70 dark:text-sky-300/70">
                                  {slot.teachergradeSubject?.grade
                                    ? `${slot.teachergradeSubject.grade.name} - ${slot.teachergradeSubject.grade.section}`
                                    : "—"}
                                </p>
                              </div>
                            ) : (
                              <div className="mt-0.5 flex items-center gap-1">
                                <UserIcon className="size-2.5 shrink-0 text-sky-500/50 dark:text-sky-400/50" />
                                <p className="truncate text-[10px] text-sky-600/70 dark:text-sky-300/70">
                                  {slot.teacherName ??
                                    slot.teachergradeSubject?.teacher?.user
                                      ?.name ??
                                    "—"}
                                </p>
                              </div>
                            )}

                            {/* Room */}
                            {(slot.room ||
                              slot.teachergradeSubject?.grade?.roomNumber) && (
                              <div className="mt-0.5 flex items-center gap-1">
                                <MapPinIcon className="size-2.5 shrink-0 text-sky-500/40 dark:text-sky-400/40" />
                                <p className="truncate text-[10px] text-sky-600/50 dark:text-sky-300/50">
                                  {slot.room ??
                                    slot.teachergradeSubject?.grade
                                      ?.roomNumber ??
                                    "—"}
                                </p>
                              </div>
                            )}

                            {/* Time range */}
                            <div className="mt-1 flex items-center gap-1">
                              <ClockIcon className="size-2.5 shrink-0 text-sky-500/40 dark:text-sky-400/40" />
                              <p className="text-[10px] text-sky-600/50 dark:text-sky-300/50">
                                {fmtTime(slot.startTime)} —{" "}
                                {fmtTime(slot.endTime)}
                              </p>
                            </div>

                            {/* Edit indicator (admin) */}
                            {editable && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-sky-500/5 opacity-0 backdrop-blur-[1px] transition-all duration-200 group-hover:opacity-100">
                                <span className="rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                  Click to edit
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Empty cell hint (admin) */
                          editable && (
                            <div className="flex h-full min-h-[60px] items-center justify-center rounded-lg border border-dashed border-border/20 text-[10px] text-muted-foreground/20 transition-colors duration-200 hover:border-sky-300/30 hover:text-sky-400/30">
                              Empty
                            </div>
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-border/10 px-4 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
          Legend:
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
          <span className="inline-block size-2.5 rounded bg-sky-200/40 dark:bg-sky-800/40" />
          Lesson slot
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
          <span className="inline-block size-2.5 rounded border border-dashed border-border/20" />
          Available
        </span>
        {editable && (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-sky-500/50">
            <SparklesIcon className="size-2.5" />
            Click lesson to edit
          </span>
        )}
      </div>
    </div>
  );
}
