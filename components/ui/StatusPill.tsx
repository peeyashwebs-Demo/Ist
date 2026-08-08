export type Status = "pending" | "review" | "approved" | "rejected" | "expired" | "flagged" | "completed";

// Workflow state inherits the movement logic: resolved-good reads gain, resolved-bad
// reads loss, waiting stays neutral ink, and the one state that needs a human
// decision carries the purple indicator.
const STATUS: Record<Status, { label: string; color: string; tint: string }> = {
  pending: { label: "Pending", color: "var(--status-pending)", tint: "var(--status-pending-tint)" },
  review: { label: "Under review", color: "var(--status-review)", tint: "var(--status-review-tint)" },
  approved: { label: "Approved", color: "var(--status-approved)", tint: "var(--status-approved-tint)" },
  rejected: { label: "Rejected", color: "var(--status-rejected)", tint: "var(--status-rejected-tint)" },
  expired: { label: "Expired", color: "var(--status-expired)", tint: "var(--status-expired-tint)" },
  flagged: { label: "Flagged", color: "var(--status-flagged)", tint: "var(--status-flagged-tint)" },
  completed: { label: "Completed", color: "var(--status-approved)", tint: "var(--status-approved-tint)" },
};

interface StatusPillProps {
  status: Status;
  /** Overrides the status's default label — e.g. "Settled" for an approved transaction. */
  label?: string;
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Tinted pill + dot — the dashboard's shared state vocabulary. */
export function StatusPill({ status, label, dot = true, size = "md", className }: StatusPillProps) {
  const s = STATUS[status] ?? STATUS.pending;
  const sm = size === "sm";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: sm ? "3px 8px" : "4px 10px",
        background: s.tint,
        color: s.color,
        borderRadius: "var(--r-pill)",
        font: "var(--text-label)",
        fontSize: sm ? 10 : 11,
        letterSpacing: "var(--track-label)",
        lineHeight: 1.3,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {dot ? (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flex: "0 0 auto" }} />
      ) : null}
      {label || s.label}
    </span>
  );
}

/** Simple two-state dot used by the Users table's Account column — Active/Suspended. */
export function DotStatus({ tone, label }: { tone: "gain" | "loss"; label: string }) {
  const color = tone === "gain" ? "var(--gain)" : "var(--loss)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--text-data)", color: "var(--ink)" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flex: "0 0 auto" }} />
      {label}
    </span>
  );
}
