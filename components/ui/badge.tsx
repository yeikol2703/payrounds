type BadgeProps = {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning";
};

const TONES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral:
    "bg-foreground/6 text-foreground ring-1 ring-border dark:bg-foreground/10",
  success:
    "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-500/20 dark:text-emerald-200",
  warning:
    "bg-amber-500/12 text-amber-950 ring-1 ring-amber-500/25 dark:text-amber-100",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
