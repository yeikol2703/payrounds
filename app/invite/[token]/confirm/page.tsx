"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { acceptInviteJoin } from "@/app/actions/invites";
import { auth } from "@/lib/firebase";

type PageProps = { params: Promise<{ token: string }> };

export default function InviteTokenConfirmPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
  const { completeMagicLinkSignIn } = useAuth();
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;

    (async () => {
      try {
        await completeMagicLinkSignIn({ skipRedirect: true });
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Sign-in did not complete.");
        }
        const idToken = await user.getIdToken(true);
        const result = await acceptInviteJoin(token, idToken);
        if (!result.ok) {
          if (result.error === "already_accepted") {
            router.replace("/pay");
            return;
          }
          throw new Error(result.error);
        }
        router.replace("/pay");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Something went wrong. Try again.",
        );
        setStatus("error");
      }
    })();
  }, [completeMagicLinkSignIn, router, token]);

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
            Couldn&apos;t complete invite
          </h2>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link
            href={`/invite/${encodeURIComponent(token)}`}
            className="mt-6 mr-2 inline-flex pr-btn-secondary no-underline"
          >
            Back to invite
          </Link>
          <Link href="/login" className="mt-6 inline-flex pr-btn-primary no-underline">
            Login
          </Link>
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
        <p className="text-sm text-muted">Joining subscription…</p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
