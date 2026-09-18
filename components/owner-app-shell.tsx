"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { Atmosphere } from "@/components/atmosphere";
import { motion, RouteFade, springSoft } from "@/components/motion";
import { subscribeToNotifications } from "@/lib/firestore/notifications";
import {
  setStoredWorkspaceMode,
  workspaceModeFromPath,
  type WorkspaceMode,
} from "@/lib/workspace-mode";

const MOBILE_NAV_LINK_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition";

function ModeTabs({
  mode,
  onAdmin,
  onMember,
}: {
  mode: WorkspaceMode;
  onAdmin: () => void;
  onMember: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="relative flex rounded-full border border-border bg-elevated-muted/80 p-1 backdrop-blur-xl"
      role="tablist"
      aria-label={t("nav.workspace")}
    >
      {(
        [
          { id: "admin" as const, label: t("nav.admin"), onClick: onAdmin },
          { id: "member" as const, label: t("nav.member"), onClick: onMember },
        ] as const
      ).map((tab) => {
        const active = mode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={tab.id === "admin" ? "tab-admin" : "tab-member"}
            onClick={tab.onClick}
            className={`relative z-10 flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
              active
                ? "text-accent-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 -z-10 rounded-full bg-accent shadow-md shadow-accent/20"
                transition={springSoft}
              />
            ) : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

export function AppShell({ children }: { children: ReactNode }) {
  const { appUser, loading, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const mode = workspaceModeFromPath(pathname);

  useEffect(() => {
    if (!loading && !appUser) {
      router.replace("/login");
    }
  }, [appUser, loading, router]);

  useEffect(() => {
    if (!appUser) {
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
    setStoredWorkspaceMode(mode);
  }, [mode]);

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

  function goAdmin() {
    setStoredWorkspaceMode("admin");
    router.push("/dashboard");
  }

  function goMember() {
    setStoredWorkspaceMode("member");
    router.push("/pay");
  }

  if (loading || !appUser) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <Atmosphere />
        <div
          className="relative z-10 h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
        <span className="sr-only">{t("nav.loading")}</span>
      </div>
    );
  }

  const iconDashboard = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
  const iconSubs = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
  const iconNotif = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
  const iconFriends = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
  const iconStats = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
  const iconHelp = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
  const iconGear = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const iconUser = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );

  const adminNavItems: NavItem[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: iconDashboard },
    { href: "/subscriptions/new", label: t("nav.subscriptions"), icon: iconSubs },
    { href: "/stats", label: t("nav.stats"), icon: iconStats },
    { href: "/friends", label: t("nav.friends"), icon: iconFriends },
    { href: "/notifications", label: t("nav.notifications"), icon: iconNotif },
    { href: "/help", label: t("nav.help"), icon: iconHelp },
  ];

  const memberNavItems: NavItem[] = [
    { href: "/pay", label: t("nav.payments"), icon: iconSubs },
    { href: "/notifications", label: t("nav.notifications"), icon: iconNotif },
    { href: "/help", label: t("nav.help"), icon: iconHelp },
  ];

  const navItems = mode === "admin" ? adminNavItems : memberNavItems;

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

  const settingsActive =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/");

  const brandBlock = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[rgb(8_11_26)] shadow-lg shadow-sky-400/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="min-w-0 text-left">
          <p className="pr-display truncate text-xl text-foreground">Payround</p>
          <p className="truncate text-[11px] text-muted">
            {mode === "admin" ? t("nav.admin") : t("nav.member")}
          </p>
        </div>
      </div>
      <ModeTabs mode={mode} onAdmin={goAdmin} onMember={goMember} />
    </div>
  );

  const navLinks = (onNavigate?: () => void) =>
    navItems.map((item) => {
      const active = isNavActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`relative flex items-center gap-3 rounded-full px-3 py-2.5 text-sm transition ${
            active
              ? "font-bold text-accent-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {active ? (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-0 -z-10 rounded-full bg-accent shadow-md shadow-accent/20"
              transition={springSoft}
            />
          ) : null}
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              active
                ? "bg-accent-foreground/10 text-accent-foreground"
                : "bg-elevated-muted text-muted"
            }`}
          >
            {item.icon}
          </span>
          <span className="flex-1 text-left">{item.label}</span>
          {item.href === "/notifications" && unreadNotifications > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          ) : null}
        </Link>
      );
    });

  const profileFooter = (onNav?: () => void) => (
    <div className="mt-auto space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-elevated-muted/60 p-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-md">
          <span className="sr-only">{appUser.displayName}</span>
          {iconUser}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-semibold text-foreground">
            {appUser.displayName}
          </p>
          <p className="truncate text-[11px] text-muted">{appUser.email}</p>
        </div>
        <ThemeToggle compact />
      </div>
      <div className="flex gap-2">
        <Link
          href="/settings"
          onClick={onNav}
          data-testid="nav-settings"
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold transition ${
            settingsActive
              ? "bg-accent text-accent-foreground shadow-md shadow-accent/20"
              : "border border-border bg-elevated-muted/60 text-muted hover:bg-elevated-muted hover:text-foreground"
          }`}
        >
          {iconGear}
          {t("nav.settings")}
        </Link>
        <button
          type="button"
          data-testid="nav-sign-out"
          onClick={() => {
            onNav?.();
            void signOut();
          }}
          className="rounded-full border border-border bg-elevated-muted/60 px-3 py-2.5 text-xs font-semibold text-muted transition hover:bg-elevated-muted hover:text-foreground"
        >
          {t("nav.signOut")}
        </button>
      </div>
    </div>
  );

  const sidebarInner = (onNav?: () => void) => (
    <>
      <div className="px-1 pb-4">{brandBlock}</div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Main">
        {navLinks(onNav)}
      </nav>
      {profileFooter(onNav)}
    </>
  );

  return (
    <div className="relative flex min-h-screen flex-col md:flex-row">
      <Atmosphere />

      <header className="sticky top-0 z-[70] flex h-14 shrink-0 items-center gap-3 border-b border-border bg-elevated/80 px-4 backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-elevated-muted text-foreground backdrop-blur-md"
          aria-expanded={mobileDrawerOpen}
          aria-controls="app-sidebar-drawer"
          aria-label={t("nav.openMenu")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-bold tracking-tight text-foreground">
          Payround
        </span>
        <div className="w-36 shrink-0">
          <ModeTabs mode={mode} onAdmin={goAdmin} onMember={goMember} />
        </div>
      </header>

      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden" role="presentation">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label={t("nav.closeMenu")}
            onClick={closeMobileDrawer}
          />
          <motion.aside
            id="app-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={springSoft}
            className="absolute inset-y-3 left-3 flex w-[min(18rem,86vw)] flex-col rounded-[1.75rem] pr-glass p-4 shadow-nav"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{t("nav.menu")}</span>
              <button
                type="button"
                onClick={closeMobileDrawer}
                className="rounded-xl p-2 text-muted transition hover:bg-elevated-muted hover:text-foreground"
                aria-label={t("nav.closeMenu")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {sidebarInner(closeMobileDrawer)}
          </motion.aside>
        </div>
      ) : null}

      {/* Floating glass sidebar (desktop) */}
      <aside className="relative z-20 hidden w-[17.5rem] shrink-0 p-3 md:flex md:flex-col">
        <div className="sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col rounded-[1.75rem] pr-glass p-4 shadow-nav">
          {sidebarInner()}
        </div>
      </aside>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-3 md:pr-3 md:pt-3">
        <div className="min-h-full rounded-[1.25rem] md:min-h-[calc(100vh-1.5rem)] md:bg-transparent md:p-1">
          <RouteFade routeKey={pathname}>{children}</RouteFade>
        </div>
      </main>

      <nav
        className="fixed bottom-3 left-3 right-3 z-[60] flex rounded-full border border-border bg-elevated/90 px-1 py-1 shadow-nav backdrop-blur-2xl md:hidden"
        aria-label="Mobile primary"
      >
        {navItems.slice(0, 4).map((item) => {
          const active = isNavActive(item.href);
          return (
            <Link
              key={`bottom-${item.href}`}
              href={item.href}
              className={`relative ${MOBILE_NAV_LINK_CLASS} ${
                active ? "text-foreground" : "text-muted"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute inset-1 -z-10 rounded-2xl bg-accent/25"
                  transition={springSoft}
                />
              ) : null}
              <span className="relative inline-flex">
                {item.icon}
                {item.href === "/notifications" && unreadNotifications > 0 ? (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                ) : null}
              </span>
              <span className="max-w-[4.5rem] truncate">{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={`relative ${MOBILE_NAV_LINK_CLASS} ${
            settingsActive ? "text-foreground" : "text-muted"
          }`}
        >
          {settingsActive ? (
            <motion.span
              layoutId="mobile-nav-pill"
              className="absolute inset-1 -z-10 rounded-2xl bg-accent/25"
              transition={springSoft}
            />
          ) : null}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="max-w-[4.5rem] truncate">{t("nav.settings")}</span>
        </Link>
      </nav>
    </div>
  );
}

/** @deprecated Use {@link AppShell}. */
export const OwnerAppShell = AppShell;
