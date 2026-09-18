"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, ChevronDown } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useI18n, dateLocale, type Locale } from "@/lib/i18n";
import {
  subscribeToSubscriptionsForMember,
  subscribeToMembers,
} from "@/lib/firestore/subscriptions";
import { subscribeToPayments, toCycleId } from "@/lib/firestore/cycles";
import { uploadProof, getProofUrl } from "@/lib/firestore/payments";
import {
  createNotification,
  subscribeToNotifications,
} from "@/lib/firestore/notifications";
import type {
  Subscription,
  Payment,
  AppNotification,
  Member,
  PaymentStatus,
} from "@/lib/types";
import { AppPage } from "@/components/app-page";
import { ServiceIcon } from "@/components/subscription/service-icon";

const ACCEPTED_PROOF_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

const ACCEPTED_PROOF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const VIEW_KEY = "payround.payView";

type PayView = "cards" | "list";

interface SubWithPayment {
  sub: Subscription;
  payment: Payment | null;
  members: Member[];
  allPayments: Payment[];
}

interface PendingProof {
  file: File;
  previewUrl: string | null;
  isPdf: boolean;
}

function formatDate(ts: unknown, locale: Locale): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleDateString(dateLocale(locale), {
      month: "short",
      day: "numeric",
    });
  }
  return "";
}

function readStoredView(): PayView {
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

function statusLabel(
  status: PaymentStatus,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (status === "confirmed") {
    return t("pay.status.paid");
  }
  if (status === "pending_review") {
    return t("pay.status.underReview");
  }
  return t("pay.status.due");
}

function statusBadgeClass(status: PaymentStatus): string {
  if (status === "confirmed") {
    return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "pending_review") {
    return "bg-accent-muted text-accent dark:text-blue-200";
  }
  return "pr-badge-danger";
}

function borderToneClass(status: PaymentStatus): string {
  if (status === "confirmed") {
    return "border-emerald-500/35";
  }
  if (status === "pending_review") {
    return "border-accent/35";
  }
  return "border-red-400/55";
}

function rosterBadgeLabel(
  status: PaymentStatus,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (status === "confirmed") {
    return t("pay.roster.paid");
  }
  if (status === "pending_review") {
    return t("pay.roster.underReview");
  }
  return t("pay.roster.paymentDue");
}

function rosterBadgeClass(status: PaymentStatus): string {
  return statusBadgeClass(status);
}

function PendingProofThumbnail({
  proofImagePath,
  underReviewLabel,
}: {
  proofImagePath: string;
  underReviewLabel: string;
}) {
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
        alt=""
        className="max-h-52 w-full rounded-xl border border-border object-contain"
      />
      <p className="text-center text-xs font-semibold text-accent dark:text-blue-200">
        {underReviewLabel}
      </p>
    </div>
  );
}

interface PayDetailsProps {
  sub: Subscription;
  payment: Payment | null;
  members: Member[];
  allPayments: Payment[];
  appUserUid: string | undefined;
  locale: Locale;
  t: ReturnType<typeof useI18n>["t"];
  pending: PendingProof | undefined;
  isUploading: boolean;
  uploadError: string | undefined;
  onFileSelect: (file: File | undefined) => void;
  onUpload: (file: File) => void;
}

