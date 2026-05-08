"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/firestore/notifications";
import type { AppNotification, NotificationType } from "@/lib/types";

function createdAtMillis(n: AppNotification): number {
  const ts = n.createdAt as Timestamp | undefined;
  if (ts && typeof ts.toMillis === "function") {
    return ts.toMillis();
  }
  return 0;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatTimeAgo(n: AppNotification): string {
  const ms = createdAtMillis(n);
  if (!ms) {
    return "";
  }
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) {
    return "Just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  const days = Math.floor(hr / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function notifCopy(n: AppNotification): { title: string; description: string } {
  const name = n.fromDisplayName;
  switch (n.type) {
    case "proof_uploaded":
      return {
        title: `${name} uploaded proof for ${n.subName}`,
        description: `Cycle ${n.cycleId}`,
      };
    case "payment_confirmed":
      return {
        title: `Your payment for ${n.subName} was confirmed`,
        description: "",
      };
    case "payment_rejected": {
      const note = n.detail?.trim();
      return {
        title: `Your payment for ${n.subName} was rejected`,
        description: note ?? "",
      };
    }
    case "deadline_reminder":
      return {
        title: `Payment due soon for ${n.subName}`,
        description: "",
      };
    case "cycle_closed":
      return {
        title: `${n.subName} — ${n.cycleId} closed successfully`,
        description: "",
      };
    default:
      return { title: "Update", description: n.subName };
  }
}

function NotifIcon({ type }: { type: NotificationType }) {
  const base =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border";
  switch (type) {
    case "proof_uploaded":
      return (
        <span
          className={`${base} border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200`}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
      );
    case "payment_confirmed":
    case "cycle_closed":
      return (
        <span
          className={`${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200`}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    case "payment_rejected":
      return (
        <span
          className={`${base} border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200`}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      );
    case "deadline_reminder":
      return (
        <span
          className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100`}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      );
    default:
      return null;
  }
}

export default function OwnerNotificationsPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!appUser) {
      return;
    }
    return subscribeToNotifications(appUser.uid, setNotifications);
  }, [appUser]);

  const { today, earlier } = useMemo(() => {
    const start = startOfTodayMs();
    const todayList: AppNotification[] = [];
    const earlierList: AppNotification[] = [];
    for (const n of notifications) {
      if (createdAtMillis(n) >= start) {
        todayList.push(n);
      } else {
        earlierList.push(n);
      }
    }
    return { today: todayList, earlier: earlierList };
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const handleOpen = useCallback(
    async (n: AppNotification) => {
      if (!appUser) {
        return;
      }
      if (!n.read) {
        await markAsRead(appUser.uid, n.id);
      }
      router.push(`/subscriptions/${n.subId}`);
    },
    [appUser, router],
  );

  const handleMarkAll = useCallback(async () => {
    if (!appUser || unreadCount === 0) {
      return;
    }
    setMarkingAll(true);
    try {
      await markAllAsRead(appUser.uid);
    } finally {
      setMarkingAll(false);
    }
  }, [appUser, unreadCount]);

  function renderSection(title: string, items: AppNotification[]) {
    if (items.length === 0) {
      return null;
    }
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
          {title}
        </h2>
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const { title: lineTitle, description } = notifCopy(n);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void handleOpen(n)}
                  className={`flex w-full gap-3 rounded-xl border px-4 py-3 text-left text-sm shadow-sm transition ${
                    n.read
                      ? "border-border bg-elevated-muted text-muted"
                      : "border-border-strong bg-elevated text-foreground shadow-card"
                  }`}
                >
                  <NotifIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-foreground">
                      {lineTitle}
                    </p>
                    {description ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {description}
                      </p>
                    ) : null}
                    <p
                      className={`text-xs text-subtle ${description ? "mt-1.5" : "mt-1"}`}
                    >
                      {formatTimeAgo(n)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="pr-page-title">Notifications</h1>
          <p className="pr-section-lead">
            Updates when members upload proofs or cycles change.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleMarkAll()}
          disabled={markingAll || unreadCount === 0}
          className="shrink-0 rounded-xl border border-border bg-elevated px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-elevated-muted disabled:opacity-40"
        >
          {markingAll ? "Marking…" : "Mark all as read"}
        </button>
      </div>

      <div className="max-w-lg">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted">No notifications yet.</p>
        ) : (
          <>
            {renderSection("Today", today)}
            {renderSection("Earlier", earlier)}
          </>
        )}
      </div>
    </div>
  );
}
