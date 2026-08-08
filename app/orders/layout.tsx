import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Orders">{children}</AppShell>;
}
