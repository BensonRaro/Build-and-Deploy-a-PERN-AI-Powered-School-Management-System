/**
 * role-dashboard — Role-based dashboard switcher.
 *
 * Renders the appropriate home dashboard for the signed-in user:
 *   - SUPER_ADMIN / PRINCIPAL / VICE_PRINCIPAL / ACCOUNTANT → whole-school
 *     analytics (SchoolAnalyticsDashboard)
 *   - TEACHER → personalized timetable + classes + assignments
 *   - STUDENT → grade timetable + assignments + fee status
 *   - PARENT  → children + fee summaries
 *   - other roles (STAFF, LIBRARIAN, COUNSELOR, …) → a lightweight overview
 *     with quick links to their modules
 *
 * Imported by /dashboard (routes/dashboard/Dashboard.tsx).
 */

import {
  LayoutDashboardIcon,
  CalendarClockIcon,
  MegaphoneIcon,
  UsersIcon,
  GraduationCapIcon,
  BookOpenCheckIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Link } from "react-router";
import { authClient } from "@/lib/auth-client";
import { SchoolAnalyticsDashboard } from "@/components/dashboard/school-analytics";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";

// ─── Roles with the whole-school analytics dashboard ────────────────────────

const ANALYTICS_ROLES = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "ACCOUNTANT",
];

// ─── Generic overview (STAFF / LIBRARIAN / COUNSELOR / …) ───────────────────

const QUICK_LINKS = [
  {
    title: "Timetable",
    description: "View weekly class schedules",
    url: "/dashboard/timetable",
    icon: CalendarClockIcon,
    gradient: "bg-gradient-to-br from-sky-500 to-cyan-600",
  },
  {
    title: "Announcements",
    description: "Read the latest school news",
    url: "/dashboard/announcements",
    icon: MegaphoneIcon,
    gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
  {
    title: "Students",
    description: "Browse student profiles",
    url: "/dashboard/students",
    icon: UsersIcon,
    gradient: "bg-gradient-to-br from-indigo-500 to-violet-600",
  },
  {
    title: "Grades",
    description: "Explore classes & sections",
    url: "/dashboard/grades",
    icon: GraduationCapIcon,
    gradient: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  },
];

function OverviewDashboard() {
  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const role = session?.user?.role as string | undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-blue-500/[0.05] via-background to-background p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-violet-500/5 via-violet-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />

        <div className="relative flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <LayoutDashboardIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground/70">
              Quick access to the tools you use every day.
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.title}
            to={link.url}
            className="group flex items-center gap-4 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-5 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04]"
          >
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${link.gradient}`}
            >
              <link.icon className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{link.title}</p>
              <p className="text-xs text-muted-foreground/50">
                {link.description}
              </p>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        ))}
      </div>

      {role === "LIBRARIAN" && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-4">
          <BookOpenCheckIcon className="size-5 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground/70">
            Library management is a premium module — available to Patreon
            members and code purchasers.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Switcher ───────────────────────────────────────────────────────────────

export function RoleDashboard() {
  const { data: session, isPending } = authClient.useSession();
  const role = session?.user?.role as string | undefined;

  if (isPending || !role) return null; // Layout shows a session loader

  if (ANALYTICS_ROLES.includes(role)) return <SchoolAnalyticsDashboard />;
  if (role === "TEACHER") return <TeacherDashboard />;
  if (role === "STUDENT") return <StudentDashboard />;
  if (role === "PARENT") return <ParentDashboard />;
  return <OverviewDashboard />;
}
