"use client";

import { Calendar } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";

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

export function formatBillingDay(
  day: number,
  locale: Locale = "es",
): string {
  if (locale === "es") {
    return `día ${day} de cada mes`;
  }
  return `${day}${ordinal(day)} of each month`;
}

function clampDay(day: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(day)));
}

/** Reference month used only so the native date picker can pick a day-of-month. */
function dateValueForDay(day: number): string {
  const d = clampDay(day, 1, 28);
  return `2024-01-${String(d).padStart(2, "0")}`;
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
 * Native calendar date picker; only the day-of-month is stored (1–28).
 */
export function DayOfMonthPicker({
  id = "billing-day-of-month",
  value,
  onChange,
  min = 1,
  max = 28,
  disabled = false,
}: DayOfMonthPickerProps) {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-2" data-testid="day-of-month-picker">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-elevated-muted px-3 py-2.5 text-sm text-foreground">
        <Calendar className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span className="font-medium">
          {t("dayPicker.preview", {
            day: locale === "en" ? `${value}${ordinal(value)}` : value,
          })}
        </span>
      </div>
      <label className="block text-xs font-medium text-muted" htmlFor={id}>
        {t("dayPicker.pick")}
      </label>
      <input
        id={id}
        data-testid="billing-day-date-input"
        type="date"
        disabled={disabled}
        min={`2024-01-${String(min).padStart(2, "0")}`}
        max={`2024-01-${String(max).padStart(2, "0")}`}
        value={dateValueForDay(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            return;
          }
          const day = Number(raw.split("-")[2]);
          if (!Number.isFinite(day)) {
            return;
          }
          onChange(clampDay(day, min, max));
        }}
        className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
      />
      <p className="text-xs text-muted">{t("dayPicker.hint", { max })}</p>
    </div>
  );
}
