"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useAuth, authErrorToMessage } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getInvitePublic,
  acceptInviteJoin,
  type InvitePublicPayload,
} from "@/app/actions/invites";
import { setStoredWorkspaceMode } from "@/lib/workspace-mode";

type PageProps = { params: Promise<{ token: string }> };

export default function InviteByTokenPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
  const {
    registerWithPassword,
    signInWithGoogle,
    appUser,
    loading: authLoading,
  } = useAuth();
  const [invite, setInvite] = useState<InvitePublicPayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showEmailInUseCta, setShowEmailInUseCta] = useState(false);

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

  async function joinWithCurrentSession() {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("Not signed in.");
    }
    const idToken = await user.getIdToken(true);
    const result = await acceptInviteJoin(token, idToken);
    if (!result.ok) {
      if (result.error === "already_accepted") {
        setStoredWorkspaceMode("member");
        router.replace("/pay");
        return;
      }
      throw new Error(result.error);
    }
    setStoredWorkspaceMode("member");
    router.replace("/pay");
  }

  async function handleJoinAsSignedIn() {
    setFormError("");
    setSubmitting(true);
    try {
      await joinWithCurrentSession();
    } catch (err: unknown) {
      setFormError(authErrorToMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleJoin() {
    setFormError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
      await joinWithCurrentSession();
    } catch (err: unknown) {
      setFormError(authErrorToMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setShowEmailInUseCta(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!invite || invite.status !== "valid") {
      return;
    }
    if (trimmedEmail !== invite.invitedEmail.toLowerCase()) {
      setFormError(
        "Use the same email address you were invited with (shown above).",
      );
      return;
    }
    if (!displayName.trim()) {
      setFormError("Enter your name.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await registerWithPassword(trimmedEmail, password, displayName.trim());
      await joinWithCurrentSession();
    } catch (err: unknown) {
      const msg = authErrorToMessage(err);
      setFormError(msg);
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "auth/email-already-in-use"
      ) {
        setShowEmailInUseCta(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!invite || authLoading) {
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
          <p className="mt-2 text-sm text-muted">
            Open the Member tab to see this subscription.
          </p>
          <Link href="/pay" className="mt-8 inline-flex pr-btn-primary no-underline">
            Go to Member
          </Link>
        </div>
      </div>
    );
  }

  const signedInMatches =
    !!appUser &&
    appUser.email.trim().toLowerCase() === invite.invitedEmail.toLowerCase();

  const signedInMismatch =
    !!appUser &&
    appUser.email.trim().toLowerCase() !== invite.invitedEmail.toLowerCase();

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
            Join{" "}
            <strong className="text-foreground">{invite.subName}</strong> on
            Payround
          </p>
        </div>

        <div className="pr-card space-y-6 p-6 shadow-card sm:p-8">
          <div className="rounded-xl border border-border bg-elevated-muted px-4 py-3 text-sm text-muted">
            <p>
              <span className="font-semibold text-foreground">
                {invite.ownerDisplayName}
              </span>{" "}
              invited you to split{" "}
              <span className="font-medium text-foreground">{invite.subName}</span>
              .
            </p>
            <p className="mt-2 text-xs">
              Invited email:{" "}
              <span className="font-medium text-foreground">
                {invite.invitedEmail}
              </span>
            </p>
          </div>

          {signedInMatches ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                You&apos;re signed in as{" "}
                <strong className="text-foreground">{appUser!.email}</strong>.
                You can own your own plans in Admin and still join this one as a
                member.
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleJoinAsSignedIn()}
                className="pr-btn-primary w-full"
                data-testid="invite-join-signed-in"
              >
                {submitting ? "Joining…" : "Join subscription"}
              </button>
            </div>
          ) : signedInMismatch ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You&apos;re signed in as {appUser!.email}, but this invite is for{" "}
                {invite.invitedEmail}. Sign out and use the invited account, or
                ask for a new invite.
              </p>
              <Link
                href={`/login?invite=${encodeURIComponent(token)}`}
                className="inline-flex w-full justify-center pr-btn-primary no-underline"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogleJoin()}
                className="pr-btn-secondary w-full border-border-strong font-semibold"
              >
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center px-2">
                  <span className="bg-elevated px-2 text-xs font-medium text-subtle">
                    or create with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="invite-name" className="pr-label">
                    Your name
                  </label>
                  <input
                    id="invite-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pr-input"
                    placeholder="Alex"
                  />
                </div>
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
                <div>
                  <label htmlFor="invite-password" className="pr-label">
                    Password
                  </label>
                  <input
                    id="invite-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-input"
                    placeholder="At least 6 characters"
                  />
                </div>
                <div>
                  <label htmlFor="invite-confirm" className="pr-label">
                    Confirm password
                  </label>
                  <input
                    id="invite-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-input"
                    placeholder="Repeat password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="pr-btn-primary w-full"
                  data-testid="invite-register-submit"
                >
                  {submitting ? "Creating account…" : "Create account & join"}
                </button>
              </form>

              <p className="text-center text-sm text-muted">
                Already have an account?{" "}
                <Link
                  href={`/login?invite=${encodeURIComponent(token)}`}
                  className="font-semibold text-accent underline-offset-2 hover:underline dark:text-blue-300"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {formError ? (
            <p
              role="alert"
              className="text-center text-sm text-red-600 dark:text-red-400"
            >
              {formError}
            </p>
          ) : null}
          {showEmailInUseCta ? (
            <p className="text-center text-sm text-muted">
              <Link
                href={`/login?invite=${encodeURIComponent(token)}`}
                className="font-semibold text-accent underline-offset-2 hover:underline dark:text-blue-300"
              >
                Already have an account? Sign in
              </Link>
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Link expires 72 hours after it was sent. Owners can join other people&apos;s
          plans with the same Google or email account.
        </p>
      </div>
    </div>
  );
}
