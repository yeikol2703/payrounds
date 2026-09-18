"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { AppPage } from "@/components/app-page";
import {
  getMembers,
  getSubscriptionsByOwner,
} from "@/lib/firestore/subscriptions";

interface FriendEntry {
  email: string;
  displayName: string;
}

export default function FriendsPage() {
  const { appUser } = useAuth();
  const { t } = useI18n();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const owned = await getSubscriptionsByOwner(appUser.uid);
        const emailMap = new Map<string, FriendEntry>();
        await Promise.all(
          owned.map(async (sub) => {
            const members = await getMembers(sub.id);
            for (const m of members) {
              if (m.uid === appUser.uid) {
                continue;
              }
              const email = m.email.trim().toLowerCase();
              if (!email || emailMap.has(email)) {
                continue;
              }
              emailMap.set(email, {
                email,
                displayName: m.displayName || email.split("@")[0] || email,
              });
            }
          }),
        );
        if (!cancelled) {
          setFriends(
            [...emailMap.values()].sort((a, b) =>
              a.displayName.localeCompare(b.displayName),
            ),
          );
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
  }, [appUser]);

  const copyEmail = useCallback(async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      window.setTimeout(() => setCopiedEmail(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AppPage
      title={t("friends.title")}
      lead={t("friends.lead")}
      data-testid="friends-page"
    >
      <div className="space-y-3" data-testid="account-friends-panel">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl border border-border bg-elevated-muted"
              />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="pr-card px-6 py-10 text-center shadow-card">
            <p className="text-sm font-medium text-foreground">
              {t("friends.empty")}
            </p>
            <p className="mt-2 text-sm text-muted">{t("friends.hint")}</p>
            <Link
              href="/subscriptions/new"
              className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110"
            >
              {t("friends.newSub")}
            </Link>
          </div>
        ) : (
          friends.map((f) => (
            <div
              key={f.email}
              className="pr-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-card"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {f.displayName}
                </p>
                <p className="truncate text-xs text-muted">{f.email}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyEmail(f.email)}
                className="shrink-0 rounded-xl border border-border bg-elevated-muted px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-elevated"
              >
                {copiedEmail === f.email
                  ? t("friends.copied")
                  : t("friends.copyEmail")}
              </button>
            </div>
          ))
        )}
      </div>
    </AppPage>
  );
}
