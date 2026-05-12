"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { sendInvite } from "@/app/actions/invites";
import { useAuth } from "@/lib/auth-context";
import {
  getSubscriptionWithMembers,
  subscribeToMembers,
  addMember,
  removeMember,
  cancelSubscription,
} from "@/lib/firestore/subscriptions";
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
import { getAppUserByEmail } from "@/lib/firestore/users";
import type { SubscriptionWithMembers, Payment, Member } from "@/lib/types";

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
      className="fixed inset-0 z-50 flex flex-col bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:bg-foreground/50 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-elevated shadow-none sm:max-h-[90vh] sm:max-w-md sm:flex-none sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl"
        role="dialog"
        aria-labelledby="proof-modal-title"
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

        <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4 sm:flex-row sm:gap-3 sm:px-6 sm:py-4">
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

function CancelSubscriptionConfirmModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading: boolean;
}) {
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
        className="w-full max-w-md rounded-2xl border border-border bg-elevated shadow-2xl"
        role="dialog"
        aria-labelledby="cancel-sub-title"
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
            history will be kept.
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
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
        className="w-full max-w-md rounded-2xl border border-border bg-elevated shadow-2xl"
        role="dialog"
        aria-labelledby="remove-member-title"
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedRegistered, setAddedRegistered] = useState(false);
  const [inviteShare, setInviteShare] = useState<{
    url: string;
    email: string;
    emailSent: boolean;
  } | null>(null);

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "http://localhost:3000";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInviteShare(null);
    setAddedRegistered(false);
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
      const user = await getAppUserByEmail(trimmed);
      if (user) {
        if (user.uid === ownerId) {
          setError("That account is you — invite someone else.");
          return;
        }
        await addMember(subId, {
          uid: user.uid,
          email: user.email ?? trimmed,
          displayName:
            user.displayName?.trim() || trimmed.split("@")[0] || trimmed,
        });
        await syncPaymentsForCurrentCycle(subId);
        setAddedRegistered(true);
      } else {
        const idToken = await getAuth().currentUser?.getIdToken(true);
        if (!idToken) {
          setError("Could not verify your session. Try signing in again.");
          return;
        }
        const { token, emailSent } = await sendInvite(
          idToken,
          trimmed,
          subId,
          sub.name,
          ownerDisplayName,
          ownerId,
        );
        const url = `${appBase}/invite/${token}`;
        setInviteShare({ url, email: trimmed, emailSent });
      }
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-elevated shadow-2xl"
        role="dialog"
        aria-labelledby="add-member-title"
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
          {addedRegistered ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                They’ve been added to this subscription. Their share was
                recalculated for everyone.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="pr-btn-primary w-full py-3"
              >
                Done
              </button>
            </div>
          ) : inviteShare ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {inviteShare.emailSent
                  ? "We sent them an invite email. You can also share the link manually."
                  : "We couldn’t send the invite email (for example, deliverability limits). Copy the link and send it to them."}
              </p>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  {inviteShare.email}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-lg bg-elevated-muted px-3 py-2 text-xs text-foreground">
                    {inviteShare.url}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(inviteShare.url)
                    }
                    className="shrink-0 rounded-xl border border-border bg-elevated px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-elevated-muted"
                  >
                    Copy link
                  </button>
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
              {error ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
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
    if (!subId) {
      return;
    }
    setCancelling(true);
    try {
      await cancelSubscription(subId);
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
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-1/3 rounded-lg bg-elevated-muted" />
          <div className="h-52 rounded-2xl bg-elevated-muted" />
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="px-4 py-8 text-center sm:px-6">
        <p className="text-sm font-medium text-muted">Subscription not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
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
            className="rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-500/20 dark:text-red-200"
          >
            Cancel subscription
          </button>
        ) : null}
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="pr-page-title">{sub.name}</h1>
            {isOwner && sub.status === "active" ? (
              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-elevated-muted"
              >
                Add member
              </button>
            ) : null}
          </div>
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
        <div className="border-b border-border bg-elevated-muted/50 px-4 py-4 sm:px-5">
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
    </div>
  );
}
