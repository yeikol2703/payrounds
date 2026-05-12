"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { getSubscriptionsForMember } from "@/lib/firestore/subscriptions";
import { subscribeToPayments, toCycleId } from "@/lib/firestore/cycles";
import { uploadProof, getProofUrl } from "@/lib/firestore/payments";
import { createNotification } from "@/lib/firestore/notifications";
import type { Subscription, Payment } from "@/lib/types";

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

export default function MemberPayPage() {
  const { appUser, signOut } = useAuth();
  const [items, setItems] = useState<SubWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});

  const cycleId = toCycleId(new Date());

  useEffect(() => {
    if (!appUser) {
      return;
    }

    let cancelled = false;
    const unsubFns: Array<() => void> = [];

    getSubscriptionsForMember(appUser.uid)
      .then((subs) => {
        if (cancelled) {
          return;
        }
        if (subs.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        subs.forEach((sub) => {
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
          unsubFns.push(unsub);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      unsubFns.forEach((u) => u());
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
    <div className="mx-auto w-full max-w-lg px-4 sm:px-6">
      <div className="mb-8 flex items-center justify-end">
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs font-semibold text-muted transition hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      <h1 className="pr-page-title">Hey {firstName}</h1>
      <p className="pr-section-lead mb-8">
        Your subscriptions for {monthLabel}
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
      ) : items.length === 0 ? (
        <div className="pr-card px-6 py-12 text-center shadow-card">
          <p className="text-sm font-medium text-foreground">
            You haven&apos;t been added to any subscriptions yet.
          </p>
          <p className="mt-2 text-sm text-muted">Ask the owner to invite you.</p>
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
