"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, List, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n, dateLocale, type MessageKey } from "@/lib/i18n";
import {
  subscribeToSubscriptions,
  getMembers,
} from "@/lib/firestore/subscriptions";
import { listPaymentsForCycle } from "@/lib/firestore/payments";
import { cancelSubscriptionFully } from "@/lib/cancel-subscription";
import type { Subscription, Member, Payment } from "@/lib/types";
import { formatCreatedAt } from "@/lib/format-date";
import { AppPage } from "@/components/app-page";
import { MotionList, MotionItem } from "@/components/motion";
import { ServiceIcon } from "@/components/subscription/service-icon";

interface SubCardData {
  sub: Subscription;
  members: Member[];
  payments: Payment[];
  cycleId: string;
}

type DashboardView = "cards" | "list";

const VIEW_KEY = "payround.dashboardView";

function currentCycleId() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPaymentStatus(
  payments: Payment[],
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) {
  const total = payments.length;
  if (total === 0) {
    return { label: t("dash.status.noMembers"), color: "gray" as const };
  }
  const pending = payments.filter((p) => p.status === "pending_review").length;
  const missing = payments.filter((p) => p.status === "missing").length;
  if (missing === 0 && pending === 0) {
    return { label: t("dash.status.allPaid"), color: "green" as const };
  }
  if (pending > 0) {
    return {
      label: t("dash.status.toReview", { n: pending }),
      color: "blue" as const,
    };
  }
  return {
    label: t("dash.status.missing", { n: missing }),
    color: (missing > 1 ? "red" : "amber") as "red" | "amber",
  };
}

const statusColors: Record<string, string> = {
  green:
    "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/20",
  blue: "bg-accent-muted text-accent dark:text-blue-200 ring-1 ring-accent/20",
  amber: "pr-badge-warning",
  red: "pr-badge-danger",
  gray: "bg-foreground/5 text-muted ring-1 ring-border",
};

const paymentDotColor: Record<Payment["status"], string> = {
  confirmed: "bg-emerald-500",
  pending_review: "bg-accent",
  missing: "bg-red-500",
};

