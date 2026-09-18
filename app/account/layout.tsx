import { OwnerAppShell } from "@/components/owner-app-shell";
import type { ReactNode } from "react";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <OwnerAppShell>{children}</OwnerAppShell>;
}
