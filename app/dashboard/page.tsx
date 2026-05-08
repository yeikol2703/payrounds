"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeToSubscriptions,
  getMembers,
} from "@/lib/firestore/subscriptions";
import { listPaymentsForCycle } from "@/lib/firestore/payments";
import type { Subscription, Member, Payment } from "@/lib/types";

interface SubCardData {
  sub: Subscription;
  members: Member[];
  payments: Payment[];
  cycleId: string;
}

function currentCycleId() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPaymentStatus(payments: Payment[]) {
  const total = payments.length;
  if (total === 0) {
    return { label: "No members", color: "gray" };
  }
  const confirmed = payments.filter((p) => p.status === "confirmed").length;
  const pending = payments.filter((p) => p.status === "pending_review").length;
  const missing = payments.filter((p) => p.status === "missing").length;
  if (missing === 0 && pending === 0) {
    return { label: "All paid", color: "green" };
  }
  if (pending > 0) {
    return { label: `${pending} to review`, color: "blue" };
  }
  return {
    label: `${missing} missing`,
    color: missing > 1 ? "red" : "amber",
  };
}

const statusColors: Record<string, string> = {
  green:
    "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/20",
  blue: "bg-accent-muted text-accent dark:text-blue-200 ring-1 ring-accent/20",
  amber:
    "bg-amber-500/12 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/25",
  red: "bg-red-500/12 text-red-800 dark:text-red-200 ring-1 ring-red-500/20",
  gray: "bg-foreground/5 text-muted ring-1 ring-border",
};

const paymentDotColor: Record<Payment["status"], string> = {
  confirmed: "bg-emerald-500",
  pending_review: "bg-accent",
  missing: "bg-red-500",
};

export default function DashboardPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<SubCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const cycleId = useMemo(() => currentCycleId(), []);

  useEffect(() => {
    if (!appUser) {
      return;
    }

    const unsub = subscribeToSubscriptions(appUser.uid, async (subs) => {
      const enriched = await Promise.all(
        subs.map(async (sub) => {
          const [members, payments] = await Promise.all([
            getMembers(sub.id),
            listPaymentsForCycle(sub.id, cycleId),
          ]);
          return { sub, members, payments, cycleId };
        }),
      );
      setCards(enriched);
      setLoading(false);
    });

    return unsub;
  }, [appUser, cycleId]);

  const totalPending = cards.reduce(
    (acc, c) =>
      acc + c.payments.filter((p) => p.status === "pending_review").length,
    0,
  );
  const totalMissing = cards.reduce(
    (acc, c) => acc + c.payments.filter((p) => p.status === "missing").length,
    0,
  );

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="pr-page-title">{monthLabel}</h1>
          <p className="pr-section-lead">Your active subscriptions</p>
        </div>
        <Link href="/subscriptions/new" className="pr-btn-primary shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New subscription
        </Link>
      </div>

      {(totalPending > 0 || totalMissing > 0) && (
        <div
          role="status"
          className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-950 dark:text-amber-100"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            {totalPending > 0 && (
              <strong>
                {totalPending} payment{totalPending > 1 ? "s" : ""} waiting for
                your review.{" "}
              </strong>
            )}
            {totalMissing > 0 && (
              <span>{totalMissing} still missing this month.</span>
            )}
          </span>
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active subscriptions", value: cards.length },
          {
            label: "Pending review",
            value: totalPending,
            highlight: totalPending > 0 ? "blue" : undefined,
          },
          {
            label: "Missing payments",
            value: totalMissing,
            highlight: totalMissing > 0 ? "red" : undefined,
          },
        ].map((s) => (
          <div key={s.label} className="pr-card-muted px-5 py-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p
              className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
                s.highlight === "blue"
                  ? "text-accent"
                  : s.highlight === "red"
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border bg-elevated p-6 shadow-card"
            >
              <div className="mb-4 h-4 w-1/2 rounded-lg bg-elevated-muted" />
              <div className="mb-5 h-3 w-1/3 rounded-lg bg-elevated-muted" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-9 rounded-xl bg-elevated-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="pr-card px-6 py-14 text-center shadow-card sm:px-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated-muted">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-subtle"
              aria-hidden
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">
            No subscriptions yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Create your first subscription to start tracking payments.
          </p>
          <Link href="/subscriptions/new" className="mt-6 inline-flex pr-btn-primary">
            Create one
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ sub, members, payments }) => {
            const status = getPaymentStatus(payments);
            return (
              <div
                key={sub.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/subscriptions/${sub.id}`);
                  }
                }}
                className="cursor-pointer rounded-2xl border border-border bg-elevated p-6 shadow-card transition hover:border-border-strong hover:shadow-md"
                onClick={() => router.push(`/subscriptions/${sub.id}`)}
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {sub.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span>Due {sub.dueDayOfMonth}th</span>
                      <span>
                        $
                        {(sub.totalCost / (members.length + 1)).toFixed(2)} /
                        person
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[status.color]}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {members.map((m) => {
                    const payment = payments.find((p) => p.uid === m.uid);
                    return (
                      <div
                        key={m.uid}
                        className="flex items-center gap-3 rounded-xl bg-elevated-muted px-3 py-2"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
                          {m.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                          {m.displayName}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <div
                            className={`h-2 w-2 rounded-full ${paymentDotColor[payment?.status ?? "missing"]}`}
                          />
                          <span className="text-xs capitalize text-muted">
                            {payment?.status === "pending_review"
                              ? "review"
                              : (payment?.status ?? "missing")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-subtle">
                    {cycleId} · open
                  </span>
                  {payments.every((p) => p.status === "confirmed") &&
                    members.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/subscriptions/${sub.id}`);
                        }}
                        className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-500/25 dark:text-emerald-200"
                      >
                        Close month ✓
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
