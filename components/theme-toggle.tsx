"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type ThemeChoice = "light" | "dark";

const STORAGE_KEY = "payround-theme";

function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  root.setAttribute("data-theme", choice);
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}

function readStored(): ThemeChoice {
  if (typeof window === "undefined") {
    return "dark";
  }
  try {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") {
      return attr;
    }
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  );
}

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

/** Sun / moon icon toggle between light and dark. */
export function ThemeToggle({ className = "", compact }: ThemeToggleProps) {
  const { t } = useI18n();
  const [choice, setChoice] = useState<ThemeChoice>("dark");

  useEffect(() => {
    const stored = readStored();
    setChoice(stored);
    applyChoice(stored);
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeChoice = choice === "dark" ? "light" : "dark";
    setChoice(next);
    applyChoice(next);
  }, [choice]);

  const isDark = choice === "dark";
  const size = compact ? "h-9 w-9" : "h-10 w-10";

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={isDark ? t("theme.light") : t("theme.dark")}
      aria-pressed={isDark}
      title={isDark ? t("theme.light") : t("theme.dark")}
      onClick={toggle}
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full border border-border bg-elevated-muted text-foreground transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
