"use client";

import { InputHTMLAttributes } from "react";

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Compact date-range field for table toolbars — uppercase label + native
 * date picker in the 36px filter height. Empty selection reads as the label
 * pair (From/To) and means "no bound". */
export function DateField({ label, value, onChange, ...rest }: DateFieldProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 12px",
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-input)",
      }}
    >
      <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--text-data)",
          color: value ? "var(--ink)" : "var(--ink-3)",
          width: 116,
        }}
      />
    </label>
  );
}
