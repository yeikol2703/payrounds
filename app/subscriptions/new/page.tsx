"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { sendInvite } from "@/app/actions/invites";
import { findUserByEmail } from "@/app/actions/users";
import { createSubscription } from "@/lib/firestore/subscriptions";
import { openCycle, toCycleId } from "@/lib/firestore/cycles";
import { createNotification } from "@/lib/firestore/notifications";
import { DayOfMonthPicker } from "@/components/day-of-month-picker";
import { AppPage } from "@/components/app-page";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { ServiceIconPicker } from "@/components/subscription/service-icon-picker";
import { equalShare, customAmountsSumOk } from "@/lib/split";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { SplitMode } from "@/lib/types";

interface FriendInput {
  /** Stable React key — must not depend on `email` or the input remounts every keystroke. */
  rowId: string;
  email: string;
  uid?: string;
  displayName?: string;
  found?: boolean;
  /** Message key for lookup status (translated at render). */
  errorKey?: MessageKey;
  /** Custom split amount (USD string). */
  amount?: string;
}

function createFriendRow(): FriendInput {
  const rowId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `friend-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { rowId, email: "", amount: "" };
}

/** Calendar day-of-month options (1–28; cap avoids Feb edge cases). */
const BILLING_DAY_MAX = 28;

function ordinalSuffix(n: number): string {
  const d = Math.abs(n) % 100;
  if (d >= 11 && d <= 13) {
    return "th";
  }
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function Steps({ current }: { current: number }) {
  const { t } = useI18n();
  const steps =
    current >= 3
      ? ([
          t("newSub.step.details"),
          t("newSub.step.friends"),
          t("newSub.step.review"),
          t("newSub.step.share"),
        ] as const)
      : ([
          t("newSub.step.details"),
          t("newSub.step.friends"),
          t("newSub.step.review"),
        ] as const);
  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-1 md:gap-x-0">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={`${s}-${i}`} className="flex shrink-0 items-center">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                  done
                    ? "bg-emerald-500 text-white shadow-sm"
                    : active
                      ? "bg-accent text-accent-foreground shadow-md shadow-accent/25"
                      : "bg-elevated-muted text-subtle ring-1 ring-border"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`max-w-[9rem] text-xs leading-tight sm:max-w-none sm:text-sm ${active ? "font-semibold text-foreground" : "text-muted"}`}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={`mx-2 hidden h-px w-6 shrink-0 sm:mx-3 sm:w-10 md:block ${done ? "bg-emerald-400/80" : "bg-border"}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function NewSubscriptionPage() {
  const { appUser } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();

  const [manualInviteLinks, setManualInviteLinks] = useState<
    {
      email: string;
      url: string;
      emailFailureReason?: string;
      inAppNotified?: boolean;
    }[] | null
  >(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [totalCost, setTotalCost] = useState("");
  /** Day of the calendar month (1–28) when payment is due each month. */
  const [dueDayOfMonth, setDueDayOfMonth] = useState(15);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [ownerAmount, setOwnerAmount] = useState("");
  /** null = auto-detect from name; "default" or Simple Icons slug = manual. */
  const [iconKey, setIconKey] = useState<string | null>(null);

  const [friends, setFriends] = useState<FriendInput[]>(() => [
    createFriendRow(),
  ]);

  function formatBillingDayPhrase(day: number): string {
    const dayLabel =
      locale === "en" ? `${day}${ordinalSuffix(day)}` : String(day);
    return t("newSub.billingDayPhrase", { day: dayLabel });
  }

  function step1Valid() {
    return (
      name.trim() &&
      parseFloat(totalCost) > 0 &&
      dueDayOfMonth >= 1 &&
      dueDayOfMonth <= 28
    );
  }

  async function lookupFriend(index: number, email: string) {
    const rowId = friends[index]!.rowId;
    const updated = [...friends];
    updated[index] = {
      rowId,
      email,
      uid: undefined,
      displayName: undefined,
      found: undefined,
      errorKey: undefined,
    };
    setFriends(updated);
    if (!email.includes("@")) {
      return;
    }

    try {
      const idToken = await getAuth().currentUser?.getIdToken(true);
      if (!idToken) {
        return;
      }
      const user = await findUserByEmail(idToken, email);
      if (user) {
        updated[index] = {
          rowId,
          email,
          uid: user.uid,
          displayName: user.displayName,
          found: true,
          errorKey: "newSub.lookup.registered",
        };
      } else {
        updated[index] = {
          rowId,
          email,
          found: false,
          errorKey: "newSub.lookup.notRegistered",
        };
      }
      setFriends([...updated]);
    } catch {
      // ignore lookup errors
    }
  }

  function addFriendRow() {
    setFriends([...friends, createFriendRow()]);
  }

  function removeFriendRow(i: number) {
    setFriends(friends.filter((_, idx) => idx !== i));
  }

  /**
   * Re-run email lookup at create time so invites and addMember work even if the
   * owner never triggered blur lookup (`found` was still undefined).
   */
  async function resolveFriendEmailsForCreate(
    rows: FriendInput[],
  ): Promise<FriendInput[]> {
    return Promise.all(
      rows.map(async (f) => {
        const email = f.email.trim();
        if (!email.includes("@")) {
          return f;
        }
        if (f.uid) {
          return { ...f, email, found: true as const };
        }
        try {
          const idToken = await getAuth().currentUser?.getIdToken(true);
          if (!idToken) {
            return {
              ...f,
              email,
              found: false as const,
              errorKey: "newSub.lookup.couldNot" as const,
            };
          }
          const user = await findUserByEmail(idToken, email);
          if (user) {
            return {
              ...f,
              email,
              uid: user.uid,
              displayName: user.displayName,
              found: true as const,
            };
          }
          return {
            ...f,
            email,
            found: false as const,
            errorKey: "newSub.lookup.notRegisteredInvite" as const,
          };
        } catch {
          return {
            ...f,
            email,
            found: false as const,
            errorKey: "newSub.lookup.couldNot" as const,
          };
        }
      }),
    );
  }

  async function handleCreate() {
    if (!appUser) {
      return;
    }
    setSaving(true);
    setError("");
    setManualInviteLinks(null);

    try {
      const resolved = await resolveFriendEmailsForCreate(friends);

      const subId = await createSubscription({
        ownerId: appUser.uid,
        name: name.trim(),
        totalCost: parseFloat(totalCost),
        dueDayOfMonth,
        splitMode,
        iconKey,
      });

      const now = new Date();
      const cycleId = toCycleId(now);
      const dueDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        dueDayOfMonth,
      );
      if (dueDate < now) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      // Cycle starts with owner only; members appear after they accept invites.
      await openCycle(subId, cycleId, dueDate, []);

      const ownerEmail = appUser.email?.trim().toLowerCase() ?? "";
      const inviteEmails = resolved
        .map((f) => f.email.trim().toLowerCase())
        .filter((email) => email.includes("@") && email !== ownerEmail);
      const uniqueInviteEmails = [...new Set(inviteEmails)];

      if (uniqueInviteEmails.length > 0) {
        const idToken = await getAuth().currentUser?.getIdToken(true);
        if (!idToken) {
          throw new Error(t("newSub.sessionError"));
        }
        const appBase =
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
          (typeof window !== "undefined" ? window.location.origin : "") ||
          "http://localhost:3000";

        const manual: {
          email: string;
          url: string;
          emailFailureReason?: string;
          inAppNotified?: boolean;
        }[] = [];
        for (const email of uniqueInviteEmails) {
          const friendRow = resolved.find(
            (f) => f.email.trim().toLowerCase() === email,
          );
          const customAmt =
            splitMode === "custom"
              ? parseFloat(friendRow?.amount || "0")
              : undefined;
          const { token, emailSent, emailFailureReason } = await sendInvite(
            idToken,
            email,
            subId,
            name.trim(),
            appUser.displayName,
            appUser.uid,
            splitMode === "custom" && customAmt && customAmt > 0
              ? { amountOwed: customAmt }
              : undefined,
          );
          const url = `${appBase}/invite/${token}`;

          const registered = resolved.find(
            (f) => f.email.trim().toLowerCase() === email && f.uid,
          );
          if (registered?.uid) {
            try {
              await createNotification({
                recipientUid: registered.uid,
                type: "membership_invite",
                subId,
                subName: name.trim(),
                cycleId,
                fromUid: appUser.uid,
                fromDisplayName: appUser.displayName,
                inviteToken: token,
              });
            } catch (notifErr) {
              console.warn("membership_invite notification failed", notifErr);
            }
          }

          manual.push({
            email,
            url,
            inAppNotified: Boolean(registered?.uid),
            emailFailureReason: emailSent
              ? undefined
              : emailFailureReason ??
                (registered?.uid
                  ? t("newSub.emailFail.inApp")
                  : t("newSub.emailFail.generic")),
          });
        }
        if (manual.length > 0) {
          setManualInviteLinks(manual);
          setStep(3);
          return;
        }
      }

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("newSub.genericError"));
    } finally {
      setSaving(false);
    }
  }

  const memberCount = friends.filter((f) => f.email.trim()).length;
  const inviteEmailCount = friends.filter((f) =>
    f.email.trim().toLowerCase().includes("@"),
  ).length;
  const costNum = parseFloat(totalCost) || 0;
  const equalPer =
    costNum > 0 ? equalShare(costNum, memberCount).toFixed(2) : "";
  const customFriendAmounts = friends
    .filter((f) => f.email.trim())
    .map((f) => parseFloat(f.amount || "0") || 0);
  const ownerAmtNum = parseFloat(ownerAmount || "0") || 0;
  const customSumOk =
    splitMode !== "custom" ||
    (costNum > 0 &&
      customAmountsSumOk([...customFriendAmounts, ownerAmtNum], costNum));
  const perPerson = splitMode === "equal" && equalPer ? equalPer : null;

  return (
    <AppPage
      width="2xl"
      title={t("newSub.title")}
      lead={t("newSub.lead")}
      beforeHeader={
        <button
          type="button"
          onClick={() =>
            step === 0
              ? router.back()
              : step === 3
                ? router.push("/dashboard")
                : setStep(step - 1)
          }
          className="pr-link-back mb-6"
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
          {step === 0
            ? t("newSub.backDashboard")
            : step === 3
              ? t("newSub.dashboard")
              : t("newSub.back")}
        </button>
      }
    >
      <Steps current={step} />

      {step === 0 ? (
        <div className="pr-card w-full space-y-6 p-4 sm:p-6 md:p-8">
          <div>
            <label htmlFor="sub-name" className="pr-label">
              {t("newSub.serviceName")}
            </label>
            <input
              id="sub-name"
              type="text"
              placeholder={t("newSub.servicePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pr-input"
            />
          </div>
          <ServiceIconPicker
            name={name}
            value={iconKey}
            onChange={setIconKey}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="sub-cost" className="pr-label">
                {t("newSub.totalCost")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                  $
                </span>
                <input
                  id="sub-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="15.99"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  className="pr-input pl-7"
                />
              </div>
            </div>
            <div>
              <label htmlFor="billing-day-of-month" className="pr-label">
                {t("newSub.billingDate")}
              </label>
              <p className="mb-2 text-xs text-muted">
                {t("newSub.billingHint", { max: BILLING_DAY_MAX })}
              </p>
              <DayOfMonthPicker
                id="billing-day-of-month"
                value={dueDayOfMonth}
                onChange={setDueDayOfMonth}
                max={BILLING_DAY_MAX}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!step1Valid()}
            onClick={() => setStep(1)}
            className="pr-btn-primary w-full"
          >
            {t("newSub.continue")}
          </button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="pr-card w-full space-y-5 p-4 sm:p-6 md:p-8">
          <p className="text-sm leading-relaxed text-muted">
            {t("newSub.friendsLead")}
          </p>

          <div
            className="flex rounded-xl border border-border bg-elevated-muted p-1"
            role="group"
            aria-label={t("newSub.splitMode")}
            data-testid="split-mode-toggle"
          >
            <button
              type="button"
              data-testid="split-mode-equal"
              aria-pressed={splitMode === "equal"}
              onClick={() => setSplitMode("equal")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                splitMode === "equal"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("newSub.equalSplit")}
            </button>
            <button
              type="button"
              data-testid="split-mode-custom"
              aria-pressed={splitMode === "custom"}
              onClick={() => {
                setSplitMode("custom");
                if (!ownerAmount && equalPer) {
                  setOwnerAmount(equalPer);
                }
                setFriends((prev) =>
                  prev.map((f) => ({
                    ...f,
                    amount: f.amount || equalPer || "",
                  })),
                );
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                splitMode === "custom"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("newSub.customAmounts")}
            </button>
          </div>

          {splitMode === "custom" ? (
            <div className="rounded-xl border border-border bg-elevated-muted/50 px-3 py-3">
              <label htmlFor="owner-share" className="pr-label">
                {t("newSub.yourShare")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                  $
                </span>
                <input
                  id="owner-share"
                  data-testid="split-owner-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ownerAmount}
                  onChange={(e) => setOwnerAmount(e.target.value)}
                  className="pr-input pl-7"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {friends.map((f, i) => (
              <div key={f.rowId}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <input
                    type="email"
                    placeholder={t("newSub.friendEmailPlaceholder")}
                    value={f.email}
                    onChange={(e) => lookupFriend(i, e.target.value)}
                    className="pr-input w-full min-w-0 flex-1"
                  />
                  {splitMode === "custom" ? (
                    <div className="relative w-full shrink-0 md:w-28">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid={`split-friend-amount-${i}`}
                        placeholder="0.00"
                        value={f.amount ?? ""}
                        onChange={(e) => {
                          const next = [...friends];
                          next[i] = { ...f, amount: e.target.value };
                          setFriends(next);
                        }}
                        className="pr-input pl-7"
                      />
                    </div>
                  ) : null}
                  <div className="flex shrink-0 items-center justify-end gap-2 md:justify-start">
                    {f.found ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                        {f.displayName?.charAt(0).toUpperCase()}
                      </div>
                    ) : null}
                    {friends.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeFriendRow(i)}
                        className="rounded-lg p-2 text-subtle transition hover:bg-red-500/10 hover:text-red-600"
                        aria-label={t("newSub.removeRow")}
                      >
                        <svg
                          width="16"
                          height="16"
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
                    ) : null}
                  </div>
                </div>
                {f.found ? (
                  <p className="ml-1 mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ {f.displayName}
                  </p>
                ) : null}
                {f.found === false && f.errorKey ? (
                  <p className="pr-alert-warning ml-1 mt-1.5 rounded-md px-2 py-1 text-xs font-medium">
                    {t(f.errorKey)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addFriendRow}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:brightness-110"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("newSub.addFriend")}
          </button>

          {splitMode === "equal" && perPerson ? (
            <div className="rounded-xl border border-accent/20 bg-accent-muted px-4 py-3 text-sm text-accent dark:text-blue-100">
              {t("newSub.eachOwes", { amount: perPerson, n: memberCount })}
            </div>
          ) : null}
          {splitMode === "custom" ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                customSumOk
                  ? "border-accent/20 bg-accent-muted text-accent dark:text-blue-100"
                  : "pr-alert-danger"
              }`}
              data-testid="split-sum-status"
            >
              {customSumOk
                ? t("newSub.customSumOk", { amount: costNum.toFixed(2) })
                : t("newSub.customSumBad", { amount: costNum.toFixed(2) })}
            </div>
          ) : null}

          <button
            type="button"
            disabled={splitMode === "custom" && !customSumOk}
            onClick={() => setStep(2)}
            className="pr-btn-primary w-full disabled:opacity-50"
          >
            {t("newSub.continueReview")}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div className="pr-card w-full p-4 sm:p-6 md:p-8">
            <h2 className="mb-5 text-sm font-semibold text-foreground">
              {t("newSub.summary")}
            </h2>
            <div className="space-y-1 text-sm">
              {[
                { label: t("newSub.label.service"), value: name },
                {
                  label: t("newSub.label.totalCost"),
                  value: t("newSub.perMonth", {
                    amount: parseFloat(totalCost || "0").toFixed(2),
                  }),
                },
                {
                  label: t("newSub.label.billingDay"),
                  value: formatBillingDayPhrase(dueDayOfMonth),
                },
                {
                  label: t("newSub.label.split"),
                  value:
                    splitMode === "custom"
                      ? t("newSub.customAmounts")
                      : t("newSub.equalSplit"),
                },
                {
                  label: t("newSub.label.friends"),
                  value: t("newSub.friendsInvited", {
                    n: friends.filter((f) => f.email).length,
                  }),
                },
                {
                  label:
                    splitMode === "custom"
                      ? t("newSub.label.yourShare")
                      : t("newSub.label.eachPays"),
                  value:
                    splitMode === "custom"
                      ? t("newSub.perMonth", {
                          amount: ownerAmtNum.toFixed(2),
                        })
                      : perPerson
                        ? t("newSub.perMonth", { amount: perPerson })
                        : "—",
                },
                {
                  label: t("newSub.label.firstCycle"),
                  value: toCycleId(new Date()),
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
                >
                  <span className="text-muted">{row.label}</span>
                  <span className="text-right font-medium text-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-accent/25 bg-accent-muted px-4 py-4 text-xs font-medium leading-relaxed text-accent dark:text-blue-100">
            <p>{t("newSub.bullet.cycle")}</p>
            <p>{t("newSub.bullet.registered")}</p>
            <p>{t("newSub.bullet.manage")}</p>
            {inviteEmailCount > 0 ? (
              <p className="pt-1 text-sm font-semibold text-foreground">
                {t("newSub.inviteCount", { n: inviteEmailCount })}
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="pr-alert-danger rounded-lg px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="pr-btn-primary flex w-full py-3.5 text-base disabled:opacity-50"
          >
            {saving ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground"
                  aria-hidden
                />
                {t("newSub.creating")}
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22 11 13 2 9l20-7z" />
                </svg>
                {t("newSub.launch")}
              </>
            )}
          </button>
        </div>
      ) : null}

      {step === 3 && manualInviteLinks && manualInviteLinks.length > 0 ? (
        <div className="space-y-5">
          <div className="pr-card w-full p-4 shadow-card sm:p-6 md:p-8">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {t("newSub.shareTitle")}
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted">
              {t("newSub.shareLead")}
            </p>
            <ul className="space-y-4">
              {manualInviteLinks.map(
                ({ email, url, emailFailureReason, inAppNotified }) => {
                  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
                    t("newSub.whatsappMsg", {
                      name: name.trim(),
                      url,
                    }),
                  )}`;
                  return (
                    <li
                      key={email}
                      className="rounded-xl border border-border bg-elevated-muted/40 p-4"
                    >
                      <p className="mb-2 text-xs font-medium text-muted">
                        {email}
                      </p>
                      {inAppNotified ? (
                        <p className="mb-3 text-xs text-emerald-800 dark:text-emerald-200">
                          {t("newSub.inAppSent")}
                        </p>
                      ) : null}
                      {emailFailureReason ? (
                        <p className="pr-alert-warning mb-3 rounded-lg px-2.5 py-2 text-xs">
                          {emailFailureReason}
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <code className="flex-1 break-all rounded-lg bg-elevated px-3 py-2 text-xs text-foreground">
                          {url}
                        </code>
                        <CopyLinkButton text={url} />
                      </div>
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-500/20 dark:text-emerald-200"
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
                        {t("newSub.shareWhatsApp")}
                      </a>
                    </li>
                  );
                },
              )}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="pr-btn-primary w-full py-3.5"
          >
            {t("newSub.continueDashboard")}
          </button>
        </div>
      ) : null}
    </AppPage>
  );
}
