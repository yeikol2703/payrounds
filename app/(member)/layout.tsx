"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/owner-app-shell";

/** Member workspace (`/pay`) — same shell as Admin, with Member tab active. */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