function readStoredView(): DashboardView {
  if (typeof window === "undefined") {
    return "cards";
  }
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [cards, setCards] = useState<SubCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DashboardView>("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const cycleId = useMemo(() => currentCycleId(), []);

  useEffect(() => {
    setView(readStoredView());
  }, []);

  function changeView(next: DashboardView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

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
      setSelected((prev) => {
        const ids = new Set(enriched.map((c) => c.sub.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
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
  const monthLabel = now.toLocaleDateString(dateLocale(locale), {
    month: "long",
    year: "numeric",
  });

  function toggleSelect(subId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === cards.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cards.map((c) => c.sub.id)));
    }
  }

  async function handleBulkCancel() {
    if (!appUser || selected.size === 0) {
      return;
    }
    setBulkBusy(true);
    try {
      const targets = cards.filter((c) => selected.has(c.sub.id));
      for (const { sub } of targets) {
        await cancelSubscriptionFully({
          subId: sub.id,
          subName: sub.name,
          ownerUid: appUser.uid,
          ownerDisplayName: appUser.displayName,
        });
      }
      setSelected(new Set());
      setConfirmBulk(false);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
    <AppPage
      motion
      width="4xl"
      title={monthLabel}
      lead={t("dash.lead")}
      actions={
        <>
          <div
            className="flex rounded-xl border border-border bg-elevated-muted p-1"
            role="group"
            aria-label={t("dash.viewAria")}
            data-testid="dashboard-view-toggle"
          >
            <button
              type="button"
              data-testid="dashboard-view-cards"
              aria-pressed={view === "cards"}
              onClick={() => changeView("cards")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "cards"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              {t("dash.cards")}
            </button>
            <button
              type="button"
              data-testid="dashboard-view-list"
              aria-pressed={view === "list"}
              onClick={() => changeView("list")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "list"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              {t("dash.list")}
            </button>
          </div>
          <Link
            href="/subscriptions/new"
            className="pr-btn-primary w-full shrink-0 md:w-auto"
          >
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
            {t("dash.newSub")}
          </Link>
        </>
      }
    >
      {(totalPending > 0 || totalMissing > 0) && (
        <div
          role="status"
          className="pr-alert-warning mb-8 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pr-alert-warning-icon mt-0.5 shrink-0"
            aria-hidden
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            {totalPending > 0 ? (
              <strong>{t("dash.pendingBanner", { n: totalPending })} </strong>
            ) : null}
            {totalMissing > 0 ? (
              <span>{t("dash.missingBanner", { n: totalMissing })}</span>
            ) : null}
          </span>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: t("dash.statActive"), value: cards.length },
          {
            label: t("dash.statPending"),
            value: totalPending,
            highlight: totalPending > 0 ? "blue" : undefined,
          },
          {
            label: t("dash.statMissing"),
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
                    ? "pr-text-danger"
                    : "text-foreground"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {!loading && cards.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
            <input
              type="checkbox"
              data-testid="dashboard-select-all"
              checked={selected.size === cards.length && cards.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-border"
            />
            {t("dash.selectAll")}
          </label>
          <button
            type="button"
            data-testid="dashboard-bulk-cancel"
            disabled={selected.size === 0 || bulkBusy}
            onClick={() => setConfirmBulk(true)}
            className="pr-btn-danger rounded-xl px-3 py-2 text-xs disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {t("dash.cancelSelected", { n: selected.size })}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="pr-tile animate-pulse p-6"
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
            {t("dash.emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t("dash.emptyHint")}
          </p>
          <Link href="/subscriptions/new" className="mt-6 inline-flex pr-btn-primary">
            {t("dash.emptyCta")}
          </Link>
        </div>
      ) : view === "list" ? (
        <div
          className="pr-list-glass"
          data-testid="dashboard-list"
        >
          <ul className="divide-y divide-border">
            {cards.map(({ sub, members, payments }) => {
              const status = getPaymentStatus(payments, t);
              const checked = selected.has(sub.id);
              const amount = (sub.totalCost / (members.length + 1)).toFixed(2);
              const memberWord =
                members.length === 1 ? t("dash.member") : t("dash.members");
              return (
                <li
                  key={sub.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-5"
                  data-testid={`dashboard-row-${sub.id}`}
                >
                  <input
                    type="checkbox"
                    data-testid={`dashboard-select-${sub.id}`}
                    checked={checked}
                    onChange={() => toggleSelect(sub.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 shrink-0 rounded border-border"
                    aria-label={`Select ${sub.name}`}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => router.push(`/subscriptions/${sub.id}`)}
                  >
                    <ServiceIcon
                      name={sub.name}
                      iconKey={sub.iconKey}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {sub.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {t("dash.dueMeta", {
                          day: sub.dueDayOfMonth,
                          amount,
                          n: members.length,
                          members: memberWord,
                        })}
                      </p>
                    </span>
                  </button>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[status.color]}`}
                  >
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <MotionList
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid="dashboard-cards"
        >
          {cards.map(({ sub, members, payments }) => {
            const status = getPaymentStatus(payments, t);
            const checked = selected.has(sub.id);
            const amount = (sub.totalCost / (members.length + 1)).toFixed(2);
            const memberWord =
              members.length === 1 ? t("dash.member") : t("dash.members");
            return (
              <MotionItem
                key={sub.id}
                data-testid={`dashboard-card-${sub.id}`}
                className={`pr-tile relative p-6 transition hover:brightness-110 ${
                  checked
                    ? "ring-2 ring-accent/50"
                    : ""
                }`}
              >
                <div className="absolute right-4 top-4 z-10">
                  <input
                    type="checkbox"
                    data-testid={`dashboard-select-${sub.id}`}
                    checked={checked}
                    onChange={() => toggleSelect(sub.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-border"
                    aria-label={`Select ${sub.name}`}
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/subscriptions/${sub.id}`);
                    }
                  }}
                  className="cursor-pointer pr-8"
                  onClick={() => router.push(`/subscriptions/${sub.id}`)}
                >
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <ServiceIcon
                        name={sub.name}
                        iconKey={sub.iconKey}
                        size="md"
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {sub.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                          <span>
                            {t("dash.dueDay", { day: sub.dueDayOfMonth })}
                          </span>
                          <span>{t("dash.perPerson", { amount })}</span>
                          {formatCreatedAt(sub.createdAt) ? (
                            <span>
                              {t("dash.created", {
                                date: formatCreatedAt(sub.createdAt)!,
                              })}
                            </span>
                          ) : null}
                        </div>
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
                          className="flex items-center gap-3 rounded-xl border border-border/50 bg-elevated-muted/40 px-3 py-2 backdrop-blur-sm"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
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
                                ? t("dash.status.review")
                                : payment?.status === "confirmed"
                                  ? t("dash.status.confirmed")
                                  : t("dash.status.missingLabel")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs text-subtle">
                      {cycleId} · {t("dash.open")}
                    </span>
                    {payments.every((p) => p.status === "confirmed") &&
                    members.length > 0 ? (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {t("dash.readyClose")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </MotionItem>
            );
          })}
        </MotionList>
      )}

      {confirmBulk ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) {
              setConfirmBulk(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-cancel-title"
            data-testid="dashboard-bulk-cancel-modal"
            className="w-full max-w-md rounded-2xl border border-border bg-elevated shadow-2xl"
          >
            <div className="border-b border-border px-6 py-4">
              <h2
                id="bulk-cancel-title"
                className="text-sm font-semibold text-foreground"
              >
                {t("dash.bulkTitle", { n: selected.size })}
              </h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm leading-relaxed text-muted">
                {t("dash.bulkBody")}
              </p>
            </div>
            <div className="flex gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setConfirmBulk(false)}
                className="flex-1 rounded-xl border border-border bg-elevated py-2.5 text-sm font-semibold text-foreground transition hover:bg-elevated-muted disabled:opacity-50"
              >
                {t("dash.bulkKeep")}
              </button>
              <button
                type="button"
                data-testid="dashboard-bulk-cancel-confirm"
                disabled={bulkBusy}
                onClick={() => void handleBulkCancel()}
                className="pr-btn-danger flex flex-1 rounded-xl py-2.5 text-sm disabled:opacity-50"
              >
                {bulkBusy ? t("dash.bulkCancelling") : t("dash.bulkConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppPage>
    </>
  );
}