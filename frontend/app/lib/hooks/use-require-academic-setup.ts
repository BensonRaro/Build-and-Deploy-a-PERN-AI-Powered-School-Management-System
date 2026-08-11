/**
 * useRequireAcademicSetup — Guard hook for the dashboard layout.
 *
 * For non-admin users (any role other than SUPER_ADMIN, PRINCIPAL, or
 * VICE_PRINCIPAL), this hook checks that at least one current academic year
 * **and** one current term exist before allowing dashboard access.
 *
 * If either is missing, the user is redirected to the home page with a
 * descriptive toast explaining what needs to be configured.
 *
 * Admin users (SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL) bypass the check.
 *
 * @example
 * const { isChecking } = useRequireAcademicSetup(userRole);
 * if (isChecking) return <Loader variant="page" />;
 * // Render dashboard
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAcademicYears, useTerms } from "@/lib/hooks/use-academic-years";

/** Roles that can access the dashboard regardless of academic setup */
const ADMIN_ROLES = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"];

export function useRequireAcademicSetup(role?: string) {
  const navigate = useNavigate();
  const {
    data: academicYears,
    isLoading: yearsLoading,
    isFetched: yearsFetched,
    isError: yearsError,
  } = useAcademicYears();
  const hasRedirected = useRef(false);

  // Find the current academic year (if any) to check for terms
  const currentYear = academicYears?.find((y) => y.isCurrent);
  const {
    data: terms,
    isLoading: termsLoading,
    isFetched: termsFetched,
    isError: termsError,
  } = useTerms(currentYear?.id);

  useEffect(() => {
    // Skip check for admin users
    if (role && ADMIN_ROLES.includes(role)) return;

    // Prevent multiple redirects
    if (hasRedirected.current) return;

    // ── Handle API errors gracefully ──────────────────────────────────
    // If the academic years query itself failed, we can't perform the check.
    // We don't block access — the user might still be able to use the app,
    // and individual pages will show their own error states.
    if (yearsError) return;

    // Wait for academic years to load
    if (!yearsFetched || yearsLoading) return;

    // ── Check: Current academic year exists ───────────────────────────
    if (!currentYear) {
      hasRedirected.current = true;
      toast.error("Academic year not configured", {
        description:
          "No current academic year is set up. Please contact an administrator to configure one before accessing the dashboard.",
        duration: 8000,
      });
      navigate("/", { replace: true });
      return;
    }

    // ── Wait for terms to load for the current academic year ──────────
    if (!termsFetched || termsLoading) return;

    // If terms failed to load, we can't verify, so don't block
    if (termsError) return;

    // ── Check: Current term exists ────────────────────────────────────
    const currentTerm = terms?.find((t) => t.isCurrent);
    if (!currentTerm) {
      hasRedirected.current = true;
      toast.error("Current term not configured", {
        description:
          "No current term is set up for this academic year. Please contact an administrator to set one before accessing the dashboard.",
        duration: 8000,
      });
      navigate("/", { replace: true });
      return;
    }
  }, [
    role,
    currentYear,
    terms,
    yearsLoading,
    yearsFetched,
    yearsError,
    termsLoading,
    termsFetched,
    termsError,
    navigate,
  ]);

  // Determine if the check is still in progress
  const isChecking = ((): boolean => {
    // Admin users bypass the check entirely
    if (role && ADMIN_ROLES.includes(role)) return false;

    // If years query errored, don't block
    if (yearsError) return false;

    // Still loading academic years
    if (!yearsFetched || yearsLoading) return true;

    // No current year found or year found but terms are still loading
    if (!currentYear) return false; // about to redirect
    if (termsError) return false;

    return !termsFetched || termsLoading;
  })();

  return { isChecking };
}
