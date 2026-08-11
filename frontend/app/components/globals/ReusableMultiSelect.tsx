"use client";

/**
 * ReusableMultiSelect — a thin, reusable wrapper around the base
 * MultiSelect primitives (components/ui/multi-select) for picking one or
 * many items from a list.
 *
 * It replaces the old DbSelect (single-select only) and adds:
 *  - multi-select support, ready for react-hook-form:
 *      <ReusableMultiSelect
 *        values={field.value || []}   // always an array
 *        onValuesChange={field.onChange}
 *        options={options}            // [{ value, label, disabled?, group? }]
 *        placeholder="Pick grades"
 *        name={field.name}
 *        loading={loading}
 *      />
 *  - single-select mode (legacy DbSelect behavior), kept API-compatible so
 *    the ~13 dashboard pages keep working unchanged:
 *      <ReusableMultiSelect
 *        value={gradeId}
 *        onValueChange={setGradeId}
 *        options={gradeOptions}
 *        placeholder="Select grade"
 *        icon={GraduationCapIcon}
 *        accent="emerald"
 *      />
 *
 * What it handles for you:
 *  - single / multi value binding (auto-detected from the props you pass)
 *  - option rendering, including `disabled` rows and `group` headings
 *  - null-value placeholder entries (e.g. "All years") — filtered out
 *  - loading ("Loading options…") and empty ("No options available") states
 *  - an optional leading icon (rendered with the trigger's pl-9 padding)
 *  - the per-page accent focus ring (sky/emerald/teal/rose/violet/amber/slate)
 *  - a search input inside the dropdown (always visible by default)
 */

import { Fragment } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select";

/** A single selectable option. `value: null` entries (placeholder rows) are ignored. */
export interface ReusableMultiSelectOption {
  value?: string | null;
  label: ReactNode;
  disabled?: boolean;
  /** When set, consecutive options sharing a group render under one heading. */
  group?: string;
}

/** Per-page accent used for the trigger's focus ring. */
export type ReusableMultiSelectAccent =
  "sky" | "emerald" | "teal" | "rose" | "violet" | "amber" | "slate" | "indigo";

const ACCENT_CLASSES: Record<ReusableMultiSelectAccent, string> = {
  sky: "focus-visible:border-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-500/10",
  emerald:
    "focus-visible:border-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/10",
  teal: "focus-visible:border-teal-500/30 focus-visible:ring-2 focus-visible:ring-teal-500/10",
  rose: "focus-visible:border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-500/10",
  violet:
    "focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10",
  amber:
    "focus-visible:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-500/10",
  slate:
    "focus-visible:border-slate-500/30 focus-visible:ring-2 focus-visible:ring-slate-500/10",
  indigo:
    "focus-visible:border-indigo-500/30 focus-visible:ring-2 focus-visible:ring-indigo-500/10",
};

export interface ReusableMultiSelectProps {
  /** Single-select value — "" means nothing selected. */
  value?: string;
  /** Single-select change handler. */
  onValueChange?: (value: string) => void;
  /** Multi-select values — pass an array (RHF: field.value || []). */
  values?: string[];
  /** Multi-select change handler (RHF: field.onChange). */
  onValuesChange?: (values: string[]) => void;
  /** Options rendered in the dropdown. Null-value entries are skipped. */
  options: ReusableMultiSelectOption[];
  /** Placeholder shown while nothing is selected. */
  placeholder?: string;
  /** Optional leading icon inside the trigger. */
  icon?: LucideIcon;
  /** Field name — also used as the trigger's id when `id` isn't given. */
  name?: string;
  /** Passed through to the trigger button (takes precedence over `name`). */
  id?: string;
  disabled?: boolean;
  /** Show a "Loading options…" state instead of the list. */
  loading?: boolean;
  /** Custom text while `loading` is true. */
  loadingText?: string;
  /** Shown in place of the list when there are no options. */
  emptyMessage?: ReactNode;
  /**
   * Search input in the dropdown. Defaults to `true` so it is always visible;
   * pass an object to customize the placeholder / "no results" message, or
   * `false` to hide it entirely.
   */
  search?: boolean | { placeholder?: string; emptyMessage?: string };
  accent?: ReusableMultiSelectAccent;
  /** Extra classes for the outer wrapper (e.g. sizing). */
  className?: string;
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  /** Extra classes for the dropdown content. */
  contentClassName?: string;
}

