"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SideNav } from "@/components/shell/SideNav";
import { TopBar } from "@/components/shell/TopBar";
import { useAuth } from "@/lib/api/auth";

interface AppShellProps {
  title: string;
  /** Right-aligned top bar tools — search pill, filters, etc. */
  topBarTools?: ReactNode;
  children: ReactNode;
}

/** The desk's shared page frame — sidebar + top bar + scrollable content
 * column, capped at var(--content-max) and centered. Every dashboard route
 * (everything except /login) renders inside this.
 *
 * Also the auth guard for every one of those routes: reads TokenStore via
 * useAuth() and redirects to /login the moment there's no session, instead
 * of letting the page render and its data calls fail with 401. Server-side
 * this always evaluates "unauthenticated" (TokenStore has no access to
 * localStorage outside the browser) — that's intentional, it just means the
 * very first paint is the redirect state until the client snapshot takes
 * over, which useSyncExternalStore's server-snapshot handling makes a clean
 * swap rather than a hydration error. */
export function AppShell({ title, topBarTools, children }: AppShellProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    // Deliberately bare — this should only ever flash for a moment while
    // the redirect above fires (no session) or while TokenStore hydrates
    // from localStorage on first client render (real session). No skeleton
    // worth building for either case.
    return <div style={{ height: "100vh", background: "var(--bg)" }} />;
  }

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
