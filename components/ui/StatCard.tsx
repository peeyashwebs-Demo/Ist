import { ReactNode } from "react";
import { Badge, type BadgeProps } from "./Badge";

interface StatCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  subTone?: "neutral" | "gain" | "loss";
  /** Optional risk/attention chip, e.g. "2 above tier limit". */
  flag?: ReactNode;
}

const SUB_COLOR: Record<NonNullable<StatCardProps["subTone"]>, string> = {
  neutral: "var(--ink-3)",
  gain: "var(--gain)",
  loss: "var(--loss)",
};

/** Top stat cell — white paper, hairline, no shadow. Uppercase label,
 * tabular hero value, and a tonal sub-line. */
export function StatCard({ label, value, sub, subTone = "neutral", flag }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-card)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
      }}
    >
      <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      <div className="k-tnum" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)" }}>
        {value}
        {flag}
      </div>
      {sub ? (
        <span className="k-tnum" style={{ font: "var(--text-label)", letterSpacing: 0, color: SUB_COLOR[subTone] }}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

export { Badge, type BadgeProps };
