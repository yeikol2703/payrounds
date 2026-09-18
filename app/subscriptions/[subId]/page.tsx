"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  getSubscriptionWithMembers,
  subscribeToMembers,
  removeMember,
  updateSubscription,
} from "@/lib/firestore/subscriptions";
import { cancelSubscriptionFully } from "@/lib/cancel-subscription";
import {
  sendInvite,
} from "@/app/actions/invites";
import {
  subscribeToPayments,
  closeCycle,
  toCycleId,
  syncPaymentsForCurrentCycle,
} from "@/lib/firestore/cycles";
import {
  confirmPayment,
  rejectPayment,
  getProofUrl,
} from "@/lib/firestore/payments";
import { createNotification } from "@/lib/firestore/notifications";
import { findUserByEmail } from "@/app/actions/users";
import { useAuth } from "@/lib/auth-context";
import type { SubscriptionWithMembers, Payment, Member } from "@/lib/types";
import { formatCreatedAt } from "@/lib/format-date";
import { AppPage } from "@/components/app-page";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { ServiceIcon } from "@/components/subscription/service-icon";
import { ServiceIconPicker } from "@/components/subscription/service-icon-picker";
import { useDialogEscape } from "@/components/ui/modal";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogEscape(true, onClose, panelRef);

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
    setActionError(null);
    try {
      await confirmPayment(subId, cycleId, payment.uid);
      try {
        await onAfterConfirm();
      } catch (err) {
        console.warn("post-confirm notification failed", err);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  async function handleReject() {
    setLoading(true);
    setAction("reject");
    setActionError(null);
    try {
      await rejectPayment(subId, cycleId, payment.uid, note);
      try {
        await onAfterReject(note);
      } catch (err) {
        console.warn("post-reject notification failed", err);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:bg-foreground/50 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-elevated shadow-none outline-none sm:max-h-[90vh] sm:max-w-md sm:flex-none sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-modal-title"
        tabIndex={-1}
        data-testid="proof-review-modal"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                  className="max-h-[55vh] w-full cursor-zoom-in rounded-xl border border-border object-contain transition hover:opacity-90 sm:max-h-[70vh]"
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
                Note for {memberName}{" "}
                <span className="font-normal text-muted">(optional)</span>
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

        {/* Confirm first in DOM: primary on top (mobile) and right (sm:flex-row-reverse). */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4 sm:flex-row-reverse sm:gap-3 sm:px-6 sm:py-4">
          {actionError ? (
            <p
              role="alert"
              data-testid="proof-action-error"
              className="w-full text-xs pr-text-danger sm:order-first sm:basis-full"
            >
              {actionError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            data-testid="proof-confirm"
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
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            data-testid="proof-reject"
            className="pr-btn-danger flex flex-1 rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading && action === "reject" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
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
        </div>
      </div>
    </div>
  );
}

function CancelSubscriptionConfirmModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogEscape(true, onClose, panelRef);

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
        ref={panelRef}
        className="w-full max-w-md rounded-2xl border border-border bg-elevated shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-sub-title"
        tabIndex={-1}
      >
        <div className="border-b border-border px-6 py-4">
          <h2
            id="cancel-sub-title"
            className="text-sm font-semibold text-foreground"
          >
            Cancel subscription
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-muted">
            Are you sure? This will cancel the subscription. Current month
            history will be kept. Pending invites will also be voided.
          </p>
        </div>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-border bg-elevated py-2.5 text-sm font-semibold text-foreground transition hover:bg-elevated-muted disabled:opacity-50"
          >
            Keep subscription
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="pr-btn-danger flex flex-1 rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
            ) : null}
            Confirm cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveMemberConfirmModal({
  memberName,
  onClose,
  onConfirm,
  loading,
}: {
  memberName: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogEscape(true, onClose, panelRef);

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
        ref={panelRef}
        className="w-full max-w-md rounded-2xl border border-border bg-elevated shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-member-title"
        tabIndex={-1}
      >
        <div className="border-b border-border px-6 py-4">
          <h2
            id="remove-member-title"
            className="text-sm font-semibold text-foreground"
          >
            Remove member
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-muted">
            Remove {memberName} from this subscription?
          </p>
        </div>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-border bg-elevated py-2.5 text-sm font-semibold text-foreground transition hover:bg-elevated-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMemberModal({
  sub,
  subId,
  ownerId,
  ownerDisplayName,
  ownerEmail,
  onClose,
}: {
  sub: SubscriptionWithMembers;
  subId: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteShare, setInviteShare] = useState<{
    url: string;
    email: string;
    emailSent: boolean;
    emailFailureReason?: string;
    inAppNotified?: boolean;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogEscape(true, onClose, panelRef);

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "http://localhost:3000";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInviteShare(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (sub.members.some((m) => m.email.trim().toLowerCase() === trimmed)) {
      setError("That person is already in this subscription.");
      return;
    }
    if (ownerEmail && trimmed === ownerEmail) {
      setError("Use a friend’s email — you’re already the owner.");
      return;
    }

    setLoading(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken(true);
      if (!idToken) {
        setError("Could not verify your session. Try signing in again.");
        return;
      }

      // Always create an invite — member must accept before they appear on the sub.
      const user = await findUserByEmail(idToken, trimmed);
      if (user?.uid === ownerId) {
        setError("That account is you — invite someone else.");
        return;
      }

      const amountNum = parseFloat(customAmount);
      const useCustom =
        sub.splitMode === "custom" ||
        (Number.isFinite(amountNum) && amountNum > 0);
      if (sub.splitMode === "custom") {
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          setError("Enter this friend’s share amount.");
          return;
        }
      }

      const { token, emailSent, emailFailureReason } = await sendInvite(
        idToken,
        trimmed,
        subId,
        sub.name,
        ownerDisplayName,
        ownerId,
        useCustom && amountNum > 0 ? { amountOwed: amountNum } : undefined,
      );
      const url = `${appBase}/invite/${token}`;

      if (user) {
        try {
          await createNotification({
            recipientUid: user.uid,
            type: "membership_invite",
            subId,
            subName: sub.name,
            cycleId: toCycleId(new Date()),
            fromUid: ownerId,
            fromDisplayName: ownerDisplayName,
            inviteToken: token,
          });
        } catch (notifErr) {
          console.warn("membership_invite notification failed", notifErr);
        }
      }

      setInviteShare({
        url,
        email: trimmed,
        emailSent: Boolean(user) || emailSent,
        emailFailureReason: user ? undefined : emailFailureReason,
        inAppNotified: Boolean(user),
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const whatsappHref = inviteShare
    ? `https://wa.me/?text=${encodeURIComponent(
        `You're invited to split ${sub.name} on Payround: ${inviteShare.url}`,
      )}`
    : "";

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
        ref={panelRef}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-elevated shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="add-member-title"
            className="text-sm font-semibold text-foreground"
          >
            Add member
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
          {inviteShare ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {inviteShare.inAppNotified
                  ? "They’ll see an invite in Notifications and must accept before joining. You can also share the link."
                  : inviteShare.emailSent
                    ? "We sent them an invite email. They must accept before they appear on this subscription. You can also share the link."
                    : "We couldn’t send the invite email automatically. Copy the link and send it to them (for example by WhatsApp). They must accept before joining."}
              </p>
              {!inviteShare.emailSent && inviteShare.emailFailureReason ? (
                <p
                  role="status"
                  className="pr-alert-warning rounded-lg px-3 py-2 text-xs"
                >
                  {inviteShare.emailFailureReason}
                </p>
              ) : null}
              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  {inviteShare.email}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code
                    data-testid="invite-share-url"
                    className="flex-1 break-all rounded-lg bg-elevated-muted px-3 py-2 text-xs text-foreground"
                  >
                    {inviteShare.url}
                  </code>
                  <CopyLinkButton
                    text={inviteShare.url}
                    data-testid="invite-copy-link"
                  />
                </div>
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-500/20 dark:text-emerald-200"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Share on WhatsApp
              </a>
              <button
                type="button"
                onClick={onClose}
                className="pr-btn-primary w-full py-3"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="add-member-email" className="pr-label">
                  Email address
                </label>
                <input
                  id="add-member-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="pr-input"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="add-member-amount" className="pr-label">
                  Their share (USD)
                  {sub.splitMode === "custom" ? "" : " — optional"}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                    $
                  </span>
                  <input
                    id="add-member-amount"
                    data-testid="add-member-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={
                      sub.splitMode === "custom"
                        ? "Required for custom split"
                        : "Leave blank for equal split"
                    }
                    className="pr-input pl-7"
                    disabled={loading}
                  />
                </div>
              </div>
              {error ? (
                <p
                  role="alert"
                  className="pr-alert-danger rounded-lg px-3 py-2 text-sm"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-border bg-elevated py-2.5 text-sm font-semibold text-foreground transition hover:bg-elevated-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="add-member-submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground" />
                  ) : null}
                  Add
                </button>
              </div>
            </form>
          )}
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconTriggerRef = useRef<HTMLButtonElement>(null);

  const cycleId = useMemo(() => toCycleId(new Date()), []);

  const isOwner = Boolean(appUser && sub && appUser.uid === sub.ownerId);
  const ownerEmail = appUser?.email?.trim().toLowerCase() ?? "";

  useEffect(() => {
    if (!subId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSub(null);
    getSubscriptionWithMembers(subId).then((data) => {
      if (!cancelled) {
        setSub(data);
        setLoading(false);
      }
    });

    const unsubMembers = subscribeToMembers(subId, (members) => {
      setSub((prev) =>
        prev?.id === subId ? { ...prev, members } : prev,
      );
    });
    const unsubPayments = subscribeToPayments(subId, cycleId, setPayments);
    return () => {
      cancelled = true;
      unsubMembers();
      unsubPayments();
    };
  }, [subId, cycleId]);

  async function handleIconChange(next: string | null) {
    if (!sub || !isOwner) {
      return;
    }
    const iconKey = next ?? null;
    try {
      await updateSubscription(sub.id, { iconKey });
      setSub((prev) => (prev ? { ...prev, iconKey } : prev));
    } catch (err) {
      console.warn("icon update failed", err);
    }
  }

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

  async function handleConfirmCancelSubscription() {
    if (!subId || !appUser || !sub) {
      return;
    }
    setCancelling(true);
    try {
      await cancelSubscriptionFully({
        subId,
        subName: sub.name,
        ownerUid: appUser.uid,
        ownerDisplayName: appUser.displayName,
      });
      router.push("/dashboard");
    } finally {
      setCancelling(false);
    }
  }

  async function handleConfirmRemoveMember() {
    if (!subId || !removeTarget) {
      return;
    }
    setRemovingMember(true);
    try {
      await removeMember(subId, removeTarget.uid);
      await syncPaymentsForCurrentCycle(subId);
      setRemoveTarget(null);
    } finally {
      setRemovingMember(false);
    }
  }

  const handleAfterConfirm = useCallback(async () => {
    const payment = reviewPayment;
    if (!appUser || !sub || !payment) {
      return;
    }
    try {
      await createNotification({
        recipientUid: payment.uid,
        type: "payment_confirmed",
        subId,
        subName: sub.name,
        cycleId,
        fromUid: appUser.uid,
        fromDisplayName: appUser.displayName,
      });
    } finally {
      setReviewPayment(null);
    }
  }, [appUser, sub, subId, cycleId, reviewPayment]);

  const handleAfterReject = useCallback(
    async (rejectionNote: string) => {
      const payment = reviewPayment;
      if (!appUser || !sub || !payment) {
        return;
      }
      const detail = rejectionNote.trim();
      try {
        await createNotification({
          recipientUid: payment.uid,
          type: "payment_rejected",
          subId,
          subName: sub.name,
          cycleId,
          fromUid: appUser.uid,
          fromDisplayName: appUser.displayName,
          ...(detail ? { detail } : {}),
        });
      } finally {
        setReviewPayment(null);
      }
    },
    [appUser, sub, subId, cycleId, reviewPayment],
  );

  const allConfirmed =
    payments.length > 0 && payments.every((p) => p.status === "confirmed");
  const pendingReview = payments.filter((p) => p.status === "pending_review");

  if (loading) {
    return (
      <div className="px-4 pb-6 pt-2 sm:px-6 sm:pb-8 sm:pt-0 md:px-8 md:py-8">
        <div className="w-full max-w-2xl animate-pulse space-y-4">
          <div className="h-7 w-1/3 rounded-lg bg-elevated-muted" />
          <div className="h-52 rounded-2xl bg-elevated-muted" />
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="px-4 pb-6 pt-2 text-center sm:px-6 sm:pb-8 sm:pt-0 md:px-8 md:py-8">
        <p className="text-sm font-medium text-muted">Subscription not found.</p>
      </div>
    );
  }

  return (
    <>
    <AppPage
      width="2xl"
      beforeHeader={
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="pr-link-back"
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
          {isOwner && sub.status === "active" ? (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="pr-btn-danger rounded-xl px-4 py-2 text-sm shadow-sm"
            >
              Cancel subscription
            </button>
          ) : null}
        </div>
      }
      title={
        <div className="flex flex-wrap items-center gap-3">
          {isOwner && sub.status === "active" ? (
            <button
              type="button"
              ref={iconTriggerRef}
              data-testid="service-icon-title-trigger"
              aria-expanded={iconPickerOpen}
              aria-label="Change icon"
              title="Tap to change icon"
              onClick={() => setIconPickerOpen((o) => !o)}
              className={`shrink-0 rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                iconPickerOpen
                  ? "ring-2 ring-accent/50"
                  : "hover:brightness-110 active:scale-95"
              }`}
            >
              <ServiceIcon name={sub.name} iconKey={sub.iconKey} size="lg" />
            </button>
          ) : (
            <ServiceIcon name={sub.name} iconKey={sub.iconKey} size="lg" />
          )}
          <h1 className="pr-page-title">{sub.name}</h1>
          {isOwner && sub.status === "active" ? (
            <button
              type="button"
              data-testid="add-member-open"
              onClick={() => setShowAddMember(true)}
              className="rounded-lg border border-border bg-elevated/60 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md transition hover:bg-elevated-muted"
            >
              Add member
            </button>
          ) : null}
        </div>
      }
      lead={
        <p className="pr-section-lead">
          ${sub.totalCost.toFixed(2)}/mo · due {sub.dueDayOfMonth}th ·{" "}
          {sub.members.length} members
          {formatCreatedAt(sub.createdAt)
            ? ` · created ${formatCreatedAt(sub.createdAt)}`
            : ""}
        </p>
      }
      actions={
        allConfirmed ? (
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {closing ? "Closing…" : "✓ Close month"}
          </button>
        ) : null
      }
    >
      {isOwner && sub.status === "active" ? (
        <div className={iconPickerOpen ? "pr-card mb-6 p-4 sm:p-5" : "mb-0"}>
          <ServiceIconPicker
            name={sub.name}
            value={sub.iconKey ?? null}
            onChange={(next) => void handleIconChange(next)}
            open={iconPickerOpen}
            onOpenChange={setIconPickerOpen}
            panelOnly
            anchorRef={iconTriggerRef}
          />
        </div>
      ) : null}

      {pendingReview.length > 0 ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-accent dark:text-blue-100">
            <strong>{pendingReview.length}</strong> payment
            {pendingReview.length > 1 ? "s" : ""} waiting for review
          </p>
          <button
            type="button"
            onClick={() => setReviewPayment(pendingReview[0]!)}
            data-testid="proof-review-banner-open"
            className="rounded-xl bg-elevated px-3 py-2 text-xs font-semibold text-accent shadow-sm transition hover:brightness-110 dark:text-blue-700"
          >
            Review
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden pr-list-glass">
        <div className="border-b border-border bg-elevated-muted/30 px-4 py-4 sm:px-5">
          <p className="text-sm font-semibold text-foreground">
            Cycle {cycleId}
          </p>
        </div>
        <div className="divide-y divide-border">
          {sub.members.map((m) => {
            const payment = payments.find((p) => p.uid === m.uid);
            const status = payment?.status ?? "missing";

            return (
              <div
                key={m.uid}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-bold text-accent">
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {m.displayName}
                    </p>
                    <p className="truncate text-xs text-muted">{m.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 sm:flex-1 sm:flex-nowrap sm:items-center sm:justify-between sm:border-0 sm:pt-0">
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      status === "confirmed"
                        ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                        : status === "pending_review"
                          ? "bg-accent-muted text-accent dark:text-blue-200"
                          : "pr-badge-danger"
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
                      data-testid={`proof-view-${m.uid}`}
                      className="text-xs font-semibold text-accent underline-offset-2 hover:underline dark:text-blue-300"
                    >
                      View proof
                    </button>
                  ) : null}
                  </div>
                  {isOwner && sub.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(m)}
                      className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-muted transition hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 sm:ml-0"
                      aria-label={`Remove ${m.displayName}`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {sub.members.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted sm:px-5">
              No members yet. Add friends when creating a subscription.
            </div>
          ) : null}
        </div>
      </div>
    </AppPage>

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

      {showCancelConfirm ? (
        <CancelSubscriptionConfirmModal
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={handleConfirmCancelSubscription}
          loading={cancelling}
        />
      ) : null}

      {removeTarget ? (
        <RemoveMemberConfirmModal
          memberName={removeTarget.displayName}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemoveMember}
          loading={removingMember}
        />
      ) : null}

      {showAddMember && appUser ? (
        <AddMemberModal
          sub={sub}
          subId={subId}
          ownerId={appUser.uid}
          ownerDisplayName={appUser.displayName}
          ownerEmail={ownerEmail}
          onClose={() => setShowAddMember(false)}
        />
      ) : null}
    </>
  );
}
