import { ReactNode } from "react";
import { Icon, IconName } from "@/components/icons/Icon";

interface EmptyStateCardProps {
  title: string;
  body?: string;
  icon?: IconName;
  action?: ReactNode;
}

/** Shared empty-state card — dashed-border panel with icon, headline, body,
 * and an optional call-to-action. */
export function EmptyStateCard({ title, body, icon = "doc", action }: EmptyStateCardProps) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px dashed var(--hairline)",
        borderRadius: "var(--r-table)",
        padding: "56px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 12, background: "var(--track)", color: "var(--ink-3)" }}>
        <Icon name={icon} size={22} />
      </span>
      <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{title}</span>
      {body ? <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 380 }}>{body}</span> : null}
      {action ? <span style={{ marginTop: 8 }}>{action}</span> : null}
    </div>
  );
}
