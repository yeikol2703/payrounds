"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { AppPage } from "@/components/app-page";
import {
  getSubscriptionsByOwner,
  getSubscriptionsForMember,
} from "@/lib/firestore/subscriptions";
import { toCycleId } from "@/lib/firestore/cycles";
import { listPaymentsForCycle } from "@/lib/firestore/payments";

type ChartSlice = { label: string; value: number; color: string };

function DonutChart({
  slices,
  emptyLabel,
}: {
  slices: ChartSlice[];
  emptyLabel: string;
}) {
  const total = slices.reduce((s, r) => s + r.value, 0);
  if (total === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--color-elevated-muted) / 1)"
          strokeWidth={stroke}
        />
        {slices.map((slice) => {
          if (slice.value <= 0) {
            return null;
          }
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-2.5 text-left">
        {slices.map((slice) => (
          <li
            key={slice.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="truncate text-muted">{slice.label}</span>
            </span>
            <span className="font-bold tabular-nums text-foreground">
              {slice.value}
              <span className="ml-1 text-xs font-medium text-subtle">
                ({Math.round((slice.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ColumnChart({
  rows,
  emptyLabel,
}: {
  rows: ChartSlice[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.every((r) => r.value === 0)) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  const chartH = 128;
  return (
    <div
      className="flex items-end justify-start gap-5"
      data-testid="stats-bars"
    >
      {rows.map((row) => {
        const barH = Math.max(6, Math.round((row.value / max) * chartH));
        return (
          <div
            key={row.label}
            className="flex w-14 shrink-0 flex-col items-center gap-2 sm:w-16"
          >
            <p className="text-sm font-bold tabular-nums text-foreground">
              {row.value}
            </p>
            <div
              className="flex w-full items-end justify-center"
              style={{ height: chartH }}
            >
              <div
                className="w-10 rounded-t-lg sm:w-12"
                style={{ height: barH, background: row.color }}
              />
            </div>
            <p className="w-full truncate text-center text-[11px] font-medium text-muted">
              {row.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPage() {
  const { appUser } = useAuth();
  const { t } = useI18n();
  const [ownedCount, setOwnedCount] = useState(0);
  const [joinedCount, setJoinedCount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [pending, setPending] = useState(0);
  const [missing, setMissing] = useState(0);
  const [loading, setLoading] = useState(true);
  const cycleId = useMemo(() => toCycleId(new Date()), []);

  useEffect(() => {
    if (!appUser) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [owned, joined] = await Promise.all([
          getSubscriptionsByOwner(appUser.uid),
          getSubscriptionsForMember(appUser.uid),
        ]);
        if (cancelled) {
          return;
        }
        setOwnedCount(owned.length);
        setJoinedCount(joined.length);

        let p = 0;
        let pr = 0;
        let m = 0;
        await Promise.all(
          owned.map(async (sub) => {
            const payments = await listPaymentsForCycle(sub.id, cycleId);
            for (const pay of payments) {
              if (pay.status === "confirmed") {
                p += 1;
              } else if (pay.status === "pending_review") {
                pr += 1;
              } else {
                m += 1;
              }
            }
          }),
        );
        if (!cancelled) {
          setPaid(p);
          setPending(pr);
          setMissing(m);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appUser, cycleId]);

  const paymentSlices: ChartSlice[] = [
    { label: t("stats.paid"), value: paid, color: "#10b981" },
    { label: t("stats.pendingReview"), value: pending, color: "#38bdf8" },
    { label: t("stats.missing"), value: missing, color: "#f59e0b" },
  ];

  const subRows: ChartSlice[] = [
    { label: t("stats.owned"), value: ownedCount, color: "#7dd3fc" },
    { label: t("stats.joined"), value: joinedCount, color: "#94a3b8" },
  ];

  return (
    <AppPage
      width="full"
      title={t("stats.title")}
      lead={`${t("stats.cycleOverview")} · ${cycleId}`}
      data-testid="stats-page"
    >
      {loading ? (
        <p className="text-sm text-muted">{t("stats.loading")}</p>
      ) : (
        <div className="grid w-full max-w-4xl gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3 lg:col-span-2">
            {[
              { label: t("stats.owned"), value: ownedCount },
              { label: t("stats.pendingReview"), value: pending },
              { label: t("stats.missing"), value: missing },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-border bg-elevated/80 px-4 py-4 text-left shadow-card backdrop-blur-xl"
              >
                <p className="text-[11px] font-medium leading-tight text-muted">
                  {c.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-elevated/80 p-5 shadow-card backdrop-blur-xl sm:p-6">
            <h2 className="mb-5 text-left text-sm font-semibold text-foreground">
              {t("stats.paymentStatus")}
            </h2>
            <DonutChart slices={paymentSlices} emptyLabel={t("stats.empty")} />
          </div>

          <div className="rounded-2xl border border-border bg-elevated/80 p-5 shadow-card backdrop-blur-xl sm:p-6">
            <h2 className="mb-5 text-left text-sm font-semibold text-foreground">
              {t("stats.subsBreakdown")}
            </h2>
            <ColumnChart rows={subRows} emptyLabel={t("stats.empty")} />
          </div>
        </div>
      )}
    </AppPage>
  );
}
