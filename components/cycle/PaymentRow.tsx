import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Payment } from "@/lib/types";

type PaymentRowProps = {
  memberLabel: string;
  payment: Pick<Payment, "amount" | "status">;
};

export function PaymentRow({ memberLabel, payment }: PaymentRowProps) {
  const amount = payment.amount.toFixed(2);
  const tone =
    payment.status === "confirmed"
      ? "success"
      : payment.status === "pending_review"
        ? "warning"
        : "neutral";
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <Avatar label={memberLabel} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {memberLabel}
        </p>
        <p className="text-xs text-muted">${amount}</p>
      </div>
      <Badge tone={tone}>{payment.status}</Badge>
    </div>
  );
}
