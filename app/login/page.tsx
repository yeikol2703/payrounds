"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useAuth, authErrorToMessage } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { acceptInviteJoin } from "@/app/actions/invites";
import { getStoredWorkspaceMode } from "@/lib/workspace-mode";

function LoginPageContent() {
  const { signInWithGoogle, signInWithPassword, registerWithPassword, appUser, loading: authLoading } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  const [authTab, setAuthTab] = useState<"signin" | "register">("signin");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && appUser && !inviteToken) {
      const mode = getStoredWorkspaceMode();
      router.replace(mode === "member" ? "/pay" : "/dashboard");
    }
  }, [appUser, authLoading, inviteToken, router]);

  async function completeInviteIfNeeded() {
    if (!inviteToken) {
      return;
    }
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    const idToken = await user.getIdToken(true);
    const result = await acceptInviteJoin(inviteToken, idToken);
    if (!result.ok) {
      if (result.error === "already_accepted") {
        return;
      }
      throw new Error(result.error);
    }
  }

  function afterAuthRedirect() {
    if (inviteToken) {
      router.replace("/pay");
      return;
    }
    const mode = getStoredWorkspaceMode();
    router.replace(mode === "member" ? "/pay" : "/dashboard");
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      await completeInviteIfNeeded();
      afterAuthRedirect();
    } catch (err) {
      setError(authErrorToMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (signInPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signInWithPassword(signInEmail, signInPassword);
      await completeInviteIfNeeded();
      afterAuthRedirect();
    } catch (err) {
      setError(authErrorToMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (regPassword !== regConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!regName.trim()) {
      setError("Enter your name.");
      return;
    }
    setLoading(true);
    try {
      await registerWithPassword(regEmail, regPassword, regName.trim());
      await completeInviteIfNeeded();
      afterAuthRedirect();
    } catch (err) {
      setError(authErrorToMessage(err));
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
            One account for owning plans and joining friends&apos; shares.
          </p>
        </div>

        <div className="pr-card space-y-6 p-6 sm:p-8" data-testid="login-card">
          {inviteToken ? (
            <p className="rounded-lg border border-accent/25 bg-accent-muted px-3 py-2 text-xs font-medium text-accent dark:text-blue-100">
              After you sign in, we&apos;ll finish joining the subscription from
              your invite.
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            data-testid="login-google"
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center px-2">
              <span className="bg-elevated px-2 text-xs font-medium text-subtle">
                or email
              </span>
            </div>
          </div>

          <div
            className="flex rounded-xl border border-border bg-elevated-muted p-1"
            role="tablist"
            aria-label="Email account"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authTab === "signin"}
              data-testid="login-tab-signin"
              onClick={() => {
                setAuthTab("signin");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                authTab === "signin"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === "register"}
              data-testid="login-tab-register"
              onClick={() => {
                setAuthTab("register");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                authTab === "register"
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          {authTab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-3" data-testid="login-signin-form">
              <div>
                <label htmlFor="signin-email" className="pr-label">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  className="pr-input"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label htmlFor="signin-password" className="pr-label">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="pr-input"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-signin"
                className="pr-btn-primary w-full"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3" data-testid="login-register-form">
              <div>
                <label htmlFor="reg-name" className="pr-label">
                  Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="pr-input"
                  placeholder="Alex"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="pr-label">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="pr-input"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="pr-label">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="pr-input"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label htmlFor="reg-confirm" className="pr-label">
                  Confirm password
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  className="pr-input"
                  placeholder="Repeat password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-register"
                className="pr-btn-primary w-full"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}

          {error ? (
            <p
              role="alert"
              data-testid="login-error"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          After signing in, use the <strong>Admin</strong> tab for subscriptions
          you own and the <strong>Member</strong> tab for ones you joined.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page p-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
            aria-hidden
          />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
