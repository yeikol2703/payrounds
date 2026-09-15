"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { subscribeToSubscriptionsForMember } from "@/lib/firestore/subscriptions";
import { subscribeToPayments, toCycleId } from "@/lib/firestore/cycles";
import { uploadProof, getProofUrl } from "@/lib/firestore/payments";
import {
  createNotification,
  subscribeToNotifications,
} from "@/lib/firestore/notifications";
import type { Subscription, Payment, AppNotification } from "@/lib/types";
import { formatCreatedAt } from "@/lib/format-date";

interface SubWithPayment {
  sub: Subscription;
  payment: Payment | null;
}

function formatDate(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  return "";
}

function PendingProofThumbnail({ proofImagePath }: { proofImagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProofUrl(proofImagePath)
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [proofImagePath]);

  if (!url) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-xl border border-border bg-elevated-muted">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Your payment proof"
        className="max-h-52 w-full rounded-xl border border-border object-contain"
      />
      <p className="text-center text-xs font-semibold text-accent dark:text-blue-200">
        Under review
      </p>
    </div>
  );
}

function extractIndexUrl(message: string): string | null {
  const m = message.match(/https:\/\/console\.firebase\.google\.com[^\s)]+/);
  return m ? m[0]! : null;
}

function isPendingInviteNotif(n: AppNotification): boolean {
  return (
    n.type === "membership_invite" &&
    Boolean(n.inviteToken) &&
    !n.read
  );
}

