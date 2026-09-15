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
import { CopyLinkButton } from "@/components/ui/copy-link-button";

interface FriendInput {
  /** Stable React key — must not depend on `email` or the input remounts every keystroke. */
  rowId: string;
  email: string;
  uid?: string;
  displayName?: string;
  found?: boolean;
  error?: string;
}

function createFriendRow(): FriendInput {
  const rowId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `friend-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { rowId, email: "" };
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

function formatBillingDayPhrase(day: number): string {
  return `the ${day}${ordinalSuffix(day)} of each month`;
}

function Steps({ current }: { current: number }) {
  const steps =
    current >= 3
      ? (["Details", "Friends", "Review", "Share links"] as const)
      : (["Details", "Friends", "Review"] as const);
  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-1 md:gap-x-0">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex shrink-0 items-center">
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

  const [friends, setFriends] = useState<FriendInput[]>(() => [
    createFriendRow(),
  ]);

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
      error: undefined,
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
          error: "Registered — they'll accept from Notifications",
        };
      } else {
        updated[index] = {
          rowId,
          email,
          found: false,
          error: "Not registered yet — they'll get an invite link",
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
              error: "Could not look up this email — they'll get an invite link",
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
            error:
              "Not registered yet — they'll get an invite email to join Payround",
          };
        } catch {
          return {
            ...f,
            email,
            found: false as const,
            error: "Could not look up this email — they'll get an invite link",
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
          throw new Error(
            "Could not verify your session to email invites. Try again after re-login.",
          );
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
          const { token, emailSent, emailFailureReason } = await sendInvite(
            idToken,
            email,
            subId,
            name.trim(),
            appUser.displayName,
            appUser.uid,
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
                  ? "In-app invite sent; email was not delivered."
                  : "Email was not delivered."),
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
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const memberCount = friends.filter((f) => f.email.trim()).length;
  const inviteEmailCount = friends.filter((f) =>
    f.email.trim().toLowerCase().includes("@"),
  ).length;
  const perPerson =
    memberCount > 0 && parseFloat(totalCost) > 0
      ? (parseFloat(totalCost) / (memberCount + 1)).toFixed(2)
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={() =>
          step === 0
            ? router.back()
            : step === 3
              ? router.push("/dashboard")
              : setStep(step - 1)
        }
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
        {step === 0 ? "Back to dashboard" : step === 3 ? "Dashboard" : "Back"}
      </button>

      <h1 className="pr-page-title mb-2">New subscription</h1>
      <p className="pr-section-lead mb-8">
        Set the plan, add friends, then open the first payment cycle.
      </p>

      <Steps current={step} />

      {step === 0 ? (
        <div className="pr-card w-full space-y-6 p-4 sm:p-6 md:p-8">
          <div>
            <label htmlFor="sub-name" className="pr-label">
              Service name
            </label>
            <input
              id="sub-name"
              type="text"
              placeholder="Netflix, Spotify, Disney+…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pr-input"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="sub-cost" className="pr-label">
                Total monthly cost (USD)
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
                Billing date (day of the month)
              </label>
              <p className="mb-2 text-xs text-muted">
                Which calendar day is the bill due each month? (1–{BILLING_DAY_MAX}{" "}
                only.)
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
            Continue
          </button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="pr-card w-full space-y-5 p-4 sm:p-6 md:p-8">
          <p className="text-sm leading-relaxed text-muted">
            Add emails for people who split the bill. Anyone with a Payround
            account is added to the group immediately; every friend with an email
            also gets an invite link so they can open the subscription from their
            inbox (new users can sign up from that link).
          </p>

          <div className="space-y-3">
            {friends.map((f, i) => (
              <div key={f.rowId}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <input
                    type="email"
                    placeholder="friend@email.com"
                    value={f.email}
                    onChange={(e) => lookupFriend(i, e.target.value)}
                    className="pr-input w-full min-w-0 flex-1"
                  />
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
                      aria-label="Remove row"
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
                {f.found === false && f.error ? (
                  <p className="ml-1 mt-1.5 text-xs text-amber-800 dark:text-amber-200">
                    {f.error}
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
            Add another friend
          </button>

          {perPerson ? (
            <div className="rounded-xl border border-accent/20 bg-accent-muted px-4 py-3 text-sm text-accent dark:text-blue-100">
              Each friend owes <strong>${perPerson}/month</strong> ·{" "}
              {memberCount} friend{memberCount > 1 ? "s" : ""} + you
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setStep(2)}
            className="pr-btn-primary w-full"
          >
            Continue to review
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div className="pr-card w-full p-4 sm:p-6 md:p-8">
            <h2 className="mb-5 text-sm font-semibold text-foreground">
              Summary
            </h2>
            <div className="space-y-1 text-sm">
              {[
                { label: "Service", value: name },
                {
                  label: "Total cost",
                  value: `$${parseFloat(totalCost || "0").toFixed(2)} / month`,
                },
                {
                  label: "Billing day",
                  value: formatBillingDayPhrase(dueDayOfMonth),
                },
                {
                  label: "Friends",
                  value: `${friends.filter((f) => f.email).length} invited`,
                },
                {
                  label: "Each friend pays",
                  value: perPerson ? `$${perPerson} / month` : "—",
                },
                { label: "First cycle", value: toCycleId(new Date()) },
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
            <p>✓ A new payment cycle opens for the current month.</p>
            <p>✓ Registered friends receive an in-app notification.</p>
            <p>✓ You can manage this subscription from the dashboard.</p>
            {inviteEmailCount > 0 ? (
              <p className="pt-1 text-sm font-semibold text-foreground">
                {inviteEmailCount} friend
                {inviteEmailCount !== 1 ? "s" : ""} will receive an invite email
                (including anyone already on Payround).
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
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
                Creating…
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
                Launch tracker
              </>
            )}
          </button>
        </div>
      ) : null}

      {step === 3 && manualInviteLinks && manualInviteLinks.length > 0 ? (
        <div className="space-y-5">
          <div className="pr-card w-full p-4 shadow-card sm:p-6 md:p-8">
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Share invites
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted">
              Your subscription is live. Friends with an account get an in-app
              invite; everyone can also use the link below (WhatsApp or copy).
            </p>
            <ul className="space-y-4">
              {manualInviteLinks.map(
                ({ email, url, emailFailureReason, inAppNotified }) => {
                  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
                    `You're invited to split ${name.trim()} on Payround: ${url}`,
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
                          In-app notification sent — they must Accept in
                          Notifications before joining.
                        </p>
                      ) : null}
                      {emailFailureReason ? (
                        <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100">
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
                        Share on WhatsApp
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
            Continue to dashboard
          </button>
        </div>
      ) : null}
    </div>
  );
}
