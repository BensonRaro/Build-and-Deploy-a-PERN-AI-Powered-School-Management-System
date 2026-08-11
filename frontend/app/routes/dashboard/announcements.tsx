/**
 * Announcements Page — /dashboard/announcements
 *
 * Design ("Aura v2") — purple/violet tones for Announcements:
 * - Gradient hero banner with animated decorative blobs
 * - Live stat cards showing aggregate metrics
 * - Premium DataTable with search, pagination, hover effects
 * - Stunning Dialog for create/edit with role multi-select
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  MegaphoneIcon,
  UsersIcon,
  CalendarIcon,
  UserIcon,
  XIcon,
  SparklesIcon,
  FileTextIcon,
  CheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/globals/data-table";
import { buildAnnouncementColumns } from "@/components/announcements/columns";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  ROLE_OPTIONS,
  type Announcement,
} from "@/lib/hooks/use-announcements";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/announcements";

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04] hover:-translate-y-0.5">
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
        </div>
      </div>
    </div>
  );
}

// ─── Role Chip (for form) ───────────────────────────────────────────────────

function RoleToggleChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
        selected
          ? "border-purple-500/30 bg-purple-500/10 text-purple-600 shadow-sm dark:text-purple-400"
          : "border-border/20 bg-background/60 text-muted-foreground/60 hover:border-border/30 hover:bg-muted/30",
      )}
    >
      {selected && <CheckIcon className="size-3" />}
      {label}
    </button>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Announcements — Biasly" },
    {
      name: "description",
      content:
        "Create and manage school announcements for students, teachers, and parents.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: announcements, isLoading, isError, refetch } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTargetRoles, setFormTargetRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // ── Toggle role selection ────────────────────────────────────────────────
  const toggleRole = (role: string) => {
    setFormTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!announcements)
      return { total: 0, roles: 0, authors: 0, recent: 0 };
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const total = announcements.length;
    const roleSet = new Set(announcements.flatMap((a) => a.targetRoles));
    const authorSet = new Set(announcements.map((a) => a.authorId));
    const recent = announcements.filter(
      (a) => new Date(a.createdAt) > weekAgo,
    ).length;
    return { total, roles: roleSet.size, authors: authorSet.size, recent };
  }, [announcements]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildAnnouncementColumns({
    onEdit: (announcement) => {
      setEditingAnnouncement(announcement);
      setFormTitle(announcement.title);
      setFormContent(announcement.content);
      setFormTargetRoles(announcement.targetRoles);
      setDialogOpen(true);
    },
    onDelete: (announcement) => {
      setPendingDelete({
        id: announcement.id,
        title: announcement.title,
        description: "This action cannot be undone.",
      });
    },
  });

  // ── Form handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingAnnouncement(null);
    setFormTitle("");
    setFormContent("");
    setFormTargetRoles(["TEACHER", "STUDENT"]);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || formTargetRoles.length === 0) return;

    setIsSaving(true);
    try {
      if (editingAnnouncement) {
        await updateAnnouncement.mutateAsync({
          id: editingAnnouncement.id,
          data: {
            title: formTitle.trim(),
            content: formContent.trim(),
            targetRoles: formTargetRoles,
          },
        });
      } else {
        await createAnnouncement.mutateAsync({
          title: formTitle.trim(),
          content: formContent.trim(),
          targetRoles: formTargetRoles,
        });
      }
      setDialogOpen(false);
      setEditingAnnouncement(null);
    } catch {
      // Toast handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-purple-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-purple-500/5 via-purple-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-purple-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20">
              <MegaphoneIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Announcements
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Create and manage broadcast announcements targeted at specific
                roles across the school community.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Announcement
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && announcements && announcements.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={MegaphoneIcon}
              label="Total"
              value={stats.total}
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <StatCard
              icon={UsersIcon}
              label="Roles Targeted"
              value={stats.roles}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={UserIcon}
              label="Authors"
              value={stats.authors}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={CalendarIcon}
              label="This Week"
              value={stats.recent}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           DATA TABLE SECTION
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-purple-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={announcements ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search announcements…"
          emptyMessage="No announcements found."
          emptyDescription="Create your first announcement to notify the school community."
          pageSize={8}
        />
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           PREMIUM CREATE/EDIT DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
          onClick={handleCloseDialog}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient header strip */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-purple-500/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-purple-500/10 to-transparent blur-3xl"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseDialog}
              aria-label="Close dialog"
              className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>

            <div className="relative px-6 pb-6 pt-8">
              {/* Header with icon */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-600 shadow-sm ring-1 ring-purple-500/10 dark:text-purple-400">
                  <MegaphoneIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingAnnouncement
                      ? "Edit Announcement"
                      : "New Announcement"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingAnnouncement
                      ? `Update "${editingAnnouncement.title}".`
                      : "Create a broadcast message for the school community."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Title
                  </label>
                  <div className="relative">
                    <MegaphoneIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      type="text"
                      placeholder="e.g. End of Year Exams Schedule"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-purple-500/30 focus-visible:ring-2 focus-visible:ring-purple-500/10"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Content
                  </label>
                  <div className="relative">
                    <FileTextIcon className="pointer-events-none absolute left-3 top-3 z-10 size-4 text-muted-foreground/30" />
                    <Textarea
                      placeholder="Write your announcement message…"
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={5}
                      required
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-purple-500/30 focus-visible:ring-2 focus-visible:ring-purple-500/10"
                    />
                  </div>
                </div>

                {/* Target Roles */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Target Roles
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_OPTIONS.map((role) => (
                      <RoleToggleChip
                        key={role.value}
                        label={role.label}
                        selected={formTargetRoles.includes(role.value)}
                        onClick={() => toggleRole(role.value)}
                      />
                    ))}
                  </div>
                  {formTargetRoles.length === 0 && (
                    <p className="text-xs text-destructive/70">
                      Select at least one target role.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving || formTargetRoles.length === 0}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Publishing…
                      </span>
                    ) : editingAnnouncement ? (
                      "Update Announcement"
                    ) : (
                      "Publish Announcement"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    disabled={isSaving}
                    className="border-border/30"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
           DELETE CONFIRMATION DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete) deleteAnnouncement.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
