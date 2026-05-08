type AvatarProps = {
  label: string;
  size?: "sm" | "md";
};

export function Avatar({ label, size = "md" }: AvatarProps) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-accent-muted font-bold text-accent`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
