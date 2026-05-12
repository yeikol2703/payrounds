import { OwnerAppShell } from "@/components/owner-app-shell";
import type { ReactNode } from "react";

/** Owner area layout: responsive shell (sidebar, mobile drawer, bottom nav) lives in {@link OwnerAppShell}. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <OwnerAppShell>{children}</OwnerAppShell>;
}
