/**
 * Contact — Contact and information section for the Biasly landing page
 *
 * Displays contact details (email, phone, address) alongside quick-links
 * to various school management modules.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  ArrowRightIcon,
  MessageSquareIcon,
} from "lucide-react";

interface ContactItem {
  icon: typeof MailIcon;
  label: string;
  value: string;
  href?: string;
}

const CONTACT_INFO: ContactItem[] = [
  {
    icon: MailIcon,
    label: "Email",
    value: "hello@biasly.edu",
    href: "mailto:hello@biasly.edu",
  },
  {
    icon: PhoneIcon,
    label: "Phone",
    value: "+1 (555) 123-4567",
    href: "tel:+15551234567",
  },
  {
    icon: MapPinIcon,
    label: "Address",
    value: "123 Education Ave, Suite 200",
  },
];

const QUICK_LINKS = [
  "AI Assignments",
  "Timetable",
  "Gradebook",
  "Fee Management",
  "Announcements",
  "Analytics",
  "Reports",
  "User Management",
];

export function Contact() {
  return (
    <section id="contact" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Section Header ────────────────────────────────────────── */}
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium tracking-wide">
            Get in Touch
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s Transform Your School
          </h2>
          <p className="mt-4 text-muted-foreground">
            Ready to bring intelligent management to your institution? Reach out to our
            team and we&apos;ll help you get started.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          {/* ── Contact Details ───────────────────────────────────────── */}
          <div className="space-y-8">
            <h3 className="text-lg font-semibold">Contact Information</h3>
            <div className="space-y-5">
              {CONTACT_INFO.map((item) => {
                const Icon = item.icon;
                const shared = (
                  <>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-sm font-medium">{item.value}</p>
                    </div>
                  </>
                );

                if (item.href) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="group flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
                    >
                      {shared}
                    </a>
                  );
                }

                return (
                  <div
                    key={item.label}
                    className="group flex items-center gap-4 rounded-lg p-3"
                  >
                    {shared}
                  </div>
                );
              })}
            </div>

            {/* ── CTA Message ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border/50 bg-muted/30 p-6">
              <div className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquareIcon className="size-5" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold">Have a question?</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Our team is ready to help. Schedule a personalized demo to see Biasly
                    in action.
                  </p>
                  <Button size="sm" className="mt-4 gap-2">
                    Book a Demo
                    <ArrowRightIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Quick Links ────────────────────────────────────────────── */}
          <div className="space-y-8">
            <h3 className="text-lg font-semibold">Explore Features</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {QUICK_LINKS.map((link) => (
                <a
                  key={link}
                  href="#features"
                  className="rounded-lg border border-border/50 px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground hover:shadow-xs"
                >
                  {link}
                </a>
              ))}
            </div>

            {/* ── Decorative Quote ──────────────────────────────────── */}
            <blockquote className="rounded-xl border border-border/50 bg-muted/20 p-6 italic text-muted-foreground">
              &ldquo;Biasly has streamlined our entire school operations. The AI-powered tools
              have saved our teachers hours every week, and the unified platform means
              everything just works together.&rdquo;
              <footer className="mt-4 not-italic text-sm font-medium text-foreground">
                — Dr. Sarah Mitchell, Principal
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
