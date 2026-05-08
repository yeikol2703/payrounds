"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RootPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!appUser) {
      router.replace("/login");
    } else if (appUser.role === "owner") {
      router.replace("/dashboard");
    } else {
      router.replace("/pay");
    }
  }, [appUser, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden
      />
      <p className="text-sm text-muted">Loading your workspace…</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
