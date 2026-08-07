import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function OverviewLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Overview">{children}</AppShell>;
}
