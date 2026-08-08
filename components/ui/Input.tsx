"use client";

import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  /** Field height — 44 in forms, 36 in table toolbars. */
  height?: number;
}

/** Text input — hairline border, 10px radius, ink data role. Form labels use
 * the label role (uppercase, tracked). */
export function Input({ label, hint, error, prefix, id, height = 44, style, ...rest }: InputProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", ...style }}>
      {label ? (
        <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      ) : null}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {prefix ? <span style={{ position: "absolute", left: 12, display: "grid", placeItems: "center" }}>{prefix}</span> : null}
        <input
          id={id}
          className="k-input"
          style={{
            width: "100%",
            height,
            padding: prefix ? "0 14px 0 38px" : "0 14px",
            background: "var(--paper)",
            border: `1px solid ${error ? "var(--border-error)" : "var(--hairline)"}`,
            borderRadius: "var(--r-input)",
            font: "var(--text-data)",
            color: "var(--ink)",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color var(--dur-fast) var(--ease-soft)",
          }}
          {...rest}
        />
      </div>
      {error ? (
        <span className="k-tnum" style={{ font: "var(--text-micro)", color: "var(--loss)" }}>{error}</span>
      ) : hint ? (
        <span style={{ font: "var(--text-micro)", color: "var(--ink-3)" }}>{hint}</span>
      ) : null}
    </label>
  );
}
