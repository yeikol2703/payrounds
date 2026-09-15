"use client";

import { Calendar } from "lucide-react";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

function ordinal(n: number): string {
  const d = Math.abs(n) % 100;
  if (d >= 11 && d <= 13) {
    return "th";
  }
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatBillingDay(day: number): string {
  return `${day}${ordinal(day)} of each month`;
}

type DayOfMonthPickerProps = {
  id?: string;
  value: number;
  onChange: (day: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
};

/**
 * Calendar-style picker for the billing day of month (default 1–28).
 */
export function DayOfMonthPicker({
  id = "billing-day-of-month",
  value,
  onChange,
  min = 1,
  max = 28,
  disabled = false,
}: DayOfMonthPickerProps) {
  const days = DAYS.filter((d) => d >= min && d <= max);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-elevated-muted px-3 py-2.5 text-sm text-foreground">
        <Calendar className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span className="font-medium">{formatBillingDay(value)}</span>
      </div>
      <div
        id={id}
        role="listbox"
        aria-label="Day of the month"
        className="grid grid-cols-7 gap-1.5"
      >
        {days.map((d) => {
          const selected = d === value;
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(d)}
              className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                selected
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "border border-border bg-elevated text-foreground hover:bg-elevated-muted"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