/**
 * Groups consecutive options under a heading — mirrors the original
 * MultiSelectGroup usage (e.g. borrowers grouped by role in the library desk).
 */
function renderOptions(options: ReusableMultiSelectOption[]) {
  const groups: {
    heading: string | null;
    options: ReusableMultiSelectOption[];
  }[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (option.group && last && last.heading === option.group) {
      last.options.push(option);
    } else {
      groups.push({ heading: option.group ?? null, options: [option] });
    }
  }

  return groups.map((group, groupIndex) => {
    const items = group.options.map((option) => (
      <MultiSelectItem
        key={option.value!}
        value={option.value!}
        disabled={option.disabled}
      >
        {option.label}
      </MultiSelectItem>
    ));
    return group.heading ? (
      <MultiSelectGroup key={group.heading} heading={group.heading}>
        {items}
      </MultiSelectGroup>
    ) : (
      <Fragment key={`reusable-multi-select-group-${groupIndex}`}>
        {items}
      </Fragment>
    );
  });
}

export function ReusableMultiSelect({
  value,
  onValueChange,
  values,
  onValuesChange,
  options,
  placeholder,
  icon: Icon,
  name,
  id,
  disabled,
  loading = false,
  loadingText = "Loading options…",
  emptyMessage,
  search = true,
  accent = "indigo",
  className,
  triggerClassName,
  contentClassName,
}: ReusableMultiSelectProps) {
  // Multi-select mode is on whenever the array-based props are used; otherwise
  // fall back to single-select (legacy DbSelect API).
  const isMulti = values !== undefined || onValuesChange !== undefined;
  const items = options.filter((option) => option.value != null);
  // Whether a search input is shown — mirrors MultiSelectContent's logic
  const canSearch = typeof search === "object" ? true : search;

  const select = (
    <MultiSelect
      values={isMulti ? (values ?? []) : value ? [value] : []}
      onValuesChange={(vals) => {
        if (isMulti) {
          onValuesChange?.(vals);
        } else {
          onValueChange?.(vals[0] ?? "");
        }
      }}
      single={!isMulti}
    >
      <MultiSelectTrigger
        id={id ?? name}
        disabled={disabled || loading}
        className={cn(
          "h-9 w-full border-border/30 bg-background/60 text-sm backdrop-blur-sm transition-all duration-200",
          ACCENT_CLASSES[accent],
          Icon && "pl-9",
          triggerClassName,
        )}
      >
        <MultiSelectValue placeholder={placeholder} />
      </MultiSelectTrigger>
      <MultiSelectContent
        search={search}
        className={cn("border-border/30", contentClassName)}
      >
        <MultiSelectGroup>
          {loading ? (
            // With search enabled, render the loading message as a disabled item
            // so cmdk counts it and its CommandEmpty doesn't double-render.
            canSearch ? (
              <MultiSelectItem value="__reusable-loading__" disabled>
                {loadingText}
              </MultiSelectItem>
            ) : (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground/50">
                {loadingText}
              </div>
            )
          ) : items.length > 0 ? (
            renderOptions(items)
          ) : emptyMessage ? (
            // With search enabled, render the empty message as a disabled item so
            // cmdk counts it and its own CommandEmpty doesn't double-render.
            canSearch ? (
              <MultiSelectItem value="__reusable-empty__" disabled>
                {emptyMessage}
              </MultiSelectItem>
            ) : (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground/50">
                {emptyMessage}
              </div>
            )
          ) : (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground/50">
              No options available
            </div>
          )}
        </MultiSelectGroup>
      </MultiSelectContent>
    </MultiSelect>
  );

  const withIcon = Icon ? (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/30" />
      {select}
    </div>
  ) : (
    select
  );

  return className ? <div className={className}>{withIcon}</div> : withIcon;
}
