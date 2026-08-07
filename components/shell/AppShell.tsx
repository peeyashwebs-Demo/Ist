import { ReactNode } from "react";
import { SideNav } from "@/components/shell/SideNav";
import { TopBar } from "@/components/shell/TopBar";

interface AppShellProps {
  title: string;
  /** Right-aligned top bar tools — search pill, filters, etc. */
  topBarTools?: ReactNode;
  children: ReactNode;
}

/** The desk's shared page frame — sidebar + top bar + scrollable content
 * column, capped at var(--content-max) and centered. Every dashboard route
 * (everything except /login) renders inside this. */
export function AppShell({ title, topBarTools, children }: AppShellProps) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
      <SideNav />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar title={title}>{topBarTools}</TopBar>
        <main style={{ flex: 1, overflow: "auto", padding: "24px var(--gutter-desktop) 40px" }}>
          <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
