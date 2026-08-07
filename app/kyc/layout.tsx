import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function KycLayout({ children }: { children: ReactNode }) {
  return <AppShell title="KYC review">{children}</AppShell>;
}