export default function MemberPayPage() {
  const { appUser } = useAuth();
  const [items, setItems] = useState<SubWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [subsLoadError, setSubsLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const cycleId = toCycleId(new Date());

  useEffect(() => {
    if (!appUser) {
      return;
    }
    return subscribeToNotifications(appUser.uid, (list) => {
      setPendingInviteCount(list.filter(isPendingInviteNotif).length);
    });
  }, [appUser]);

  useEffect(() => {
    if (!appUser) {
      return;
    }

    let cancelled = false;
    const paymentUnsubs = new Map<string, () => void>();

    setSubsLoadError(null);

    const clearPaymentListeners = () => {
      for (const unsub of paymentUnsubs.values()) {
        unsub();
      }
      paymentUnsubs.clear();
    };

    const unsubSubs = subscribeToSubscriptionsForMember(
      appUser.uid,
      (subs) => {
        if (cancelled) {
          return;
        }

        const activeIds = new Set(subs.map((s) => s.id));
        for (const [id, unsub] of paymentUnsubs) {
          if (!activeIds.has(id)) {
            unsub();
            paymentUnsubs.delete(id);
          }
        }

        setItems((prev) => prev.filter((i) => activeIds.has(i.sub.id)));

        if (subs.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        for (const sub of subs) {
          if (paymentUnsubs.has(sub.id)) {
            // Keep listening; still refresh sub metadata on membership emit.
            setItems((prev) => {
              const idx = prev.findIndex((i) => i.sub.id === sub.id);
              if (idx < 0) {
                return prev;
              }
              const next = [...prev];
              next[idx] = { ...next[idx]!, sub };
              return next;
            });
            continue;
          }

          const unsub = subscribeToPayments(sub.id, cycleId, (payments) => {
            if (cancelled) {
              return;
            }
            const payment =
              payments.find((p) => p.uid === appUser.uid) ?? null;
            setItems((prev) => {
              const existing = prev.findIndex((i) => i.sub.id === sub.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { sub, payment };
                return updated;
              }
              return [...prev, { sub, payment }];
            });
            setLoading(false);
          });
          paymentUnsubs.set(sub.id, unsub);
        }
      },
      (err) => {
        if (cancelled) {
          return;
        }
        const raw = err.message || String(err);
        console.error("subscribeToSubscriptionsForMember", err);
        const indexUrl = extractIndexUrl(raw);
        if (
          raw.includes("index") ||
          raw.includes("Index") ||
          raw.includes("FAILED_PRECONDITION")
        ) {
          setSubsLoadError(
            indexUrl
              ? `Firestore needs a one-time index for member lookups. Create it here, wait until it finishes building, then refresh this page: ${indexUrl}`
              : "Firestore needs an index for member subscriptions (collection group `members` on field `uid`). Deploy `firestore.indexes.json` from this project (`firebase deploy --only firestore:indexes`) or open the link in the browser console error, then refresh.",
          );
        } else {
          setSubsLoadError(
            raw ||
              "Could not load your subscriptions. Check your connection and try again.",
          );
        }
        setItems([]);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubSubs();
      clearPaymentListeners();
    };
  }, [appUser, cycleId]);

  async function handleUpload(sub: Subscription, file: File) {
    if (!appUser) {
      return;
    }
    setUploadError((prev) => {
      const next = { ...prev };
      delete next[sub.id];
      return next;
    });
    setUploading(sub.id);
    try {
      await uploadProof(sub.id, cycleId, appUser.uid, file);
      await createNotification({
        recipientUid: sub.ownerId,
        type: "proof_uploaded",
        subId: sub.id,
        subName: sub.name,
        cycleId,
        fromUid: appUser.uid,
        fromDisplayName: appUser.displayName,
      });
    } catch {
      setUploadError((prev) => ({
        ...prev,
        [sub.id]: "Could not upload proof. Try again.",
      }));
    } finally {
      setUploading(null);
    }
  }

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstName = appUser?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-8" data-testid="member-pay-page">
      <h1 className="pr-page-title">Hey {firstName}</h1>
      <p className="pr-section-lead mb-8">
        Subscriptions you joined for {monthLabel}
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border bg-elevated p-6 shadow-card"
            >
              <div className="mb-4 h-4 w-1/3 rounded-lg bg-elevated-muted" />
              <div className="h-16 rounded-xl bg-elevated-muted" />
            </div>
          ))}
        </div>
      ) : subsLoadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-left text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-semibold text-foreground">Couldn&apos;t load subscriptions</p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">
            {subsLoadError}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="pr-card px-6 py-12 text-center shadow-card">
          {pendingInviteCount > 0 ? (
            <>
              <p className="text-sm font-medium text-foreground">
                You have {pendingInviteCount} pending invite
                {pendingInviteCount > 1 ? "s" : ""}.
              </p>
              <p className="mt-2 text-sm text-muted">
                Accept in Notifications to see them here and pay your share.
              </p>
              <Link
                href="/notifications"
                className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110"
              >
                Open Notifications
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                You haven&apos;t been added to any subscriptions yet.
              </p>
              <p className="mt-2 text-sm text-muted">
                When someone invites you, accept from Notifications — then the
                subscription shows up here.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(({ sub, payment }) => {
            const status = payment?.status ?? "missing";
            const isUploading = uploading === sub.id;

            const borderTone =
              status === "confirmed"
                ? "border-emerald-500/35"
                : status === "pending_review"
                  ? "border-accent/35"
                  : "border-red-400/40";

            return (
              <div
                key={sub.id}
                className={`rounded-2xl border-2 bg-elevated p-4 shadow-card sm:p-6 ${borderTone}`}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {sub.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      Due {sub.dueDayOfMonth}th · $
                      {payment?.amount?.toFixed(2) ?? "—"}
                      {formatCreatedAt(sub.createdAt)
                        ? ` · Created ${formatCreatedAt(sub.createdAt)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      status === "confirmed"
                        ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                        : status === "pending_review"
                          ? "bg-accent-muted text-accent dark:text-blue-200"
                          : "bg-red-500/12 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {status === "confirmed"
                      ? "Paid ✓"
                      : status === "pending_review"
                        ? "Under review"
                        : "Payment due"}
                  </span>
                </div>

                {status === "missing" && payment?.rejectionNote ? (
                  <div
                    role="status"
                    className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-950 dark:text-amber-100"
                  >
                    <strong>Note from owner:</strong> {payment.rejectionNote}
                  </div>
                ) : null}

                {status === "confirmed" ? (
                  <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                      Payment confirmed
                    </p>
                    {payment?.confirmedAt ? (
                      <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                        {formatDate(payment.confirmedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {status === "pending_review" ? (
                  <div className="space-y-3 rounded-xl border border-accent/25 bg-accent-muted/40 p-4">
                    {payment?.proofImagePath ? (
                      <PendingProofThumbnail
                        proofImagePath={payment.proofImagePath}
                      />
                    ) : null}
                    <div className="flex items-center gap-3 text-accent dark:text-blue-100">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="shrink-0 opacity-80"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold">Proof submitted</p>
                        <p className="text-xs opacity-90">
                          Waiting for the owner to confirm
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {status === "missing" ? (
                  <div>
                    <input
                      id={`proof-upload-${sub.id}`}
                      data-testid={`proof-upload-${sub.id}`}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleUpload(sub, file);
                        }
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`proof-upload-${sub.id}`}
                      aria-busy={isUploading}
                      className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-elevated-muted/50 py-6 transition hover:border-accent/50 hover:bg-accent-muted/30 ${
                        isUploading ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      <span className="flex w-full flex-col items-center gap-2">
                        {isUploading ? (
                          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
                        ) : (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="text-subtle"
                            aria-hidden
                          >
                            <polyline points="16 16 12 12 8 16" />
                            <line x1="12" y1="12" x2="12" y2="21" />
                            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                          </svg>
                        )}
                        <span className="text-sm font-semibold text-foreground">
                          {isUploading ? "Uploading…" : "Upload payment proof"}
                        </span>
                        <span className="text-xs text-muted">
                          Screenshot or photo of your transfer
                        </span>
                      </span>
                    </label>
                    {uploadError[sub.id] ? (
                      <p className="mt-2 text-center text-xs font-medium text-red-600 dark:text-red-400">
                        {uploadError[sub.id]}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
