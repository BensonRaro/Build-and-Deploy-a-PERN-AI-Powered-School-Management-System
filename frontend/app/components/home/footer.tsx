/**
 * Footer — Site footer for the Biasly landing page
 *
 * Includes brand info, navigation links, social icons, and copyright.
 */

import { Button } from "@/components/ui/button";
import {
  GraduationCapIcon,
  GlobeIcon,
  MessageCircleIcon,
  LinkIcon,
} from "lucide-react";

const FOOTER_LINKS = [
  {
    label: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#" },
      { label: "Integrations", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "API Reference", href: "#" },
      { label: "Help Center", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    label: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Cookie Policy", href: "#" },
      { label: "GDPR", href: "#" },
    ],
  },
];

const SOCIAL_ICONS = [
  { icon: GlobeIcon, label: "GitHub", href: "#" },
  { icon: MessageCircleIcon, label: "Twitter", href: "#" },
  { icon: LinkIcon, label: "LinkedIn", href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* ── Grid ──────────────────────────────────────────────────── */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <a
              href="/"
              className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <GraduationCapIcon className="size-4" />
              </span>
              Biasly
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI-powered school management platform that brings together academics,
              scheduling, assignments, and finance into one seamless experience.
            </p>
            {/* Social icons */}
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_ICONS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.label}>
              <h4 className="mb-4 text-sm font-semibold tracking-wide text-foreground">
                {group.label}
              </h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom Bar ────────────────────────────────────────────── */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Biasly. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="xs">
              Privacy
            </Button>
            <Button variant="ghost" size="xs">
              Terms
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
