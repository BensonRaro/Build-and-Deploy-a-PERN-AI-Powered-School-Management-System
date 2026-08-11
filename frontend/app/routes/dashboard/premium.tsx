/**
 * Premium Feature Placeholder — /dashboard/attendance, /dashboard/books,
 * /dashboard/book-issues, /dashboard/library-analytics
 *
 * Attendance and Library are exclusive to Patreon members and purchasers of
 * the full source code, so the free version ships this simple placeholder
 * page at those routes. It reads the current path to show which feature is
 * locked and keeps the sidebar navigation intact.
 */

import { useLocation } from "react-router";
import { LockIcon, SparklesIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Route → feature title + description map
const FEATURES: Record<string, { title: string; blurb: string }> = {
  "/dashboard/attendance": {
    title: "Attendance",
    blurb:
      "Daily grade registers, per-lesson roll-call, and attendance history.",
  },
  "/dashboard/library-analytics": {
    title: "Library Analytics",
    blurb: "Catalog health, circulation, overdue tracking, and fines.",
  },
  "/dashboard/books": {
    title: "Books",
    blurb: "The full book catalog with copies, covers, and checkouts.",
  },
  "/dashboard/book-issues": {
    title: "Book Issues",
    blurb: "Borrowing, returns, and the library desk flow.",
  },
};

export default function PremiumFeature() {
  const { pathname } = useLocation();
  const feature = FEATURES[pathname] ?? {
    title: "Premium Feature",
    blurb: "This feature is part of the premium package.",
  };

  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center py-16 sm:py-24">
      <Card className="w-full overflow-hidden border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm backdrop-blur-sm">
        {/* Gradient accent strip */}
        <div
          aria-hidden="true"
          className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/20"
        />

        <CardHeader className="items-center pb-2 pt-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
            <LockIcon className="size-6" />
          </span>
          <Badge
            variant="outline"
            className="mt-4 gap-1.5 border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary"
          >
            <SparklesIcon className="size-3" />
            Premium feature
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {feature.title}
          </h1>
        </CardHeader>

        <CardContent className="px-6 pb-10 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground/70">
            {feature.blurb}
          </p>
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-border/10 bg-background/50 px-5 py-4">
            <p className="text-sm font-medium text-foreground">
              Available to Patreon members &amp; code purchasers
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/50">
              Join the Patreon or purchase the full source code to unlock this
              module in the complete system.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
