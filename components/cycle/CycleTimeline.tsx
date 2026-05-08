import type { Cycle } from "@/lib/types";

type CycleTimelineProps = {
  cycles: Pick<Cycle, "id" | "dueDate" | "status">[];
};

export function CycleTimeline({ cycles }: CycleTimelineProps) {
  if (cycles.length === 0) {
    return (
      <p className="text-sm text-muted">No cycles yet. Open the first one.</p>
    );
  }
  return (
    <ul className="relative border-l border-border pl-5">
      {cycles.map((c) => (
        <li key={c.id} className="mb-5 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-accent/20" />
          <p className="text-sm font-semibold capitalize text-foreground">
            {c.status}
          </p>
          <p className="text-xs text-muted">
            Cycle {c.id} — due date in Firestore
          </p>
        </li>
      ))}
    </ul>
  );
}
