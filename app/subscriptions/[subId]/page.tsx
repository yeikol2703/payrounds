"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { getSubscriptionWithMembers } from "@/lib/firestore/subscriptions";
import { subscribeToPayments, closeCycle, toCycleId } from "@/lib/firestore/cycles";
import {
  confirmPayment,
  rejectPayment,
  getProofUrl,
} from "@/lib/firestore/payments";
import { createNotification } from "@/lib/firestore/notifications";
import type { SubscriptionWithMembers, Payment } from "@/lib/types";

function formatUploadedAt(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
}

function ProofModal({
  payment,
  memberName,
  subId,
  cycleId,
  onClose,
  onAfterConfirm,
  onAfterReject,
}: {
  payment: Payment;
  memberName: string;
  subId: string;
  cycleId: string;
  onClose: () => void;
  onAfterConfirm: () => Promise<void>;
  onAfterReject: (note: string) => Promise<void>;
}) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);

  useEffect(() => {
    if (payment.proofImagePath) {
      getProofUrl(payment.proofImagePath).then(setProofUrl).catch(() => {});
    } else {
      setProofUrl(null);
    }
  }, [payment.proofImagePath]);

  async function handleConfirm() {
    setLoading(true);
    setAction("confirm");
    try {
      await confirmPayment(subId, cycleId, payment.uid);
      await onAfterConfirm();
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  async function handleReject() {
    setLoading(true);
    setAction("reject");
    try {
      await rejectPayment(subId, cycleId, payment.uid, note);
      await onAfterReject(note);
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-elevated shadow-2xl"
        role="dialog"
        aria-labelledby="proof-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="proof-modal-title"
            className="text-sm font-semibold text-foreground"
          >
            Review payment proof
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-subtle transition hover:bg-elevated-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-800 dark:text-orange-200">
                {memberName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {memberName}
                </p>
                <p className="text-xs text-muted">{cycleId}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-800 dark:text-emerald-200">
              ${payment.amount.toFixed(2)}
            </span>
          </div>

          <div>
            <p className="pr-kicker mb-2">Payment proof</p>
            {proofUrl ? (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofUrl}
                  alt="Payment proof"
                  className="max-h-[70vh] w-full cursor-zoom-in rounded-xl border border-border object-contain transition hover:opacity-90"
                />
              </a>
            ) : (
              <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-elevated-muted text-subtle">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="text-xs font-medium">Loading image…</p>
              </div>
            )}
            {payment.proofUploadedAt ? (
              <p className="mt-1.5 text-xs text-muted">
                Uploaded {formatUploadedAt(payment.proofUploadedAt)}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Amount", value: `$${payment.amount.toFixed(2)}` },
              { label: "Cycle", value: cycleId },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-elevated-muted p-3">
                <p className="mb-0.5 text-xs text-muted">{m.label}</p>
                <p className="text-sm font-semibold text-foreground">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {action !== "confirm" ? (
            <div>
              <label
                htmlFor="reject-note"
                className="pr-kicker mb-1.5 block"
              >
                Note for {memberName} (optional)
              </label>
              <textarea
                id="reject-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Image is blurry, please resubmit…"
                rows={2}
                className="pr-input resize-none"
              />
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-300/50 bg-red-500/10 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-200"
          >
            {loading && action === "reject" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500/40 border-t-red-600" />
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            Reject
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {loading && action === "confirm" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            Confirm payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionDetailPage() {
  const params = useParams<{ subId: string }>();
  const subId = params.subId as string;
  const { appUser } = useAuth();
  const router = useRouter();

  const [sub, setSub] = useState<SubscriptionWithMembers | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reviewPayment, setReviewPayment] = useState<Payment | null>(null);

  const cycleId = useMemo(() => toCycleId(new Date()), []);

  useEffect(() => {
    if (!subId) {
      return;
    }
    getSubscriptionWithMembers(subId).then((data) => {
      setSub(data);
      setLoading(false);
    });

    const unsub = subscribeToPayments(subId, cycleId, setPayments);
    return unsub;
  }, [subId, cycleId]);

  async function handleClose() {
    if (!appUser || !subId) {
      return;
    }
    setClosing(true);
    try {
      await closeCycle(subId, cycleId, appUser.uid);
      router.push("/dashboard");
    } finally {
      setClosing(false);
    }
  }

  const handleAfterConfirm = useCallback(async () => {
    const payment = reviewPayment;
    if (!appUser || !sub || !payment) {
      return;
    }
    await createNotification({
      recipientUid: payment.uid,
      type: "payment_confirmed",
      subId,
      subName: sub.name,
      cycleId,
      fromUid: appUser.uid,
      fromDisplayName: appUser.displayName,
    });
    setReviewPayment(null);
  }, [appUser, sub, subId, cycleId, reviewPayment]);

  const handleAfterReject = useCallback(
    async (rejectionNote: string) => {
      const payment = reviewPayment;
      if (!appUser || !sub || !payment) {
        return;
      }
      await createNotification({
        recipientUid: payment.uid,
        type: "payment_rejected",
        subId,
        subName: sub.name,
        cycleId,
        fromUid: appUser.uid,
        fromDisplayName: appUser.displayName,
        detail: rejectionNote.trim() ? rejectionNote.trim() : undefined,
      });
      setReviewPayment(null);
    },
    [appUser, sub, subId, cycleId, reviewPayment],
  );

  const allConfirmed =
    payments.length > 0 && payments.every((p) => p.status === "confirmed");
  const pendingReview = payments.filter((p) => p.status === "pending_review");

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-1/3 rounded-lg bg-elevated-muted" />
          <div className="h-52 rounded-2xl bg-elevated-muted" />
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-medium text-muted">Subscription not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="pr-link-back mb-8"
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Dashboard
      </button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="pr-page-title">{sub.name}</h1>
          <p className="pr-section-lead">
            ${sub.totalCost.toFixed(2)}/mo · due {sub.dueDayOfMonth}th ·{" "}
            {sub.members.length} members
          </p>
        </div>
        {allConfirmed ? (
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {closing ? "Closing…" : "✓ Close month"}
          </button>
        ) : null}
      </div>

      {pendingReview.length > 0 ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-accent dark:text-blue-100">
            <strong>{pendingReview.length}</strong> payment
            {pendingReview.length > 1 ? "s" : ""} waiting for review
          </p>
          <button
            type="button"
            onClick={() => setReviewPayment(pendingReview[0]!)}
            className="rounded-xl bg-elevated px-3 py-2 text-xs font-semibold text-accent shadow-sm transition hover:brightness-110 dark:text-blue-700"
          >
            Review
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-elevated shadow-card">
        <div className="border-b border-border bg-elevated-muted/50 px-5 py-4">
          <p className="text-sm font-semibold text-foreground">
            Cycle {cycleId}
          </p>
        </div>
        <div className="divide-y divide-border">
          {sub.members.map((m) => {
            const payment = payments.find((p) => p.uid === m.uid);
            const status = payment?.status ?? "missing";

            return (
              <div key={m.uid} className="flex items-center gap-3 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-bold text-accent">
                  {m.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {m.displayName}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      status === "confirmed"
                        ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                        : status === "pending_review"
                          ? "bg-accent-muted text-accent dark:text-blue-200"
                          : "bg-red-500/12 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {status === "pending_review"
                      ? "Review"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                  {status === "pending_review" && payment ? (
                    <button
                      type="button"
                      onClick={() => setReviewPayment(payment)}
                      className="text-xs font-semibold text-accent underline-offset-2 hover:underline dark:text-blue-300"
                    >
                      View proof
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {sub.members.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">
              No members yet. Add friends when creating a subscription.
            </div>
          ) : null}
        </div>
      </div>

      {reviewPayment ? (
        <ProofModal
          payment={reviewPayment}
          memberName={
            sub.members.find((m) => m.uid === reviewPayment.uid)?.displayName ??
            "Member"
          }
          subId={subId}
          cycleId={cycleId}
          onClose={() => setReviewPayment(null)}
          onAfterConfirm={handleAfterConfirm}
          onAfterReject={handleAfterReject}
        />
      ) : null}
    </div>
  );
}
