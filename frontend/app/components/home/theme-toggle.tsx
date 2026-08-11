/**
 * ThemeToggle — Dark/Light mode toggle button
 *
 * Features:
 * - Renders a sun icon in dark mode (click to switch to light)
 * - Renders a moon icon in light mode (click to switch to dark)
 * - Persists the user's preference in localStorage under "biasly-theme"
 * - Respects the system preference (prefers-color-scheme) on first visit
 * - Smooth icon transition on toggle
 * - SSR-safe: defaults to light on the server; syncs from the DOM on first client render
 */

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "lucide-react";

/** Storage key used to persist the theme preference. */
const STORAGE_KEY = "biasly-theme";

/**
 * Updates the DOM and localStorage to match the given theme.
 */
function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable (private browsing, etc.) — silently ignore
  }
}

export function ThemeToggle() {
  // Default to light on the server to avoid ReferenceError (document doesn't exist during SSR).
  // The useEffect below will sync the correct value from the DOM after hydration.
  // The inline script in root.tsx already sets the .dark class before hydration,
  // so there's no flash of wrong theme.
  const [dark, setDark] = useState(false);

  // After hydration, read the actual theme from the DOM (set by the inline script)
  // and sync React state to match.
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {/* Sun icon — shown in dark mode (clicking switches to light) */}
      <SunIcon
        className={`size-4 transform-gpu transition-all duration-200 ${
          dark
            ? "scale-100 opacity-100 rotate-0"
            : "scale-0 opacity-0 rotate-90"
        } absolute`}
      />
      {/* Moon icon — shown in light mode (clicking switches to dark) */}
      <MoonIcon
        className={`size-4 transform-gpu transition-all duration-200 ${
          dark
            ? "scale-0 opacity-0 -rotate-90"
            : "scale-100 opacity-100 rotate-0"
        } absolute`}
      />
    </button>
  );
}
