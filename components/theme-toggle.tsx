"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "payround-theme";

function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  } else {
    root.setAttribute("data-theme", choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
  }
}

function readStored(): ThemeChoice {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "system";
}

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className = "", compact }: ThemeToggleProps) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    setChoice(readStored());
  }, []);

  const select = useCallback((c: ThemeChoice) => {
    setChoice(c);
    applyChoice(c);
  }, []);

  const btn =
    "rounded-lg px-2 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 " +
    (compact ? "px-1.5 py-0.5 text-[10px]" : "");

  return (
    <div
      className={`flex rounded-xl border border-border bg-elevated-muted p-0.5 shadow-sm ${className}`}
      role="radiogroup"
      aria-label="Color theme"
    >
      {(
        [
          { id: "light" as const, label: "Light" },
          { id: "dark" as const, label: "Dark" },
          { id: "system" as const, label: "Auto" },
        ] as const
      ).map(({ id, label }) => {
        const active = choice === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(id)}
            className={`${btn} ${
              active
                ? "bg-elevated text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
