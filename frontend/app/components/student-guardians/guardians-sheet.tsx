/**
 * GuardiansSheet — A shadcn Sheet for managing guardian links for a student.
 *
 * Design ("Aura v2"):
 * - Glass-morphism sheet with gradient accent
 * - Currently linked guardians list with relation badges and action buttons
 * - "Link Guardian" section with parent selector, relation picker, contact flags
 * - Animated list entries with hover states
 *
 * Following the TermsSheet pattern from academic-years.
 */

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { Loader } from "@/components/globals/loader";
import {
  useStudentGuardians,
  useCreateStudentGuardian,
  useDeleteStudentGuardian,
  type GuardianRelation,
} from "@/lib/hooks/use-student-guardians";
import { useUsers, type User } from "@/lib/hooks/use-users";
import {
  PlusIcon,
  TrashIcon,
  UsersIcon,
  HeartIcon,
  PhoneIcon,
  AlertTriangleIcon,
  UserCheckIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
  SparklesIcon,
  MailIcon,
  ShieldIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const RELATION_OPTIONS: { value: GuardianRelation; label: string }[] = [
  { value: "FATHER", label: "Father" },
  { value: "MOTHER", label: "Mother" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "OTHER", label: "Other" },
];

const RELATION_COLORS: Record<GuardianRelation, string> = {
  FATHER: "bg-gradient-to-r from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400 ring-blue-500/10",
  MOTHER: "bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 ring-rose-500/10",
  GUARDIAN: "bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 ring-amber-500/10",
  OTHER: "bg-gradient-to-r from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400 ring-slate-500/10",
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface GuardiansSheetProps {
  /** The selected student user (with studentProfile) */
  student: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function GuardiansSheet({
  student,
  open,
  onOpenChange,
}: GuardiansSheetProps) {
  const studentProfileId = student?.studentProfile?.id;

  // ── Queries ──────────────────────────────────────────────────────────────
  const {
    data: guardians,
    isLoading: guardiansLoading,
    isError: guardiansError,
    refetch: refetchGuardians,
  } = useStudentGuardians(
    studentProfileId ? { studentId: studentProfileId } : undefined,
  );
  const { data: parentUsers } = useUsers({ role: "PARENT" });

  const createLink = useCreateStudentGuardian();
  const deleteLink = useDeleteStudentGuardian();

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedRelation, setSelectedRelation] = useState<GuardianRelation>("GUARDIAN");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);

  // ── Filtered parents list based on search ────────────────────────────────
  const filteredParents = useMemo(() => {
    if (!parentUsers) return [];
    const alreadyLinked = new Set(
      guardians?.map((g) => g.parent.user.id) ?? [],
    );

    return parentUsers
      .filter((p) => p.parentProfile && !alreadyLinked.has(p.id))
      .filter((p) => {
        if (!parentSearch.trim()) return true;
        const q = parentSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.parentProfile?.phone?.toLowerCase().includes(q)
        );
      });
  }, [parentUsers, guardians, parentSearch]);

  // Parent select options (null placeholder item shows before any selection;
  // `value={state || null}` keeps the real state a "" so null never reaches
  // the backend)
  const parentOptions = useMemo(
    () => [
      { label: "Choose a parent", value: null as string | null },
      ...filteredParents.map((p) => ({ label: p.name, value: p.id })),
    ],
    [filteredParents],
  );

  // ── Reset form when dialog opens/closes ─────────────────────────────────
  const handleClose = () => {
    onOpenChange(false);
    setSelectedParentId("");
    setSelectedRelation("GUARDIAN");
    setIsPrimary(false);
    setIsEmergency(false);
    setParentSearch("");
  };

  // ── Link a guardian ─────────────────────────────────────────────────────
  const handleLinkGuardian = async () => {
    if (!selectedParentId || !studentProfileId) return;

    // Find the selected parent to get their parentProfile ID
    const parent = parentUsers?.find((p) => p.id === selectedParentId);
    if (!parent?.parentProfile) return;

    setIsSaving(true);
    try {
      await createLink.mutateAsync({
        studentId: studentProfileId,
        parentId: parent.parentProfile.id,
        relation: selectedRelation,
        isPrimaryContact: isPrimary,
        isEmergencyContact: isEmergency,
      });
      // Reset form
      setSelectedParentId("");
      setSelectedRelation("GUARDIAN");
      setIsPrimary(false);
      setIsEmergency(false);
      setParentSearch("");
    } catch {
      // Toast handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  // ── Unlink a guardian ───────────────────────────────────────────────────
  const handleUnlinkGuardian = (linkId: string) => {
    setPendingUnlink(linkId);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto border-l border-border/20 bg-background/95 p-0 backdrop-blur-xl sm:max-w-lg"
      >
        {/* ── Gradient header ──────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-border/10">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-500/[0.06] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-gradient-to-br from-sky-500/10 to-transparent blur-3xl"
          />

          <SheetHeader className="relative px-6 pb-4 pt-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 text-sky-600 shadow-sm ring-1 ring-sky-500/10 dark:text-sky-400">
                <HeartIcon className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-lg font-bold tracking-tight text-foreground">
                  Guardians
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground/60">
                  {student
                    ? `Manage guardians for ${student.name}`
                    : "Manage student guardians"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 space-y-6 px-6 py-5">
          {/* ══════════════════════════════════════════════════════════════
               CURRENTLY LINKED GUARDIANS
               ══════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserCheckIcon className="size-4 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-foreground/80">
                Linked Guardians
              </h3>
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/50">
                {guardians?.length ?? 0}
              </span>
            </div>

            {guardiansLoading && (
              <Loader variant="card" text="Loading guardians…" size="sm" />
            )}

            {guardiansError && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/15 bg-destructive/[0.03] px-4 py-6">
                <AlertTriangleIcon className="size-8 text-destructive/40" />
                <p className="text-xs text-destructive/70">
                  Failed to load guardians.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchGuardians()}
                  className="border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  Retry
                </Button>
              </div>
            )}

            {!guardiansLoading && !guardiansError && guardians?.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border/20 bg-muted/20 px-4 py-8">
                <HeartIcon className="size-10 text-muted-foreground/20" />
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground/70">
                    No guardians linked
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/50">
                    Use the section below to link a parent as guardian.
                  </p>
                </div>
              </div>
            )}

            {guardians && guardians.length > 0 && (
              <div className="space-y-2">
                {guardians.map((link) => (
                  <div
                    key={link.id}
                    className="group relative overflow-hidden rounded-xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-3.5 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-200 hover:border-border/30 hover:shadow-md"
                  >
                    {/* Decorative blob */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-8 -top-8 size-16 rounded-full bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <div className="relative flex items-center gap-3">
                      <Avatar className="size-9 shrink-0 ring-1 ring-border/20">
                        <AvatarFallback className="bg-gradient-to-br from-sky-500/20 to-sky-500/10 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                          {link.parent.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {link.parent.user.name}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] shadow-sm ring-1",
                              RELATION_COLORS[link.relation],
                            )}
                          >
                            {link.relation}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {link.isPrimaryContact && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                            >
                              <PhoneIcon className="mr-0.5 size-2.5" />
                              Primary
                            </Badge>
                          )}
                          {link.isEmergencyContact && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/20 bg-amber-500/5 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                            >
                              <AlertTriangleIcon className="mr-0.5 size-2.5" />
                              Emergency
                            </Badge>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnlinkGuardian(link.id)}
                        aria-label={`Remove ${link.parent.user.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/30 opacity-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Divider ────────────────────────────────────────────────── */}
          <div className="border-t border-border/20" />

          {/* ══════════════════════════════════════════════════════════════
               LINK GUARDIAN FORM
               ══════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <PlusIcon className="size-4 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-foreground/80">
                Link a Guardian
              </h3>
            </div>

            {/* Parent selector with search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Select Parent
              </label>

              {/* Search input */}
              <div className="relative mb-2">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/30" />
                <Input
                  type="text"
                  placeholder="Search parents…"
                  value={parentSearch}
                  onChange={(e) => setParentSearch(e.target.value)}
                  className="h-9 border-border/30 bg-background/60 pl-9 text-sm backdrop-blur-sm transition-all duration-200 focus-visible:border-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-500/10"
                />
              </div>

              <ReusableMultiSelect
                value={selectedParentId}
                onValueChange={(v) => setSelectedParentId(v)}
                options={filteredParents.map((p) => ({
                  value: p.id,
                  label: (
                    <span className="flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {p.email}
                      </span>
                    </span>
                  ),
                }))}
                placeholder="Choose a parent"
                icon={UsersIcon}
                accent="sky"
                emptyMessage={
                  parentSearch.trim()
                    ? "No matching parents found"
                    : "No unlinked parents available"
                }
              />
            </div>

            {/* Relation selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Relation
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RELATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRelation(opt.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all duration-200",
                      selectedRelation === opt.value
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-600 shadow-sm dark:text-sky-400"
                        : "border-border/20 bg-background/60 text-muted-foreground/60 hover:border-border/30 hover:bg-muted/30",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact flags */}
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/20 bg-background/60 px-3 py-2.5 transition-all duration-200 hover:border-border/30 hover:bg-muted/20">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="size-4 rounded border-border/40 text-sky-500 focus:ring-sky-500/30 focus:ring-offset-0"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground/80">
                    Primary Contact
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    Main point of contact
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/20 bg-background/60 px-3 py-2.5 transition-all duration-200 hover:border-border/30 hover:bg-muted/20">
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="size-4 rounded border-border/40 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground/80">
                    Emergency Contact
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                      Notify in emergencies
                  </span>
                </div>
              </label>
            </div>

            <Button
              type="button"
              onClick={handleLinkGuardian}
              disabled={!selectedParentId || isSaving}
              className="w-full bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md shadow-sky-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/30 disabled:opacity-50"
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <SparklesIcon className="size-4 animate-pulse" />
                  Linking…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <PlusIcon className="size-4" />
                  Link Guardian
                </span>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* ═══════════════════════════════════════════════════════════════════
           DELETE CONFIRMATION DIALOG
           ═══════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        open={!!pendingUnlink}
        onOpenChange={(o) => !o && setPendingUnlink(null)}
        title="Remove Guardian?"
        description="This will unlink this guardian from the student. No data is deleted."
        onConfirm={() => {
          if (pendingUnlink) deleteLink.mutate(pendingUnlink);
          setPendingUnlink(null);
        }}
      />
    </Sheet>
  );
}
