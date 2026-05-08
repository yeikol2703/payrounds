import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Subscription } from "@/lib/types";

type SubCardProps = {
  subscription: Pick<Subscription, "id" | "name" | "totalCost" | "status">;
};

export function SubCard({ subscription }: SubCardProps) {
  const total = subscription.totalCost.toFixed(2);
  return (
    <Link
      href={`/subscriptions/${subscription.id}`}
      className="block rounded-2xl border border-border bg-elevated p-5 shadow-card transition hover:border-border-strong hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{subscription.name}</p>
          <p className="mt-1 text-sm text-muted">
            ${total} / cycle (total)
          </p>
        </div>
        <Badge tone={subscription.status === "active" ? "success" : "neutral"}>
          {subscription.status}
        </Badge>
      </div>
    </Link>
  );
}
