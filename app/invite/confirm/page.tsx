"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export default function InviteConfirmPage() {
  const { completeMagicLinkSignIn } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;
    completeMagicLinkSignIn().catch((e: Error) => {
      setError(e.message ?? "Sign-in failed. The link may have expired.");
      setStatus("error");
    });
  }, [completeMagicLinkSignIn]);

  if (status === "error") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-page p-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="pr-card w-full max-w-md p-10 text-center shadow-card">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-600 dark:text-red-400"
            aria-hidden
          >
            ✕
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Sign-in failed
          </h2>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <a
            href="/login"
            className="mt-8 inline-flex pr-btn-primary no-underline"
          >
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="pr-card w-full max-w-md p-10 text-center shadow-card">
        <div
          className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
        <p className="text-sm text-muted">Signing you in…</p>
        <span className="sr-only">Signing in</span>
      </div>
    </div>
  );
}