function PayDetails({
  sub,
  payment,
  members,
  allPayments,
  appUserUid,
  locale,
  t,
  pending,
  isUploading,
  uploadError,
  onFileSelect,
  onUpload,
}: PayDetailsProps) {
  const status = payment?.status ?? "missing";

  return (
    <div className="space-y-4">
      {status === "missing" && payment?.rejectionNote ? (
        <div
          role="status"
          className="pr-alert-warning rounded-xl px-3 py-2.5 text-xs"
        >
          <strong>{t("proof.ownerNote")}:</strong> {payment.rejectionNote}
        </div>
      ) : null}

      {status === "confirmed" ? (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {t("proof.confirmed")}
          </p>
          {payment?.confirmedAt ? (
            <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
              {formatDate(payment.confirmedAt, locale)}
            </p>
          ) : null}
        </div>
      ) : null}

      {status === "pending_review" ? (
        <div className="space-y-3 rounded-xl border border-accent/25 bg-accent-muted/40 p-4">
          {payment?.proofImagePath ? (
            <PendingProofThumbnail
              proofImagePath={payment.proofImagePath}
              underReviewLabel={t("proof.underReview")}
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
              <p className="text-sm font-semibold">{t("proof.submitted")}</p>
              <p className="text-xs opacity-90">{t("proof.waitingOwner")}</p>
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
            accept={ACCEPTED_PROOF_TYPES}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onFileSelect(file);
              e.target.value = "";
            }}
          />

          {pending ? (
            <div className="space-y-3 rounded-2xl border border-border bg-elevated-muted/50 p-4">
              {pending.isPdf ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-3 py-3">
                  <span className="rounded-lg bg-accent-muted px-2 py-1 text-xs font-bold text-accent">
                    {t("proof.pdfLabel")}
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">
                    {pending.file.name}
                  </p>
                </div>
              ) : pending.previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={pending.previewUrl}
                  alt=""
                  className="max-h-52 w-full rounded-xl border border-border object-contain"
                />
              ) : (
                <p className="truncate text-sm font-medium text-foreground">
                  {pending.file.name}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <label
                  htmlFor={`proof-upload-${sub.id}`}
                  className="cursor-pointer rounded-xl border border-border bg-elevated px-3 py-2 text-xs font-semibold text-muted transition hover:bg-elevated-muted hover:text-foreground"
                >
                  {t("proof.changeFile")}
                </label>
                <button
                  type="button"
                  data-testid={`proof-submit-${sub.id}`}
                  disabled={isUploading}
                  onClick={() => onUpload(pending.file)}
                  className="flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60"
                >
                  {isUploading ? t("proof.uploading") : t("proof.submit")}
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor={`proof-upload-${sub.id}`}
              aria-busy={isUploading}
              className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-elevated-muted/50 py-6 transition hover:border-accent/50 hover:bg-accent-muted/30 ${
                isUploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <span className="flex w-full flex-col items-center gap-2">
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
                <span className="text-sm font-semibold text-foreground">
                  {t("proof.upload")}
                </span>
                <span className="text-xs text-muted">{t("proof.uploadHint")}</span>
              </span>
            </label>
          )}

          {uploadError ? (
            <p className="mt-2 text-center text-xs pr-text-danger">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}

      {members.length > 0 ? (
        <div data-testid={`pay-roster-${sub.id}`}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("pay.roster")}
          </h3>
          <ul className="space-y-2">
            {members.map((member) => {
              const memberPayment = allPayments.find(
                (p) => p.uid === member.uid,
              );
              const memberStatus = memberPayment?.status ?? "missing";
              const isYou = member.uid === appUserUid;
              return (
                <li
                  key={member.uid}
                  className="flex items-center justify-between gap-2 rounded-xl bg-elevated-muted/60 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {member.displayName}
                    {isYou ? (
                      <span className="ml-1.5 text-xs font-normal text-muted">
                        ({t("pay.roster.you")})
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${rosterBadgeClass(memberStatus)}`}
                  >
                    {rosterBadgeLabel(memberStatus, t)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function MemberPayPage() {
  const { appUser } = useAuth();
  const { t, locale } = useI18n();
  const [items, setItems] = useState<SubWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [pendingProofs, setPendingProofs] = useState<
    Record<string, PendingProof | undefined>
  >({});
  const [view, setView] = useState<PayView>("cards");
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  const cycleId = toCycleId(new Date());

  useEffect(() => {
    setView(readStoredView());
  }, []);

  useEffect(() => {
    if (!appUser) {
      return;
    }
    return subscribeToNotifications(appUser.uid, (list) => {
      setPendingInviteCount(list.filter(isPendingInviteNotif).length);
    });
  }, [appUser]);

  useEffect(() => {
    return () => {
      for (const entry of Object.values(pendingProofs)) {
        if (entry?.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      }
    };
  }, [pendingProofs]);

  useEffect(() => {
    if (!appUser) {
      return;
    }

    let cancelled = false;
    const paymentUnsubs = new Map<string, () => void>();
    const memberUnsubs = new Map<string, () => void>();

    setHasLoadError(false);

    const clearListeners = () => {
      for (const unsub of paymentUnsubs.values()) {
        unsub();
      }
      paymentUnsubs.clear();
      for (const unsub of memberUnsubs.values()) {
        unsub();
      }
      memberUnsubs.clear();
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
        for (const [id, unsub] of memberUnsubs) {
          if (!activeIds.has(id)) {
            unsub();
            memberUnsubs.delete(id);
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

          const unsubPayments = subscribeToPayments(sub.id, cycleId, (payments) => {
            if (cancelled) {
              return;
            }
            const payment =
              payments.find((p) => p.uid === appUser.uid) ?? null;
            setItems((prev) => {
              const existing = prev.findIndex((i) => i.sub.id === sub.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = {
                  ...updated[existing]!,
                  sub,
                  payment,
                  allPayments: payments,
                };
                return updated;
              }
              return [
                ...prev,
                { sub, payment, members: [], allPayments: payments },
              ];
            });
            setLoading(false);
          });
          paymentUnsubs.set(sub.id, unsubPayments);

          const unsubMembers = subscribeToMembers(sub.id, (members) => {
            if (cancelled) {
              return;
            }
            setItems((prev) => {
              const existing = prev.findIndex((i) => i.sub.id === sub.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing]!, members };
                return updated;
              }
              return [
                ...prev,
                { sub, payment: null, members, allPayments: [] },
              ];
            });
          });
          memberUnsubs.set(sub.id, unsubMembers);
        }
      },
      (err) => {
        if (cancelled) {
          return;
        }
        const raw = err.message || String(err);
        console.error("subscribeToSubscriptionsForMember", err);
        const indexUrl = extractIndexUrl(raw);
        if (indexUrl) {
          console.error("Firestore index URL:", indexUrl);
        }
        setHasLoadError(true);
        setItems([]);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubSubs();
      clearListeners();
    };
  }, [appUser, cycleId]);

  function changeView(next: PayView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

  function toggleExpanded(subId: string) {
    setExpandedSubId((prev) => (prev === subId ? null : subId));
  }

  function clearPendingProof(subId: string) {
    setPendingProofs((prev) => {
      const next = { ...prev };
      const entry = next[subId];
      if (entry?.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      delete next[subId];
      return next;
    });
  }

  function handleFileSelect(subId: string, file: File | undefined) {
    if (!file) {
      return;
    }
    const mime = file.type || "";
    const isPdf =
      mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!ACCEPTED_PROOF_MIME.has(mime) && !isPdf) {
      setUploadError((prev) => ({
        ...prev,
        [subId]: t("proof.invalidType"),
      }));
      return;
    }

    setUploadError((prev) => {
      const next = { ...prev };
      delete next[subId];
      return next;
    });

    clearPendingProof(subId);
    const previewUrl =
      !isPdf && mime.startsWith("image/") ? URL.createObjectURL(file) : null;
    setPendingProofs((prev) => ({
      ...prev,
      [subId]: { file, previewUrl, isPdf },
    }));
  }

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
      clearPendingProof(sub.id);
    } catch {
      setUploadError((prev) => ({
        ...prev,
        [sub.id]: t("pay.loadError"),
      }));
    } finally {
      setUploading(null);
    }
  }

  const now = new Date();
  const monthLabel = now.toLocaleDateString(dateLocale(locale), {
    month: "long",
    year: "numeric",
  });

  const firstName = appUser?.displayName?.split(" ")[0] ?? "";

  const renderDetails = (item: SubWithPayment) => (
    <PayDetails
      sub={item.sub}
      payment={item.payment}
      members={item.members}
      allPayments={item.allPayments}
      appUserUid={appUser?.uid}
      locale={locale}
      t={t}
      pending={pendingProofs[item.sub.id]}
      isUploading={uploading === item.sub.id}
      uploadError={uploadError[item.sub.id]}
      onFileSelect={(file) => handleFileSelect(item.sub.id, file)}
      onUpload={(file) => void handleUpload(item.sub, file)}
    />
  );

  return (
    <AppPage
      motion
      title={
        firstName ? `${t("pay.greeting")} ${firstName}` : t("pay.title")
      }
      lead={monthLabel}
      data-testid="member-pay-page"
      actions={
        !loading && items.length > 0 ? (
          <div
            className="flex shrink-0 rounded-xl border border-border bg-elevated-muted p-1"
            role="group"
            aria-label={t("pay.title")}
            data-testid="pay-view-toggle"
          >
            <button
              type="button"
              data-testid="pay-view-cards"
              aria-pressed={view === "cards"}
              onClick={() => changeView("cards")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "cards"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              {t("pay.view")}
            </button>
            <button
              type="button"
              data-testid="pay-view-list"
              aria-pressed={view === "list"}
              onClick={() => changeView("list")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                view === "list"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              {t("pay.list")}
            </button>
          </div>
        ) : null
      }
    >
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
      ) : hasLoadError ? (
        <div
          role="alert"
          className="pr-alert-warning rounded-2xl px-5 py-4 text-left text-sm"
        >
          <p className="font-semibold text-foreground">{t("pay.loadError")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="pr-card px-6 py-12 text-center shadow-card">
          {pendingInviteCount > 0 ? (
            <>
              <p className="text-sm font-medium text-foreground">
                {t("pay.invites", { n: pendingInviteCount })}
              </p>
              <p className="mt-2 text-sm text-muted">{t("pay.emptyHint")}</p>
              <Link
                href="/notifications"
                className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-110"
              >
                {t("pay.viewInvites")}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {t("pay.empty")}
              </p>
              <p className="mt-2 text-sm text-muted">{t("pay.emptyHint")}</p>
            </>
          )}
        </div>
      ) : view === "list" ? (
        <div
          className="pr-list-glass"
          data-testid="pay-list"
        >
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const { sub, payment } = item;
              const status = payment?.status ?? "missing";
              const isExpanded = expandedSubId === sub.id;
              const amount = payment?.amount?.toFixed(2) ?? "—";

              return (
                <li key={sub.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid={`pay-row-${sub.id}`}
                    onClick={() => toggleExpanded(sub.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpanded(sub.id);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-elevated-muted/50 sm:px-5"
                  >
                    <ServiceIcon
                      name={sub.name}
                      iconKey={sub.iconKey}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {sub.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {t("pay.youOwe")} ${amount} ·{" "}
                        {t("pay.dueDay", { day: sub.dueDayOfMonth })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(status)}`}
                    >
                      {statusLabel(status, t)}
                    </span>
                    <button
                      type="button"
                      data-testid={`pay-expand-${sub.id}`}
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded ? t("pay.closeDetails") : t("pay.openDetails")
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(sub.id);
                      }}
                      className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-elevated-muted hover:text-foreground"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                  </div>
                  {isExpanded ? (
                    <div className="border-t border-border bg-elevated-muted/30 px-4 py-4 sm:px-5">
                      {renderDetails(item)}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const { sub, payment } = item;
            const status = payment?.status ?? "missing";
            const isExpanded = expandedSubId === sub.id;
            const amount = payment?.amount?.toFixed(2) ?? "—";

            return (
              <div
                key={sub.id}
                className={`pr-tile border-2 ${borderToneClass(status)}`}
              >
                <div className="relative flex items-start gap-3 p-4 sm:p-5">
                  <ServiceIcon
                    name={sub.name}
                    iconKey={sub.iconKey}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold text-foreground">
                      {sub.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {t("pay.youOwe")} ${amount} ·{" "}
                      {t("pay.dueDay", { day: sub.dueDayOfMonth })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(status)}`}
                  >
                    {statusLabel(status, t)}
                  </span>
                </div>

                <div className="border-t border-border px-4 pb-4 sm:px-5 sm:pb-5">
                  <button
                    type="button"
                    data-testid={`pay-expand-${sub.id}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(sub.id)}
                    className="flex w-full items-center justify-between gap-2 py-3 text-left text-xs font-semibold text-muted transition hover:text-foreground"
                  >
                    <span>
                      {isExpanded ? t("pay.closeDetails") : t("pay.openDetails")}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {isExpanded ? renderDetails(item) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}
