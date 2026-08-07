import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function TransactionsLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Transactions">{children}</AppShell>;
}
