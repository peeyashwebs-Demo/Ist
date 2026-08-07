"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

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
 * sign-out confirmation, anchored to the staff chip. */
export function TopBar({ title, children, staffName = "Fola Adeyemi", staffRole = "Compliance officer" }: TopBarProps) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const router = useRouter();

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <IconButton icon="logout" size={34} variant="bare" label="Sign out" onClick={() => setConfirmingSignOut(true)} />
        </div>
      </div>

      <ConfirmationModal
        open={confirmingSignOut}
        title="Sign out of the desk?"
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => router.push("/login")}
        cancelLabel="Stay"
        confirmLabel="Sign out"
        width={340}
      >
        Open case notes are not saved.
      </ConfirmationModal>
    </header>
  );
}
