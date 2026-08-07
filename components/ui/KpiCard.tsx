import { Icon, IconName } from "@/components/icons/Icon";

interface KpiCardProps {
  icon?: IconName;
  label: string;
  value: string;
  sub?: string;
  subTone?: "neutral" | "gain" | "loss";
}

const SUB_COLOR: Record<NonNullable<KpiCardProps["subTone"]>, string> = {
  neutral: "var(--ink-3)",
  gain: "var(--gain)",
  loss: "var(--loss)",
};

/** KPI stat card — icon, uppercase label, tabular value, colored sub-line. */
export function KpiCard({ icon, label, value, sub, subTone = "neutral" }: KpiCardProps) {
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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon ? <Icon name={icon} size={16} color="var(--ink-3)" /> : null}
        <span
          style={{
            font: "var(--text-label)",
            letterSpacing: "var(--track-label)",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="k-tnum"
        style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)" }}
      >
        {value}
      </div>
      {sub ? (
        <div
          className="k-tnum"
          style={{ font: "var(--text-label)", letterSpacing: 0, color: SUB_COLOR[subTone] }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}
