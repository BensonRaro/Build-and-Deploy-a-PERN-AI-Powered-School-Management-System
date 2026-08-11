/**
 * Login — Elegant authentication page for the Biasly School Management System
 *
 * Features:
 * - Split-screen layout: brand panel (left) + form panel (right)
 * - Animated gradient orbs and decorative elements on the brand panel
 * - Staggered entrance animations via CSS custom properties
 * - Email/password sign-in using Better Auth (authClient)
 * - Zod schema validation with react-hook-form (Controller pattern)
 * - shadcn Field components for form structure and validation display
 * - "Remember me" checkbox
 * - Shake animation on auth error with subtle glow
 * - Password visibility toggle with animated transition
 * - Loading state with spinner and button text change
 * - Fully responsive (stacks vertically on mobile)
 * - Dark mode aware (uses theme CSS variables)
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  EyeIcon,
  EyeOffIcon,
  GraduationCapIcon,
  LogInIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BarChart3Icon,
  BookOpenIcon,
} from "lucide-react";

import type { Route } from "./+types/login";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Loader } from "@/components/globals/loader";

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Feature highlights shown on the brand panel ─────────────────────────────

const FEATURES = [
  {
    icon: SparklesIcon,
    label: "AI-Powered",
    description: "Smart grading & assignments",
  },
  {
    icon: ShieldCheckIcon,
    label: "Secure",
    description: "Role-based access control",
  },
  {
    icon: BarChart3Icon,
    label: "Insights",
    description: "Real-time analytics dashboard",
  },
  {
    icon: BookOpenIcon,
    label: "Assignments",
    description: "AI-generated homework & grading",
  },
];

// ─── Meta ─────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign In — Biasly" },
    {
      name: "description",
      content:
        "Sign in to your Biasly account to access the School Management System.",
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  // ── All hooks MUST be called unconditionally (same order every render) ─
  const { data: session, isPending: sessionPending } = authClient.useSession();

  // ── Local state (moved above early returns per React hooks rules) ────
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ── React Hook Form (must be called unconditionally) ─────────────────
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // ── Shake animation helper (hook — must be before early returns) ────
  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  }, []);

  // ── Effects (all effect hooks together) ──────────────────────────────
  // Redirect already-authenticated users to dashboard
  useEffect(() => {
    if (!sessionPending && session) {
      navigate(redirectTo, { replace: true });
    }
  }, [session, sessionPending, navigate, redirectTo]);

  // Trigger entrance animations after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Early returns (after ALL hooks) ──────────────────────────────────
  if (sessionPending) {
    return <Loader variant="page" text="Checking your session…" />;
  }

  // Don't render the login form if already authenticated
  if (session) {
    return <Loader variant="page" text="Redirecting…" />;
  }

  // ── Submit handler ───────────────────────────────────────────────────
  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);

    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      callbackURL: redirectTo,
      rememberMe: data.rememberMe,
    });

    if (error) {
      const message =
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Invalid email or password. Please try again."
          : error.code === "USER_NOT_FOUND"
            ? "No account found with this email address."
            : error.message ||
              "An unexpected error occurred. Please try again.";
      setAuthError(message);
      triggerShake();
      return;
    }
    toast.success("Welcome back!", {
      description: "You have successfully signed in.",
    });
    navigate(redirectTo);
  };

  // ── Entrance animation delay helper ──────────────────────────────────
  // Applies a staggered transition delay to each child element so they
  // fade in one after another rather than all at once.
  const entranceDelay = (index: number) =>
    ({
      transitionDelay: `${index * 0.08 + 0.2}s`,
    }) as React.CSSProperties;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* ── BRAND PANEL (Left) ────────────────────────────────────────── */}
      <div
        className="relative flex min-h-[35vh] flex-col justify-center overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-primary/60 px-6 py-10 text-primary-foreground lg:sticky lg:top-0 lg:min-h-screen lg:w-[45%] lg:px-10 lg:py-12"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
          transform: mounted ? "translateX(0)" : "translateX(-40px)",
        }}
      >
        {/* ── Animated gradient orbs ─────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-40 -inset-y-40 overflow-hidden"
        >
          <div className="absolute left-1/4 top-1/4 size-96 animate-[blob_12s_ease-in-out_infinite] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-1/4 top-1/3 size-80 animate-[blob_16s_ease-in-out_infinite_reverse] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-1/4 left-1/3 size-72 animate-[blob_14s_ease-in-out_infinite_2s] rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* ── Subtle grid overlay ────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"
        />

        {/* ── Content wrapper (z-indexed above decorative layers) ────── */}
        <div className="relative z-10">
          {/* Logo + Brand */}
          <div className="mb-6 flex items-center gap-3 lg:mb-8">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 shadow-lg shadow-black/10 backdrop-blur-sm lg:size-12">
              <GraduationCapIcon className="size-5 lg:size-6" />
            </div>
            <span className="text-lg font-semibold tracking-tight lg:text-xl">
              Biasly
            </span>
          </div>

          {/* Tagline */}
          <h1 className="mb-3 text-balance text-2xl font-bold leading-tight tracking-tight lg:mb-4 lg:text-4xl">
            Empower your school
            <br />
            with intelligent tools.
          </h1>
          <p className="mb-8 max-w-md text-balance text-sm leading-relaxed text-primary-foreground/80 lg:mb-10 lg:text-base">
            The all-in-one AI-powered platform for modern school management —
            from smart grading and timetables to fees and assignments.
          </p>

          {/* Feature highlights (visible on larger screens) */}
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.label}
                className="flex items-start gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm transition-all duration-300 hover:bg-white/15"
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <feature.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="text-xs text-primary-foreground/70">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer text */}
        <p className="relative z-10 mt-8 text-xs text-primary-foreground/50 lg:mt-auto">
          &copy; {new Date().getFullYear()} Biasly. All rights reserved.
        </p>
      </div>

      {/* ── FORM PANEL (Right) ─────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 lg:px-8 lg:py-12">
        <div
          className="w-full max-w-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
            transitionDelay: "0.15s",
            transform: mounted ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <Card className="border-border/40 shadow-lg shadow-foreground/5 dark:border-border/20 dark:shadow-black/20">
            <CardHeader className="text-center">
              {/* Logo (visible on mobile where left panel is compact) */}
              <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden">
                <GraduationCapIcon className="size-5" />
              </div>
              <CardTitle
                className="text-lg font-semibold tracking-tight"
                style={entranceDelay(0)}
              >
                Welcome back
              </CardTitle>
              <CardDescription
                className="text-balance"
                style={entranceDelay(1)}
              >
                Sign in to your Biasly account to continue.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* ── Auth-level error banner with shake animation ──────── */}
              {authError && (
                <div
                  role="alert"
                  className={`mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive ${
                    isShaking ? "animate-[shake_0.5s_ease-in-out]" : ""
                  }`}
                  style={entranceDelay(2)}
                >
                  <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-destructive" />
                  <span>{authError}</span>
                </div>
              )}

              {/* ── Form ──────────────────────────────────────────────── */}
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <FieldGroup>
                  {/* Email Field */}
                  <div style={entranceDelay(3)}>
                    <Field data-invalid={!!errors.email}>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <FieldContent>
                        <Controller
                          name="email"
                          control={control}
                          render={({ field }) => (
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@school.edu"
                              autoComplete="email"
                              autoFocus
                              aria-invalid={!!errors.email}
                              disabled={isSubmitting}
                              className="transition-all duration-200 focus-visible:ring-4 focus-visible:ring-primary/15"
                              {...field}
                            />
                          )}
                        />
                        <FieldError
                          errors={[{ message: errors.email?.message }]}
                        />
                      </FieldContent>
                    </Field>
                  </div>

                  {/* Password Field */}
                  <div style={entranceDelay(4)}>
                    <Field data-invalid={!!errors.password}>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <FieldContent>
                        <Controller
                          name="password"
                          control={control}
                          render={({ field }) => (
                            <div className="relative">
                              <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                aria-invalid={!!errors.password}
                                disabled={isSubmitting}
                                className="pr-10 transition-all duration-200 focus-visible:ring-4 focus-visible:ring-primary/15"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                              >
                                <span className="relative block size-4">
                                  <EyeIcon
                                    className={`absolute inset-0 size-4 transition-all duration-300 ${
                                      showPassword
                                        ? "rotate-90 opacity-0 scale-75"
                                        : "rotate-0 opacity-100 scale-100"
                                    }`}
                                  />
                                  <EyeOffIcon
                                    className={`absolute inset-0 size-4 transition-all duration-300 ${
                                      showPassword
                                        ? "rotate-0 opacity-100 scale-100"
                                        : "-rotate-90 opacity-0 scale-75"
                                    }`}
                                  />
                                </span>
                              </button>
                            </div>
                          )}
                        />
                        <FieldError
                          errors={[{ message: errors.password?.message }]}
                        />
                      </FieldContent>
                    </Field>
                  </div>

                  {/* Remember Me + Forgot Password */}
                  <div
                    className="flex items-center justify-between"
                    style={entranceDelay(5)}
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                      <Controller
                        name="rememberMe"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        )}
                      />
                      Remember me
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-primary underline-offset-4 transition-all duration-200 hover:text-primary/80 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {/* ── Submit Button ──────────────────────────────────────── */}
                  <div style={entranceDelay(6)}>
                    <Button
                      type="submit"
                      size="lg"
                      className="mt-1 w-full gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner className="size-4" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          <LogInIcon
                            data-icon="inline-start"
                            className="transition-transform duration-300 group-hover/button:translate-x-0.5"
                          />
                          Sign in
                        </>
                      )}
                    </Button>
                  </div>
                </FieldGroup>
              </form>

              {/* ── Back to home ────────────────────────────────────────── */}
              <p
                className="mt-5 text-center text-sm text-muted-foreground"
                style={entranceDelay(8)}
              >
                <Link
                  to="/"
                  className="inline-flex items-center gap-1 underline underline-offset-4 transition-all duration-200 hover:text-foreground"
                >
                  Back to home
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
