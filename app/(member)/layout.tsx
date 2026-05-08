"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!appUser) {
      router.replace("/login");
      return;
    }
    if (appUser.role === "owner") {
      router.replace("/dashboard");
    }
  }, [appUser, loading, router]);

  if (loading || !appUser || appUser.role === "owner") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
        <p className="text-sm text-muted">Loading…</p>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 border-b border-border bg-elevated/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground shadow-sm">
              P
            </span>
            <span className="text-sm font-bold tracking-tight text-foreground">
              Payround
            </span>
          </div>
          <ThemeToggle compact />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
