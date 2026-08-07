"use client";

import { useId } from "react";

interface BalancePanelProps {
  label: string;
  value: string;
  change: { label: string; tone: "gain" | "loss" };
  /** Oldest → newest. Needs at least 2 points to draw a line. */
  series: number[];
}

const VB_W = 300;
const VB_H = 64;
const PAD = 4;

function buildPaths(series: number[]) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = (VB_W - PAD * 2) / (series.length - 1);

  const points = series.map((v, i) => {
    const x = PAD + i * stepX;
    const y = PAD + (1 - (v - min) / range) * (VB_H - PAD * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  const area = `${line} L${lastX.toFixed(1)},${VB_H} L${firstX.toFixed(1)},${VB_H} Z`;

  return { line, area };
}

/** The desk's single dark "feature" surface (per the tokens' one-rich-surface
 * rule) — today's transaction volume with an intraday sparkline. */
export function BalancePanel({ label, value, change, series }: BalancePanelProps) {
  const gradientId = useId().replace(/:/g, "");
  const paths = buildPaths(series);
  const lineColor = change.tone === "gain" ? "var(--gain-on-ink)" : "var(--loss-on-ink)";

  return (
    <div
      style={{
        background: "var(--feature)",
        borderRadius: "var(--r-feature)",
        boxShadow: "var(--shadow-nav)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 20,
        minHeight: 176,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span
          style={{
            font: "var(--text-label)",
            letterSpacing: "var(--track-label)",
            textTransform: "uppercase",
            color: "var(--feature-ink-2)",
          }}
        >
          {label}
        </span>
        <div className="k-tnum" style={{ font: "var(--text-hero)", letterSpacing: "var(--track-hero)", color: "var(--feature-ink)" }}>
          {value}
        </div>
        <span className="k-tnum" style={{ font: "var(--text-label)", letterSpacing: 0, color: lineColor }}>
          {change.label}
        </span>
      </div>

      {paths ? (
        <svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" style={{ display: "block" }} aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={paths.area} fill={`url(#${gradientId})`} stroke="none" />
          <path d={paths.line} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}
