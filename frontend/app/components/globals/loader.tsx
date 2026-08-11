/**
 * Loader — Reusable loading state component for the Biasly SMS.
 *
 * Design language ("Aura"):
 * - Glass morphism aesthetic matching the sidebar design
 * - Smooth, deliberate animations (no jarring movements)
 * - Multiple variants for different loading contexts
 *
 * Variants:
 * - `"spinner"` (default) — Compact inline spinner with optional text
 * - `"page"` — Full-viewport centered loader with brand + glass card
 * - `"card"` — Section-level card with skeleton-like lines + spinner
 * - `"skeleton"` — Minimal skeleton placeholder (delegates to Skeleton)
 *
 * Usage:
 * ```tsx
 * <Loader />                           // inline spinner
 * <Loader variant="page" text="Loading your dashboard…" />
 * <Loader variant="card" />
 * <Loader variant="skeleton" className="h-48 w-full" />
 * ```
 */

import { cn } from "@/lib/utils";
import { Loader2Icon, GraduationCapIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ──────────────────────────────────────────────────────────────────

type LoaderVariant = "spinner" | "page" | "card" | "skeleton";
type LoaderSize = "sm" | "md" | "lg" | "xl";

interface LoaderProps {
  /**
   * Visual variant. Defaults to `"spinner"`.
   * - `spinner`: Compact inline spinner (replaces the base Spinner component).
   * - `page`: Full-viewport centered card with brand icon, animated ring, and message.
   * - `card`: Card-shaped skeleton with a small spinner and optional text.
   * - `skeleton`: Minimal pulsing placeholder using Skeleton.
   */
  variant?: LoaderVariant;

  /** Size of the spinner/indicator. Defaults to `"md"`. */
  size?: LoaderSize;

  /** Optional loading message (shown below the spinner). */
  text?: string;

  /** Additional class names forwarded to the root element. */
  className?: string;
}

// ─── Size map ───────────────────────────────────────────────────────────────

const SPINNER_SIZES: Record<LoaderSize, string> = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
  xl: "size-10",
};

const RING_SIZES: Record<LoaderSize, string> = {
  sm: "size-6",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
};

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * Animated gradient spinner ring — used in the "page" variant.
 * Creates a rotating conic-gradient border that looks like a modern loading indicator.
 */
function GradientSpinnerRing({ size = "md" }: { size?: LoaderSize }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center",
        RING_SIZES[size],
      )}
    >
      {/* Rotating conic-gradient track */}
      <div
        className={cn(
          "absolute inset-0 animate-spin rounded-full",
          "bg-[conic-gradient(from_0deg,transparent_40%,var(--color-primary)_100%)]",
          "loader-ring-mask",
        )}
        style={{ animationDuration: "1.2s" }}
      />
      {/* Inner fill (matches the card background so the ring looks hollow) */}
      <div className="absolute inset-[2.5px] rounded-full bg-background" />
    </div>
  );
}

// ─── Variant Components ──────────────────────────────────────────────────────

function SpinnerVariant({ size, text, className }: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center gap-2", className)}
    >
      <Loader2Icon
        className={cn(
          "animate-spin text-muted-foreground",
          SPINNER_SIZES[size ?? "md"],
        )}
        style={{ animationDuration: "0.8s" }}
      />
      {text && (
        <span className="text-sm text-muted-foreground/80">{text}</span>
      )}
    </div>
  );
}

function PageVariant({ size = "md", text, className }: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex min-h-svh w-full items-center justify-center bg-background p-4",
        className,
      )}
    >
      <div className="group relative w-full max-w-xs">
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-primary/5 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        />

        {/* Glass card */}
        <div className="relative flex flex-col items-center gap-5 rounded-2xl border border-border/40 bg-background/60 px-8 py-10 shadow-xl shadow-black/5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
          {/* Icon + animated ring */}
          <div className="relative flex items-center justify-center">
            <GradientSpinnerRing size={size} />
            <span className="absolute flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20">
              <GraduationCapIcon className="size-4" />
            </span>
          </div>

          {/* Text */}
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">
              {text ?? "Loading…"}
            </p>
            <p className="text-[11px] text-muted-foreground/50">
              Please wait a moment
            </p>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-1" aria-hidden="true">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 animate-pulse rounded-full bg-primary/40"
                style={{
                  animationDuration: "1.4s",
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardVariant({ size = "md", text, className }: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-border/40 bg-background/50 px-6 py-10 backdrop-blur-sm",
        className,
      )}
    >
      <Loader2Icon
        className={cn(
          "animate-spin text-primary/60",
          SPINNER_SIZES[size],
        )}
        style={{ animationDuration: "0.9s" }}
      />
      {text ? (
        <p className="text-sm text-muted-foreground/70">{text}</p>
      ) : (
        <div className="flex w-full max-w-[200px] flex-col gap-2">
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-2 w-3/4 animate-pulse rounded-full bg-muted" />
        </div>
      )}
    </div>
  );
}

function SkeletonVariant({ className }: LoaderProps) {
  return <Skeleton className={cn(className)} />;
}

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * Loader — A reusable loading state component.
 *
 * Drop it anywhere you need to indicate loading.
 * Use `variant="page"` for full-page loading (e.g. auth check),
 * `variant="card"` for section-level placeholders,
 * `variant="skeleton"` for minimal skeleton blocks.
 *
 * @example
 * // Inline spinner with message
 * <Loader text="Fetching data…" />
 *
 * @example
 * // Full-page brand loader for auth checks
 * if (isPending) return <Loader variant="page" text="Signing you in…" />;
 *
 * @example
 * // Card skeleton for content sections
 * <Loader variant="card" />
 */
export function Loader({
  variant = "spinner",
  size = "md",
  text,
  className,
}: LoaderProps) {
  switch (variant) {
    case "page":
      return <PageVariant size={size} text={text} className={className} />;
    case "card":
      return <CardVariant size={size} text={text} className={className} />;
    case "skeleton":
      return <SkeletonVariant className={className} />;
    default:
      return <SpinnerVariant size={size} text={text} className={className} />;
  }
}
