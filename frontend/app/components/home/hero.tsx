/**
 * Hero — Primary hero section for the Biasly landing page
 *
 * Features:
 * - Gradient background with subtle mesh/grid pattern
 * - Bold headline with animated accent
 * - Supporting subtext describing the platform
 * - Primary & secondary CTA buttons
 * - Floating stat badges for social proof
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon, SparklesIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[90vh] items-center overflow-hidden pt-24">
      {/* ── Background Gradient ──────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Mesh gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--color-primary)_0%,_transparent_60%)] opacity-10 dark:opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--color-primary)_0%,_transparent_60%)] opacity-5 dark:opacity-10" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8">
        {/* ── Top Badge ─────────────────────────────────────────────── */}
        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-700 ease-out">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium tracking-wide">
            <SparklesIcon className="size-3 text-primary" />
            AI-Powered School Management
          </Badge>
        </div>

        {/* ── Headline ──────────────────────────────────────────────── */}
        <h1 className="max-w-4xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Empower Your School with{" "}
          <span className="bg-linear-to-r from-primary to-blue-400 bg-clip-text text-transparent dark:from-primary dark:to-blue-300">
            Intelligent Management
          </span>
        </h1>

        {/* ── Subtitle ──────────────────────────────────────────────── */}
        <p className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          Biasly brings together AI-driven tools, seamless scheduling, academic tracking,
          assignments, and fee processing — all in one elegant platform designed
          for modern educational institutions.
        </p>

        {/* ── CTA Buttons ───────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Button size="lg" className="gap-2 px-8 text-base font-medium shadow-sm">
            Get Started Free
            <ArrowRightIcon className="size-4" />
          </Button>
          <Button variant="outline" size="lg" className="gap-2 px-8 text-base font-medium">
            <ShieldCheckIcon className="size-4" />
            Schedule a Demo
          </Button>
        </div>

        {/* ── Social Proof Stats ────────────────────────────────────── */}
        <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
          {[
            { value: "98%", label: "Uptime", icon: ZapIcon },
            { value: "50+", label: "Schools", icon: ShieldCheckIcon },
            { value: "10K+", label: "Students", icon: SparklesIcon },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                <stat.icon className="size-5 text-primary" />
                {stat.value}
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
