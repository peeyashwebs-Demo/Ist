import { ReactNode } from "react";

export interface BadgeProps {
  children?: ReactNode;
  count?: number | string;
  /** Inherits the movement logic: neutral ink for plain counts, gain/loss for
   * resolved-good/bad, and the purple indicator only when the badge is the
   * "selected chip" of a view. */
  tone?: "neutral" | "gain" | "loss" | "review";
}

const TONE: Record<NonNullable<BadgeProps["tone"]>, { color: string; bg: string }> = {
  neutral: { color: "var(--ink-2)", bg: "var(--track)" },
  gain: { color: "var(--gain)", bg: "var(--status-approved-tint)" },
  loss: { color: "var(--loss)", bg: "var(--status-rejected-tint)" },
  review: { color: "var(--indicator)", bg: "var(--indicator-tint)" },
};

/** Small count chip — tabular numerals, used next to filter labels and
 * section titles. */
export function Badge({ children, count, tone = "neutral" }: BadgeProps) {
  const t = TONE[tone];
  return (
    <span
      className="k-tnum"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        minWidth: 20,
        height: 20,
        padding: "0 7px",
        background: t.bg,
        color: t.color,
        borderRadius: "var(--r-pill)",
        font: "var(--text-micro)",
        fontSize: 10,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {count != null ? <span style={{ font: "var(--text-micro)" }}>{count}</span> : null}
    </span>
  );
}
