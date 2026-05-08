"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { getInvitePublic, type InvitePublicPayload } from "@/app/actions/invites";

type PageProps = { params: Promise<{ token: string }> };

export default function InviteByTokenPage({ params }: PageProps) {
  const { token } = use(params);
  const { sendMagicLink } = useAuth();
  const [invite, setInvite] = useState<InvitePublicPayload | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (invite?.status === "valid" && invite.invitedEmail) {
      setEmail(invite.invitedEmail);
    }
  }, [invite]);

  useEffect(() => {
    let cancelled = false;
    getInvitePublic(token).then((data) => {
      if (!cancelled) {
        setInvite(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return;
    }
    setFormError("");
    setSending(true);
    try {
      const base =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const redirectUrl = `${base}/invite/${encodeURIComponent(token)}/confirm`;
      await sendMagicLink(trimmed, redirectUrl);
      setSent(true);
    } catch {
      setFormError("Could not send the sign-in link. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
        <p className="text-sm text-muted">Loading invite…</p>
      </div>
    );
  }

  if (invite.status === "not_found" || invite.status === "expired") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-page p-4">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <div className="pr-card w-full max-w-md p-10 text-center shadow-card">
          <h1 className="text-lg font-semibold text-foreground">
            This invite link is invalid or has expired
          </h1>
          <p className="mt-2 text-sm text-muted">
            Ask the subscription owner for a new invite.
          </p>
          <Link href="/login" className="mt-8 inline-flex pr-btn-primary no-underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (invite.status === "accepted") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-page p-4">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <div className="pr-card w-full max-w-md p-10 text-center shadow-card">
          <h1 className="text-lg font-semibold text-foreground">
            You already accepted this invite
          </h1>
          <p className="mt-2 text-sm text-muted">Go to login to open your account.</p>
          <Link href="/login" className="mt-8 inline-flex pr-btn-primary no-underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-page p-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/25">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="pr-page-title">You&apos;re invited</h1>
          <p className="pr-section-lead">
            Join <strong className="text-foreground">{invite.subName}</strong> on Payround
          </p>
        </div>

        <div className="pr-card space-y-6 p-8 shadow-card">
          <div className="rounded-xl border border-border bg-elevated-muted px-4 py-3 text-sm text-muted">
            <p>
              <span className="font-semibold text-foreground">
                {invite.ownerDisplayName}
              </span>{" "}
              invited{" "}
              <span className="font-medium text-foreground">
                {invite.invitedEmail}
              </span>
            </p>
          </div>

          {sent ? (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center"
            >
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Check your email
              </p>
              <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                We sent a sign-in link to <strong>{email.trim()}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted">
                Enter the email address you were invited with. We&apos;ll send a
                secure link to sign in and join the group.
              </p>
              <div>
                <label htmlFor="invite-email" className="pr-label">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-input"
                  placeholder={invite.invitedEmail}
                />
              </div>
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="pr-btn-primary w-full"
              >
                {sending ? "Sending…" : "Email me a sign-in link"}
              </button>
              {formError ? (
                <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
                  {formError}
                </p>
              ) : null}
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Link expires 72 hours after it was sent.
        </p>
      </div>
    </div>
  );
}
