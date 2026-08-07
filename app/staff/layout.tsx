import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Staff">{children}</AppShell>;
}
