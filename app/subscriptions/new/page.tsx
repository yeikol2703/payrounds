"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { sendInvite } from "@/app/actions/invites";
import {
  createSubscription,
  addMember,
  getMembers,
} from "@/lib/firestore/subscriptions";
import { openCycle, toCycleId } from "@/lib/firestore/cycles";
import { createNotification } from "@/lib/firestore/notifications";
import { getAppUserByEmail } from "@/lib/firestore/users";

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
const BILLING_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

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
  const steps = ["Details", "Friends", "Review"];
  return (
    <div className="mb-10 flex flex-wrap items-center gap-y-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-2.5">
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
                className={`text-sm ${active ? "font-semibold text-foreground" : "text-muted"}`}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={`mx-3 hidden h-px w-10 sm:block ${done ? "bg-emerald-400/80" : "bg-border"}`}
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
      const user = await getAppUserByEmail(email);
      if (user) {
        updated[index] = {
          rowId,
          email,
          uid: user.uid,
          displayName: user.displayName,
          found: true,
        };
      } else {
        updated[index] = {
          rowId,
          email,
          found: false,
          error: "Not registered yet — they'll get an invite email",
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

  async function handleCreate() {
    if (!appUser) {
      return;
    }
    setSaving(true);
    setError("");

    try {
      const subId = await createSubscription({
        ownerId: appUser.uid,
        name: name.trim(),
        totalCost: parseFloat(totalCost),
        dueDayOfMonth,
      });

      const registeredFriends = friends.filter((f) => f.uid && f.found);
      for (const f of registeredFriends) {
        await addMember(subId, {
          uid: f.uid!,
          email: f.email,
          displayName: f.displayName!,
        });
      }

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

      const members = await getMembers(subId);
      await openCycle(
        subId,
        cycleId,
        dueDate,
        members.map((m) => ({ uid: m.uid, amountOwed: m.amountOwed })),
      );

      for (const f of registeredFriends) {
        await createNotification({
          recipientUid: f.uid!,
          type: "cycle_closed",
          subId,
          subName: name.trim(),
          cycleId,
          fromUid: appUser.uid,
          fromDisplayName: appUser.displayName,
        });
      }

      const unregisteredWithEmail = friends.filter(
        (f) => f.email.trim() && f.found === false,
      );
      if (unregisteredWithEmail.length > 0) {
        const idToken = await getAuth().currentUser?.getIdToken(true);
        if (!idToken) {
          throw new Error(
            "Could not verify your session to email invites. Try again after re-login.",
          );
        }
        for (const f of unregisteredWithEmail) {
          await sendInvite(
            idToken,
            f.email.trim(),
            subId,
            name.trim(),
            appUser.displayName,
            appUser.uid,
          );
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
  const inviteEmailCount = friends.filter(
    (f) => f.email.trim() && f.found === false,
  ).length;
  const perPerson =
    memberCount > 0 && parseFloat(totalCost) > 0
      ? (parseFloat(totalCost) / (memberCount + 1)).toFixed(2)
      : null;

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <button
        type="button"
        onClick={() => (step === 0 ? router.back() : setStep(step - 1))}
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
        {step === 0 ? "Back to dashboard" : "Back"}
      </button>

      <h1 className="pr-page-title mb-2">New subscription</h1>
      <p className="pr-section-lead mb-8">
        Set the plan, add friends, then open the first payment cycle.
      </p>

      <Steps current={step} />

      {step === 0 ? (
        <div className="pr-card space-y-6 p-6 sm:p-8">
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
              <label
                htmlFor="billing-day-of-month"
                className="pr-label"
              >
                Billing date (day of the month)
              </label>
              <p className="mb-2 text-xs text-muted">
                Which calendar day is the bill due each month? (1–28 only.)
              </p>
              <select
                id="billing-day-of-month"
                value={dueDayOfMonth}
                onChange={(e) =>
                  setDueDayOfMonth(parseInt(e.target.value, 10))
                }
                className="pr-input"
              >
                {BILLING_DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {ordinalSuffix(d)} of each month
                  </option>
                ))}
              </select>
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
        <div className="pr-card space-y-5 p-6 sm:p-8">
          <p className="text-sm leading-relaxed text-muted">
            Add emails for people who split the bill. If they already use
            Payround, we&apos;ll add them now. If not, they&apos;ll get an
            invite link by email after you launch.
          </p>

          <div className="space-y-3">
            {friends.map((f, i) => (
              <div key={f.rowId}>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="friend@email.com"
                    value={f.email}
                    onChange={(e) => lookupFriend(i, e.target.value)}
                    className="pr-input flex-1"
                  />
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
          <div className="pr-card p-6 sm:p-8">
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
            <p>✓ Registered friends receive a notification.</p>
            <p>✓ You can manage this subscription from the dashboard.</p>
            {inviteEmailCount > 0 ? (
              <p className="pt-1 text-sm font-semibold text-foreground">
                {inviteEmailCount} friend
                {inviteEmailCount !== 1 ? "s" : ""} will receive an invite email.
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
    </div>
  );
}
