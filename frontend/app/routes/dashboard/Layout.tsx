/**
 * DashboardLayout — Root layout for all dashboard routes.
 *
 * Wraps the dashboard with:
 * - SidebarProvider (manages sidebar state, mobile/desktop, keyboard shortcuts)
 * - AppSidebar (glass-morphism custom sidebar with navigation)
 * - SidebarInset (main content area with top bar + outlet)
 *
 * Guards:
 * - Non-admin users (not SUPER_ADMIN/PRINCIPAL/VICE_PRINCIPAL) are checked
 *   for an existing current academic year and term. If none exist, they are
 *   redirected to the home page with a descriptive toast.
 *
 * On mobile, the sidebar renders as a Sheet overlay.
 * On desktop, the sidebar is collapsible (icon/expanded).
 */

import { Outlet } from "react-router";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SidebarSeparator } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { PanelLeftIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Loader } from "@/components/globals/loader";
import { useRequireAcademicSetup } from "@/lib/hooks/use-require-academic-setup";
import type { Role } from "@/types";
import type { Route } from "./+types/Layout";

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard — Biasly" },
    {
      name: "description",
      content:
        "Biasly brings together AI-driven tools, scheduling, academic tracking, library management, and fee processing in one elegant platform for modern schools.",
    },
  ];
}

export default function DashboardLayout() {
  const { data, isPending } = authClient.useSession();
  const userRole = data?.user.role!;
  const { isChecking: isCheckingSetup } = useRequireAcademicSetup(userRole);

  if (isPending) {
    return <Loader variant="page" text="Verifying your session…" />;
  }

  // ── Guard: Require academic year/term for non-admin users ─────────────
  if (isCheckingSetup) {
    return <Loader variant="page" text="Checking academic setup…" />;
  }

  return (
    <SidebarProvider>
      {/* 
        ── Custom Glass Sidebar ──────────────────────────────────────
        variant="sidebar" with collapsible="icon" allows the sidebar
        to collapse to icon-only mode with a smooth transition.
      */}
      <AppSidebar userRole={userRole as Role} />

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <SidebarInset className="">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
          <SidebarTrigger className="size-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <PanelLeftIcon className="size-4" />
          </SidebarTrigger>

          {/* Breadcrumb placeholder — will be populated per route */}
          <SidebarSeparator orientation="vertical" className="h-5" />
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Dashboard</span>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
