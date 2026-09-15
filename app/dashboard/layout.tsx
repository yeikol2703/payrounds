import { OwnerAppShell } from "@/components/owner-app-shell";
import type { ReactNode } from "react";

/** Authenticated app shell with Admin / Member workspace tabs. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <OwnerAppShell>{children}</OwnerAppShell>;
}
