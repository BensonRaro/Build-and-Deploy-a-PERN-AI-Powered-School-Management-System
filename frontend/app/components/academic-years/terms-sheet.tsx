/**
 * TermsSheet — Full CRUD for Terms inside a premium Shadcn Sheet.
 *
 * Design ("Aura v2"):
 * - Gradient header strip with decorative glow element
 * - Glass-morphism term cards with hover elevation
 * - Icon-enhanced form fields
 * - Smooth animated transitions between list/form states
 * - Premium empty and loading states
 */

import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
  GraduationCapIcon,
  XIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { Loader } from "@/components/globals/loader";
import { cn } from "@/lib/utils";
import {
  useTerms,
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
  type AcademicYear,
  type Term,
} from "@/lib/hooks/use-academic-years";

// ─── Props ──────────────────────────────────────────────────────────────────

interface TermsSheetProps {
  academicYear: AcademicYear | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Form State ─────────────────────────────────────────────────────────────

type TermFormMode = "create" | "edit";

interface TermFormState {
  mode: TermFormMode;
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

const EMPTY_FORM: TermFormState = {
  mode: "create",
  name: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TermsSheet({
  academicYear,
  open,
  onOpenChange,
}: TermsSheetProps) {
  const yearId = academicYear?.id;
  const { data: terms, isLoading, isError, refetch } = useTerms(yearId);
  const createTerm = useCreateTerm();
  const updateTerm = useUpdateTerm();
  const deleteTerm = useDeleteTerm();

  const [form, setForm] = useState<TermFormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setForm(EMPTY_FORM);
    }
  }, [open]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = () => {
    setForm({
      ...EMPTY_FORM,
      startDate: academicYear?.startDate
        ? format(parseISO(academicYear.startDate), "yyyy-MM-dd")
        : "",
      endDate: academicYear?.endDate
        ? format(parseISO(academicYear.endDate), "yyyy-MM-dd")
        : "",
    });
    setAnimatingOut(false);
    setShowForm(true);
  };

  const handleEdit = (term: Term) => {
    setForm({
      mode: "edit",
      id: term.id,
      name: term.name,
      startDate: format(parseISO(term.startDate), "yyyy-MM-dd"),
      endDate: format(parseISO(term.endDate), "yyyy-MM-dd"),
      isCurrent: term.isCurrent,
    });
    setAnimatingOut(false);
    setShowForm(true);
  };

