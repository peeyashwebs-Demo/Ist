"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";

interface TopBarProps {
  title: string;
  /** Right-aligned tools — search pill, filters, etc. Staff chip + logout are built in. */
  children?: ReactNode;
  staffName?: string;
  staffRole?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** 60px top bar with hairline bottom border. Every screen shares this same
 * sign-out confirmation — a small popover anchored to the staff chip, not a
 * full modal. */
export function TopBar({ title, children, staffName = "Fola Adeyemi", staffRole = "Compliance officer" }: TopBarProps) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!confirmingSignOut) return;
    const onClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) setConfirmingSignOut(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmingSignOut(false);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmingSignOut]);

  return (
    <header
      style={{
        height: "var(--topbar-h)",
        flex: "0 0 auto",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{title}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {children}
        <span style={{ width: 1, height: 26, background: "var(--hairline)" }} />
        <div ref={chipRef} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--feature)",
              color: "var(--feature-ink)",
              display: "grid",
              placeItems: "center",
              font: "var(--text-label)",
              letterSpacing: 0,
              fontWeight: 600,
            }}
          >
            {initials(staffName)}
          </span>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ font: "var(--text-data)", color: "var(--ink)", fontWeight: 500 }}>{staffName}</span>
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {staffRole}
            </span>
          </span>
          <IconButton icon="logout" size={34} variant="bare" label="Sign out" onClick={() => setConfirmingSignOut((v) => !v)} />

          {confirmingSignOut ? (
            <div
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                zIndex: 40,
                width: 300,
                padding: 16,
                background: "var(--paper)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-nav)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
                Sign out of the desk? Open case notes are not saved.
              </span>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingSignOut(false)}>
                  Stay
                </Button>
                <Button size="sm" onClick={() => router.push("/login")}>
                  Sign out
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
