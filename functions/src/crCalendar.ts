/** Shared calendar helpers for scheduled jobs in America/Costa_Rica. */

export const TIME_ZONE = "America/Costa_Rica";

/** `YYYY-MM` for the calendar month of `instant` in Costa Rica. */
export function toCycleIdInCostaRica(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(instant);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${mo}`;
}

export function getCostaRicaYMD(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");
  return { year, month, day };
}

export function lastDayOfCalendarMonth(
  year: number,
  month1To12: number,
): number {
  return new Date(year, month1To12, 0).getDate();
}

export function calendarDiffDays(
  y1: number,
  m1: number,
  d1: number,
  y2: number,
  m2: number,
  d2: number,
): number {
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((t2 - t1) / 86_400_000);
}

export function isSevenDaysBeforeDueThisMonth(
  dueDayOfMonth: number,
  now: Date,
): boolean {
  const { year, month, day } = getCostaRicaYMD(now);
  const dim = lastDayOfCalendarMonth(year, month);
  const dueDay = Math.min(dueDayOfMonth, dim);
  const daysUntilDue = calendarDiffDays(year, month, day, year, month, dueDay);
  return daysUntilDue === 7;
}
