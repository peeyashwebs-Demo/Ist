import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Users">{children}</AppShell>;
}
