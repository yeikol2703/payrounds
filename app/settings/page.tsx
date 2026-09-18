"use client";

import { useCallback, useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Locale } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppPage } from "@/components/app-page";
import { deleteAccount } from "@/app/actions/users";
import { auth, db } from "@/lib/firebase";

function UserSilhouette({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function SettingsPage() {
  const { appUser, refreshAppUser, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (appUser) {
      setDisplayName(appUser.displayName);
    }
  }, [appUser]);

  const saveDisplayName = useCallback(async () => {
    if (!appUser) {
      return;
    }
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError(t("settings.nameEmpty"));
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        await updateProfile(firebaseUser, { displayName: trimmed });
      }
      await updateDoc(doc(db, "users", appUser.uid), {
        displayName: trimmed,
      });
      await refreshAppUser();
    } catch {
      setNameError(t("settings.nameSaveError"));
    } finally {
      setSavingName(false);
    }
  }, [appUser, displayName, refreshAppUser, t]);

  const confirmDelete = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      await deleteAccount(idToken);
      await signOut();
    } catch {
      setDeleteError(t("settings.deleteError"));
      setDeleting(false);
    }
  }, [signOut, t]);

  return (
    <>
      <AppPage
        width="full"
        title={
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-elevated-muted text-foreground">
              <GearIcon />
            </span>
            <h1 className="pr-page-title">{t("settings.title")}</h1>
          </div>
        }
        lead={t("settings.lead")}
        data-testid="settings-page"
      >
        <div
          className="w-full overflow-hidden rounded-[1.5rem] border border-border bg-elevated/80 shadow-card backdrop-blur-xl"
          data-testid="account-settings-panel"
        >
          {/* Profile */}
          <section className="border-b border-border px-4 py-5 sm:px-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-accent-ink">
                <UserSilhouette />
              </span>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-foreground">
                  {appUser?.displayName || t("settings.displayName")}
                </p>
                <p className="truncate text-xs text-muted">{appUser?.email}</p>
              </div>
            </div>
            <label
              htmlFor="settings-display-name"
              className="mb-1.5 block text-left text-xs font-semibold text-muted"
            >
              {t("settings.displayName")}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="settings-display-name"
                data-testid="account-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="pr-input min-w-0 flex-1"
              />
              <button
                type="button"
                data-testid="account-save-name"
                disabled={savingName}
                onClick={() => void saveDisplayName()}
                className="pr-btn-primary shrink-0 sm:w-auto"
              >
                {t("settings.saveName")}
              </button>
            </div>
            {nameError ? (
              <p className="mt-2 text-left text-xs pr-text-danger">
                {nameError}
              </p>
            ) : null}
          </section>

          {/* Options */}
          <section className="border-b border-border px-4 py-4 sm:px-6">
            <p className="mb-3 text-left text-[10px] font-bold uppercase tracking-wider text-subtle">
              {t("settings.options")}
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {t("settings.language")}
                </p>
                <div
                  className="flex rounded-full border border-border bg-elevated-muted p-1"
                  role="radiogroup"
                  aria-label={t("settings.language")}
                >
                  {(["es", "en"] as Locale[]).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      role="radio"
                      aria-checked={locale === loc}
                      data-testid={`account-locale-${loc}`}
                      onClick={() => setLocale(loc)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        locale === loc
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {loc === "es" ? "ES" : "EN"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    {t("settings.theme")}
                  </p>
                  <p className="text-xs text-muted">{t("settings.themeHint")}</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </section>

          {/* Danger — options next to cancel/delete */}
          <section className="px-4 py-5 sm:px-6">
            <p className="mb-3 text-left text-[10px] font-bold uppercase tracking-wider text-subtle">
              {t("settings.account")}
            </p>
            {deleteError ? (
              <p className="mb-3 text-left text-xs pr-text-danger">
                {deleteError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                data-testid="account-delete-open"
                onClick={() => setDeleteOpen(true)}
                className="pr-btn-danger rounded-full px-4 py-2.5 text-sm"
              >
                {t("settings.deleteAccount")}
              </button>
            </div>
          </section>
        </div>
      </AppPage>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => !deleting && setDeleteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            data-testid="account-delete-modal"
            className="w-full max-w-sm rounded-2xl border border-border bg-elevated p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-account-title"
              className="text-left text-base font-bold text-foreground"
            >
              {t("settings.deleteConfirmTitle")}
            </h2>
            <p className="mt-2 text-left text-sm text-muted">
              {t("settings.deleteConfirmBody")}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-full border border-border px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-elevated-muted"
              >
                {t("settings.cancel")}
              </button>
              <button
                type="button"
                data-testid="account-delete-confirm"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="pr-btn-danger flex-1 rounded-full px-3 py-2.5 text-sm disabled:opacity-60"
              >
                {deleting
                  ? t("settings.deleting")
                  : t("settings.deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
