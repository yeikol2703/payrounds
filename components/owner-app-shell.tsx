"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { subscribeToNotifications } from "@/lib/firestore/notifications";

const MOBILE_NAV_LINK_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition";

export function OwnerAppShell({ children }: { children: ReactNode }) {
  const { appUser, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !appUser) {
      router.replace("/login");
    }
    if (!loading && appUser && appUser.role !== "owner") {
      router.replace("/pay");
    }
  }, [appUser, loading, router]);

  useEffect(() => {
    if (!appUser || appUser.role !== "owner") {
      setUnreadNotifications(0);
      return;
    }
    return subscribeToNotifications(appUser.uid, (list) => {
      setUnreadNotifications(list.filter((n) => !n.read).length);
    });
  }, [appUser]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function onChange() {
      if (mq.matches) {
        setMobileDrawerOpen(false);
      }
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (loading || !appUser || appUser.role !== "owner") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      href: "/subscriptions/new",
      label: "Subscriptions",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
  ];

  function isNavActive(href: string) {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === "/subscriptions/new" && pathname.startsWith("/subscriptions"))
    );
  }

  function closeMobileDrawer() {
    setMobileDrawerOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-page md:flex-row">
      <header className="sticky top-0 z-[70] flex h-14 shrink-0 items-center gap-3 border-b border-border bg-elevated/95 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated-muted text-foreground transition hover:bg-elevated"
          aria-expanded={mobileDrawerOpen}
          aria-controls="owner-sidebar-drawer"
          aria-label="Open navigation menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <span className="truncate text-sm font-bold tracking-tight text-foreground">
          Payround
        </span>
      </header>

      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            aria-label="Close navigation menu"
            onClick={closeMobileDrawer}
          />
          <aside
            id="owner-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-[min(17.5rem,85vw)] flex-col border-r border-border bg-elevated shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold tracking-tight text-foreground">
                Menu
              </span>
              <button
                type="button"
                onClick={closeMobileDrawer}
                className="rounded-lg p-2 text-subtle transition hover:bg-elevated-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <svg
                  width="18"
                  height="18"
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
            </div>
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent shadow-sm">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="truncate text-sm font-bold tracking-tight text-foreground">
                    Payround
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <ThemeToggle compact className="w-full justify-center" />
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label="Main">
              {navItems.map((item) => {
                const active = isNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileDrawer}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-accent-muted font-semibold text-accent shadow-sm"
                        : "text-muted hover:bg-elevated-muted hover:text-foreground"
                    }`}
                  >
                    <span className={active ? "text-accent" : "text-subtle"}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/notifications" &&
                    unreadNotifications > 0 ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
                        {unreadNotifications > 99
                          ? "99+"
                          : unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border px-3 py-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
                  {appUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {appUser.displayName}
                  </p>
                  <p className="truncate text-xs text-subtle">{appUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeMobileDrawer();
                  void signOut();
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-muted transition hover:bg-elevated-muted hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-elevated shadow-nav md:flex">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent shadow-sm">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="truncate text-sm font-bold tracking-tight text-foreground">
                Payround
              </span>
            </div>
          </div>
          <div className="mt-3">
            <ThemeToggle compact className="w-full justify-center" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Main">
          {navItems.map((item) => {
            const active = isNavActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-accent-muted font-semibold text-accent shadow-sm"
                    : "text-muted hover:bg-elevated-muted hover:text-foreground"
                }`}
              >
                <span className={active ? "text-accent" : "text-subtle"}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.href === "/notifications" && unreadNotifications > 0 ? (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-3 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
              {appUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {appUser.displayName}
              </p>
              <p className="truncate text-xs text-subtle">{appUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-muted transition hover:bg-elevated-muted hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[60] flex border-t border-border bg-elevated/95 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden"
        aria-label="Mobile primary"
      >
        {navItems.map((item) => {
          const active = isNavActive(item.href);
          return (
            <Link
              key={`bottom-${item.href}`}
              href={item.href}
              className={`relative ${MOBILE_NAV_LINK_CLASS} ${
                active
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`relative inline-flex ${
                  active ? "text-accent" : "text-subtle"
                }`}
              >
                {item.icon}
                {item.href === "/notifications" &&
                unreadNotifications > 0 ? (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[8px] font-bold leading-none text-white ring-2 ring-elevated">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
