/**
 * Features — Grid of feature cards showcasing Biasly's capabilities
 *
 * Displays the school management system's core modules in a responsive
 * card grid with icons, titles, and descriptions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BrainCircuitIcon,
  CalendarClockIcon,
  LibraryIcon,
  WalletIcon,
  ClipboardCheckIcon,
  UsersIcon,
  BookOpenIcon,
  BarChart3Icon,
} from "lucide-react";

/** Individual feature definition */
interface Feature {
  title: string;
  description: string;
  icon: typeof BrainCircuitIcon;
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    title: "AI Assignment Generator",
    description:
      "Generate tailored assignments and quizzes with the help of AI. Students receive instant, AI-scored results on submission.",
    icon: BrainCircuitIcon,
    badge: "AI-Powered",
  },
  {
    title: "Smart Timetable",
    description:
      "AI produces a first-draft timetable, then fine-tune it with an intuitive Kanban-style drag-and-drop board.",
    icon: CalendarClockIcon,
    badge: "Drag & Drop",
  },
  {
    title: "Library Management",
    description:
      "Manage your book catalog, track copies, checkouts, returns, holds, and overdue items — all in one place.",
    icon: LibraryIcon,
    badge: "Premium",
  },
  {
    title: "Fee & Payment Processing",
    description:
      "Configure fee structures, generate invoices, and process payments via Stripe with real-time status tracking.",
    icon: WalletIcon,
    badge: "Stripe",
  },
  {
    title: "Attendance Tracking",
    description:
      "Record daily attendance with statuses (present, absent, late, excused) and generate reports per class or student.",
    icon: ClipboardCheckIcon,
    badge: "Premium",
  },
  {
    title: "Role-Based Access",
    description:
      "Granular permissions for every role — Super Admin, Principal, Teacher, Student, Parent, Librarian, and more.",
    icon: UsersIcon,
    badge: "RBAC",
  },
  {
    title: "Gradebook & Academics",
    description:
      "Manage subjects, grades, terms, and academic years with a structured hierarchy that keeps everything organized.",
    icon: BookOpenIcon,
  },
  {
    title: "Insights & Analytics",
    description:
      "AI-driven predictive analytics offer early warnings on academic performance and personalized recommendations.",
    icon: BarChart3Icon,
    badge: "Analytics",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Section Header ────────────────────────────────────────── */}
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium tracking-wide">
            Everything You Need
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            A Complete School OS
          </h2>
          <p className="mt-4 text-muted-foreground">
            From AI-assisted teaching tools to financial management — Biasly unifies every
            aspect of school operations into a single, intuitive platform.
          </p>
        </div>

        {/* ── Feature Cards Grid ────────────────────────────────────── */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group/card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover/card:bg-primary group-hover/card:text-primary-foreground group-hover/card:ring-primary">
                      <Icon className="size-5" />
                    </span>
                    {feature.badge && (
                      <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">
                        {feature.badge}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="mb-2 text-base font-semibold">
                    {feature.title}
                  </CardTitle>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
