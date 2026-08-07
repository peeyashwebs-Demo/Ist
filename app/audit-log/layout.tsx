import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function AuditLogLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Audit log">{children}</AppShell>;
}
