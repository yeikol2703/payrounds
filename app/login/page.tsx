"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const { signInWithGoogle, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("Google sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      const base =
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const redirectUrl = `${base.replace(/\/$/, "")}/invite/confirm`;
      await sendMagicLink(email, redirectUrl);
      setSent(true);
    } catch {
      setError("Could not send link. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-page p-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/25">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="pr-page-title">Payround</h1>
          <p className="pr-section-lead">
            Split subscription costs and confirm payments in one place.
          </p>
        </div>

        <div className="pr-card space-y-8 p-8">
          <div>
            <p className="pr-kicker mb-3">Owner login</p>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="pr-btn-secondary w-full border-border-strong font-semibold"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center px-2">
              <span className="bg-elevated px-2 text-xs font-medium text-subtle">
                or
              </span>
            </div>
          </div>

          <div>
            <p className="pr-kicker mb-3">Friend / member login</p>

            {sent ? (
              <div
                role="status"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center"
              >
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Check your email
                </p>
                <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  We sent a sign-in link to <strong>{email}</strong>
                </p>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <label htmlFor="member-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="member-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pr-input"
                />
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="pr-btn-primary w-full"
                >
                  Send sign-in link
                </button>
              </form>
            )}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Not a member yet? Ask the owner to invite you.
        </p>
      </div>
    </div>
  );
}
