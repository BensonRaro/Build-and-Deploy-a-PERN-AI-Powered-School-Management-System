/**
 * Navbar — Top navigation bar for the Biasly landing page
 *
 * Features:
 * - Sticky header with backdrop blur on scroll
 * - Logo/brand name
 * - Desktop navigation links with smooth-scroll anchors
 * - Login / Get Started CTA buttons
 * - Mobile hamburger menu (responsive)
 */

import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { MenuIcon, XIcon, GraduationCapIcon } from "lucide-react";
import { ThemeToggle } from "@/components/home/theme-toggle";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* ── Logo / Brand ─────────────────────────────────────────── */}
        <a
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <GraduationCapIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Biasly</span>
        </a>

        {/* ── Desktop Navigation ───────────────────────────────────── */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* ── Desktop CTAs ─────────────────────────────────────────── */}
        <div className="hidden items-center gap-1 md:flex">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button size="sm">Get Started</Button>
        </div>

        {/* ── Mobile right section: toggle + hamburger ──────────────── */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <XIcon className="size-5" />
          ) : (
            <MenuIcon className="size-5" />
          )}
        </button>
        </div>
      </div>

      {/* ── Mobile Menu ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="border-t border-border/50 bg-background px-4 pb-4 pt-2 md:hidden animate-in slide-in-from-top-2 duration-200 ease-out"
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <hr className="my-2 border-border/50" />
            <Button variant="ghost" size="sm" className="justify-start" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" className="justify-start">
              Get Started
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
