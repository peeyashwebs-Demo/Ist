"use client";

import { ReactNode } from "react";

interface PillChipProps {
  active?: boolean;
  onClick?: () => void;
  count?: number | string;
  children?: ReactNode;
}

/** Toggleable filter chip — white paper + hairline when idle, purple tint when
 * selected (the view's "selected chip"). */
export function PillChip({ active = false, onClick, count, children }: PillChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 12px",
        background: active ? "var(--indicator-tint)" : "var(--paper)",
        color: active ? "var(--indicator)" : "var(--ink-2)",
        border: `1px solid ${active ? "transparent" : "var(--hairline)"}`,
        borderRadius: "var(--r-pill)",
        font: "var(--text-data)",
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-soft), color var(--dur-fast) var(--ease-soft)",
      }}
    >
      {children}
      {count != null ? (
        <span className="k-tnum" style={{ font: "var(--text-micro)", color: active ? "var(--indicator)" : "var(--ink-3)" }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
