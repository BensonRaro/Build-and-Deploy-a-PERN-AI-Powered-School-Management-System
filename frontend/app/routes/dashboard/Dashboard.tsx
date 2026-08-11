/**
 * Dashboard Page — /dashboard
 *
 * The home page is role-based (see components/dashboard/role-dashboard.tsx):
 *   - Management (SUPER_ADMIN / PRINCIPAL / VICE_PRINCIPAL / ACCOUNTANT) →
 *     whole-school analytics
 *   - TEACHER → personalized timetable + classes + assignments
 *   - STUDENT → grade timetable + assignments + fee status
 *   - PARENT  → children + fee summaries
 *   - other roles → lightweight overview with quick links
 */

import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import type { Route } from "./+types/Dashboard";

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard — Biasly" },
    {
      name: "description",
      content:
        "Your role-based Biasly dashboard — analytics, timetable, assignments, and fee status at a glance.",
    },
  ];
}

const Dashboard = () => {
  return <RoleDashboard />;
};

export default Dashboard;
