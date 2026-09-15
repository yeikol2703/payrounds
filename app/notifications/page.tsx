"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  Bell,
  Check,
  Clock,
  Ban,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/firestore/notifications";
import {
  acceptInviteJoin,
  declineInviteJoin,
} from "@/app/actions/invites";
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

function formatCreatedDate(n: AppNotification): string {
  const ms = createdAtMillis(n);
  if (!ms) {
    return "";
  }
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
    case "membership_invite":
      return {
        title: `${name} invited you to ${n.subName}`,
        description: "Accept to join this subscription. Until then it won’t appear in Member.",
      };
    case "subscription_cancelled":
      return {
        title: `${n.subName} was cancelled`,
        description: `${name} cancelled this subscription. It no longer appears in Member.`,
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
          <Upload className="h-4 w-4" />
        </span>
      );
    case "payment_confirmed":
    case "cycle_closed":
      return (
        <span
          className={`${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200`}
          aria-hidden
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
        </span>
      );
    case "payment_rejected":
      return (
        <span
          className={`${base} border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200`}
          aria-hidden
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </span>
      );
    case "deadline_reminder":
      return (
        <span
          className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100`}
          aria-hidden
        >
          <Clock className="h-4 w-4" />
        </span>
      );
    case "membership_invite":
      return (
        <span
          className={`${base} border-accent/30 bg-accent-muted text-accent`}
          aria-hidden
        >
          <UserPlus className="h-4 w-4" />
        </span>
      );
    case "subscription_cancelled":
      return (
        <span
          className={`${base} border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200`}
          aria-hidden
        >
          <Ban className="h-4 w-4" />
        </span>
      );
    default:
      return (
        <span
          className={`${base} border-border bg-elevated-muted text-muted`}
          aria-hidden
        >
          <Bell className="h-4 w-4" />
        </span>
      );
  }
}

export default function NotificationsPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      if (!appUser || n.type === "membership_invite") {
        return;
      }
      if (!n.read) {
        await markAsRead(appUser.uid, n.id);
      }
      // Owner reviews proofs on the subscription page; member updates go to /pay.
      if (n.type === "proof_uploaded") {
        router.push(`/subscriptions/${n.subId}`);
        return;
      }
      if (
        n.type === "payment_confirmed" ||
        n.type === "payment_rejected" ||
        n.type === "deadline_reminder" ||
        n.type === "subscription_cancelled"
      ) {
        router.push("/pay");
        return;
      }
      router.push(`/subscriptions/${n.subId}`);
    },
    [appUser, router],
  );

  const handleAcceptInvite = useCallback(
    async (n: AppNotification) => {
      if (!appUser || !n.inviteToken) {
        setActionError("This invite is missing a token. Ask for a new invite.");
        return;
      }
      setActingId(n.id);
      setActionError(null);
      try {
        const idToken = await getAuth().currentUser?.getIdToken(true);
        if (!idToken) {
          throw new Error("Could not verify your session.");
        }
        const result = await acceptInviteJoin(n.inviteToken, idToken);
        if (!result.ok && result.error !== "already_accepted") {
          throw new Error(result.error);
        }
        await markAsRead(appUser.uid, n.id);
        router.push("/pay");
      } catch (e) {
        setActionError(
          e instanceof Error ? e.message : "Could not accept invite.",
        );
      } finally {
        setActingId(null);
      }
    },
    [appUser, router],
  );

  const handleDeclineInvite = useCallback(
    async (n: AppNotification) => {
      if (!appUser) {
        return;
      }
      setActingId(n.id);
      setActionError(null);
      try {
        if (n.inviteToken) {
          const idToken = await getAuth().currentUser?.getIdToken(true);
          if (idToken) {
            await declineInviteJoin(n.inviteToken, idToken);
          }
        }
        await markAsRead(appUser.uid, n.id);
      } catch (e) {
        setActionError(
          e instanceof Error ? e.message : "Could not decline invite.",
        );
      } finally {
        setActingId(null);
      }
    },
    [appUser],
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
            const isInvite = n.type === "membership_invite";
            const created = formatCreatedDate(n);
            const busy = actingId === n.id;
            // Actions stay until Accept/Decline marks the notif read.
            const canActOnInvite = isInvite && Boolean(n.inviteToken) && !n.read;

            if (isInvite) {
              return (
                <li key={n.id}>
                  <div
                    className={`flex w-full flex-col gap-3 rounded-xl border px-4 py-3 text-left text-sm ${
                      canActOnInvite
                        ? "border-border-strong bg-elevated shadow-card"
                        : "border-border bg-elevated-muted shadow-sm"
                    }`}
                    data-testid="notif-membership-invite"
                  >
                    <div className="flex gap-3">
                      <NotifIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug text-foreground">
                          {lineTitle}
                        </p>
                        {canActOnInvite && description ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted">
                            {description}
                          </p>
                        ) : null}
                        {!canActOnInvite ? (
                          <p className="mt-1 text-xs text-muted">
                            Invite handled — check Member if you accepted.
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-subtle">
                          {formatTimeAgo(n)}
                          {created ? ` · ${created}` : ""}
                        </p>
                      </div>
                    </div>
                    {canActOnInvite ? (
                      <div className="flex gap-2 pl-[3.25rem]">
                        <button
                          type="button"
                          disabled={busy}
                          data-testid="notif-invite-accept"
                          onClick={() => void handleAcceptInvite(n)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          {busy ? "Working…" : "Accept"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          data-testid="notif-invite-decline"
                          onClick={() => void handleDeclineInvite(n)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-elevated py-2 text-xs font-semibold text-foreground transition hover:bg-elevated-muted disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            }

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
                      {created ? ` · ${created}` : ""}
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
    <div className="px-4 pb-6 pt-2 sm:px-6 sm:pb-8 sm:pt-0 md:px-8 md:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="pr-page-title">Notifications</h1>
          <p className="pr-section-lead">
            Invites to join, payment updates, and cycle changes.
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

      <div className="mx-auto w-full max-w-lg">
        {actionError ? (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            {actionError}
          </p>
        ) : null}
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
