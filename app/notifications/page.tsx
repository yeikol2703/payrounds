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
import { useI18n, dateLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { AppPage } from "@/components/app-page";
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

function formatTimeAgo(
  n: AppNotification,
  locale: "es" | "en",
  t: (key: import("@/lib/i18n").MessageKey, vars?: Record<string, string | number>) => string,
): string {
  const ms = createdAtMillis(n);
  if (!ms) {
    return "";
  }
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) {
    return t("notif.ago.just");
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return t("notif.ago.m", { n: min });
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return t("notif.ago.h", { n: hr });
  }
  const days = Math.floor(hr / 24);
  if (days < 7) {
    return t("notif.ago.d", { n: days });
  }
  return new Date(ms).toLocaleDateString(dateLocale(locale), {
    month: "short",
    day: "numeric",
  });
}

function formatCreatedDate(n: AppNotification, locale: "es" | "en"): string {
  const ms = createdAtMillis(n);
  if (!ms) {
    return "";
  }
  return new Date(ms).toLocaleDateString(dateLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function notifCopy(
  n: AppNotification,
  t: (key: import("@/lib/i18n").MessageKey, vars?: Record<string, string | number>) => string,
): { title: string; description: string } {
  const name = n.fromDisplayName;
  const sub = n.subName;
  switch (n.type) {
    case "proof_uploaded":
      return {
        title: t("notif.copy.proofUploaded", { name, sub }),
        description: t("notif.copy.cycle", { cycle: n.cycleId }),
      };
    case "payment_confirmed":
      return {
        title: t("notif.copy.confirmed", { sub }),
        description: "",
      };
    case "payment_rejected": {
      const note = n.detail?.trim();
      return {
        title: t("notif.copy.rejected", { sub }),
        description: note ?? "",
      };
    }
    case "deadline_reminder":
      return {
        title: t("notif.copy.deadline", { sub }),
        description: "",
      };
    case "cycle_closed":
      return {
        title: t("notif.copy.cycleClosed", { sub, cycle: n.cycleId }),
        description: "",
      };
    case "membership_invite":
      return {
        title: t("notif.copy.invite", { name, sub }),
        description: t("notif.copy.inviteDesc"),
      };
    case "subscription_cancelled":
      return {
        title: t("notif.copy.cancelled", { sub }),
        description: t("notif.copy.cancelledDesc", { name }),
      };
    case "membership_left":
      return {
        title: t("notif.copy.memberLeft", { name, sub }),
        description: t("notif.copy.memberLeftDesc"),
      };
    default:
      return { title: t("notif.copy.generic"), description: n.subName };
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
          className={`${base} pr-badge-danger border-transparent`}
          aria-hidden
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </span>
      );
    case "deadline_reminder":
      return (
        <span
          className={`${base} pr-badge-warning border-transparent`}
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
    case "membership_left":
      return (
        <span
          className={`${base} pr-badge-danger border-transparent`}
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
  const { t, locale } = useI18n();
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
            const { title: lineTitle, description } = notifCopy(n, t);
            const isInvite = n.type === "membership_invite";
            const created = formatCreatedDate(n, locale);
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
                          {formatTimeAgo(n, locale, t)}
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
                      {formatTimeAgo(n, locale, t)}
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
    <AppPage
      title={t("notif.title")}
      lead={t("notif.lead")}
      actions={
        <button
          type="button"
          onClick={() => void handleMarkAll()}
          disabled={markingAll || unreadCount === 0}
          className="shrink-0 rounded-xl border border-border bg-elevated px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-elevated-muted disabled:opacity-40"
        >
          {markingAll ? t("notif.marking") : t("notif.markAll")}
        </button>
      }
    >
      {actionError ? (
        <p
          role="alert"
          className="mb-4 pr-alert-danger rounded-lg px-3 py-2 text-sm"
        >
          {actionError}
        </p>
      ) : null}
      {notifications.length === 0 ? (
        <p className="text-sm text-muted">{t("notif.empty")}</p>
      ) : (
        <>
          {renderSection(t("notif.today"), today)}
          {renderSection(t("notif.earlier"), earlier)}
        </>
      )}
    </AppPage>
  );
}
