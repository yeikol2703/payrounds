"use client";

/**
 * Workspace mode: Admin = subscriptions you own; Member = ones you joined.
 * Stored in localStorage so the choice survives reloads.
 */
export type WorkspaceMode = "admin" | "member";

const STORAGE_KEY = "payround.workspaceMode";

export function getStoredWorkspaceMode(): WorkspaceMode {
  if (typeof window === "undefined") {
    return "admin";
  }
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "member" ? "member" : "admin";
}

export function setStoredWorkspaceMode(mode: WorkspaceMode): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, mode);
}

/** Infer mode from route; shared routes keep the stored tab. */
export function workspaceModeFromPath(pathname: string): WorkspaceMode {
  if (pathname === "/pay" || pathname.startsWith("/pay/")) {
    return "member";
  }
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/subscriptions") ||
    pathname.startsWith("/friends") ||
    pathname.startsWith("/stats")
  ) {
    return "admin";
  }
  // Shared: notifications, settings, legacy /account
  return getStoredWorkspaceMode();
}