  const handleDelete = (term: Term) => {
    if (!yearId) return;
    setPendingDelete({
      id: term.id,
      title: term.name,
      description: "This action cannot be undone.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearId) return;

    if (!form.name.trim()) {
      toast.error("Term name is required");
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error("Both start and end dates are required");
      return;
    }
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      toast.error("Start date must be before end date");
      return;
    }

    setIsSubmitting(true);

    try {
      if (form.mode === "create") {
        await createTerm.mutateAsync({
          name: form.name.trim(),
          academicYearId: yearId,
          startDate: form.startDate,
          endDate: form.endDate,
          isCurrent: form.isCurrent,
        });
      } else if (form.id) {
        await updateTerm.mutateAsync({
          id: form.id,
          academicYearId: yearId,
          data: {
            name: form.name.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
            isCurrent: form.isCurrent,
          },
        });
      }

      setAnimatingOut(true);
      clearTimeout(cancelTimer.current);
      cancelTimer.current = setTimeout(() => {
        setShowForm(false);
        setForm(EMPTY_FORM);
        setAnimatingOut(false);
      }, 200);
    } catch {
      // Toast handled by mutation's onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCancel = () => {
    setAnimatingOut(true);
    clearTimeout(cancelTimer.current);
    cancelTimer.current = setTimeout(() => {
      setShowForm(false);
      setForm(EMPTY_FORM);
      setAnimatingOut(false);
    }, 150);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-border/20 bg-gradient-to-b from-background via-background to-muted/20 p-0 sm:max-w-lg"
      >
        {/* ── Gradient Header ───────────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          {/* Decorative glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 size-40 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -left-10 size-24 rounded-full bg-gradient-to-tr from-primary/5 to-transparent blur-2xl"
          />

          <SheetHeader className="relative border-b border-border/10 px-6 pb-5 pt-6">
            <SheetTitle className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
                <GraduationCapIcon className="size-4.5" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Terms:{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {academicYear?.name}
                </span>
              </span>
            </SheetTitle>
            <SheetDescription className="mt-1.5 space-y-1">
              <p className="text-sm text-muted-foreground/70">
                Manage academic terms within this academic year.
              </p>
              {academicYear && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50">
                  <CalendarIcon className="size-3" />
                  {format(parseISO(academicYear.startDate), "MMM d, yyyy")}
                  <span className="text-muted-foreground/30">—</span>
                  {format(parseISO(academicYear.endDate), "MMM d, yyyy")}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex-1 overflow-y-auto px-6 py-5 transition-all duration-300",
            showForm && "overflow-hidden",
          )}
        >
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader variant="spinner" size="md" text="Loading terms…" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-destructive/10 blur-xl" />
                <CalendarIcon className="relative size-10 text-destructive/40" />
              </div>
              <p className="text-sm font-medium text-destructive">
                Failed to load terms.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="border-border/30"
              >
                Retry
              </Button>
            </div>
          ) : showForm ? (
            /* ── Create / Edit Form ─────────────────────────────────── */
            <div
              className={cn(
                "transition-all duration-300",
                animatingOut
                  ? "translate-x-4 opacity-0"
                  : "translate-x-0 opacity-100",
              )}
            >
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-foreground">
                  {form.mode === "create" ? "New Term" : "Edit Term"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  {form.mode === "create"
                    ? "Add a term to this academic year."
                    : "Update the term details below."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="term-name"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Term Name
                  </Label>
                  <div className="relative">
                    <GraduationCapIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      id="term-name"
                      placeholder="e.g. Term 1"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="term-start"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Start Date
                    </Label>
                    <div className="relative">
                      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="term-start"
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="term-end"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      End Date
                    </Label>
                    <div className="relative">
                      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="term-end"
                        type="date"
                        value={form.endDate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/20 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40">
                  <input
                    id="term-is-current"
                    type="checkbox"
                    checked={form.isCurrent}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isCurrent: e.target.checked,
                      }))
                    }
                    className="size-4 rounded border-border/40 text-primary focus:ring-primary/30 focus:ring-offset-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/80">
                      Set as current term
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      Marks this term as the active academic period
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
                  >
                    {isSubmitting
                      ? "Saving…"
                      : form.mode === "create"
                        ? "Create Term"
                        : "Update Term"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="border-border/30"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* ── Terms List ──────────────────────────────────────────── */
            <div
              className={cn(
                "space-y-2.5 transition-all duration-300",
                animatingOut && "translate-x-4 opacity-0",
              )}
            >
              {terms && terms.length > 0 ? (
                terms.map((term, idx) => (
                  <div
                    key={term.id}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border border-border/20 bg-gradient-to-br from-background to-muted/10 p-4 shadow-sm shadow-black/[0.02] transition-all duration-200",
                      "hover:border-border/40 hover:shadow-md hover:shadow-black/[0.04]",
                      "hover:-translate-y-0.5",
                    )}
                    style={{
                      transitionDelay: `${idx * 30}ms`,
                    }}
                  >
                    {/* Subtle top gradient line */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                            <GraduationCapIcon className="size-3" />
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {term.name}
                          </span>
                          {term.isCurrent && (
                            <Badge
                              variant="default"
                              className="h-5 bg-primary/10 px-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary shadow-none hover:bg-primary/15"
                            >
                              <span className="relative mr-1 inline-flex size-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                              </span>
                              Active
                            </Badge>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50">
                          <ClockIcon className="size-3" />
                          {format(parseISO(term.startDate), "MMM d, yyyy")}
                          <span className="text-muted-foreground/30">—</span>
                          {format(parseISO(term.endDate), "MMM d, yyyy")}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleEdit(term)}
                          aria-label={`Edit ${term.name}`}
                          className="text-muted-foreground/40 opacity-0 transition-all duration-200 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        >
                          <PencilIcon className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(term)}
                          aria-label={`Delete ${term.name}`}
                          className="text-muted-foreground/40 opacity-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <TrashIcon className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* ── Empty state ────────────────────────────────────── */
                <div className="flex flex-col items-center gap-4 py-14 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl" />
                    <CalendarIcon className="relative size-12 text-muted-foreground/20" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground/70">
                      No terms yet
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/50">
                      Add the first term to this academic year.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <SheetFooter className="border-t border-border/10 bg-gradient-to-t from-background via-background to-transparent px-6 py-4">
          {!showForm && (
            <Button
              onClick={handleCreate}
              className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
              size="default"
            >
              <PlusIcon className="mr-1.5 size-4" />
              Add Term
            </Button>
          )}
          {showForm && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="w-full text-muted-foreground/60"
              size="sm"
            >
              <XIcon className="mr-1.5 size-4" />
              Cancel &amp; Back to List
            </Button>
          )}
        </SheetFooter>
      </SheetContent>

      {/* ═══════════════════════════════════════════════════════════════════
           DELETE CONFIRMATION DIALOG
           ═══════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete && yearId)
            deleteTerm.mutate({
              id: pendingDelete.id,
              academicYearId: yearId,
            });
          setPendingDelete(null);
        }}
      />
    </Sheet>
  );
}
