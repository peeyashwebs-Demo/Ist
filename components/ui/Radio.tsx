"use client";

import { ReactNode } from "react";

interface RadioProps {
  checked: boolean;
  onChange: () => void;
  label?: ReactNode;
  description?: ReactNode;
}

/** Single choice — circle, 1.5px border, purple dot that scales in. */
export function Radio({ checked, onChange, label, description }: RadioProps) {
  return (
    <label
      onClick={onChange}
      style={{
        display: "inline-flex",
        alignItems: description ? "flex-start" : "center",
        gap: 12,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          flex: "0 0 auto",
          marginTop: description ? 1 : 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          background: "var(--paper)",
          border: `1.5px solid ${checked ? "var(--indicator)" : "var(--hairline)"}`,
        }}
      >
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: "var(--indicator)",
            transform: checked ? "scale(1)" : "scale(0)",
            transition: "transform var(--dur-fast) var(--ease-soft)",
          }}
        />
      </span>
      {label || description ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label ? <span style={{ font: "var(--text-body)", fontWeight: 500, color: "var(--ink)" }}>{label}</span> : null}
          {description ? <span style={{ font: "var(--text-label)", letterSpacing: 0, color: "var(--ink-3)" }}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
