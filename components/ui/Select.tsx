"use client";

import { SelectHTMLAttributes } from "react";
import { Icon } from "@/components/icons/Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  width?: number | string;
  /** Field height — 44 in forms, 36 in table toolbars. */
  height?: number;
}

/** Select control — hairline border, 10px radius, chevron affordance. Used
 * for the KYC override reason and filter pickers. */
export function Select({ label, value, onChange, options, placeholder, width, id, height = 44, style, ...rest }: SelectProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, width, ...style }}>
      {label ? (
        <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      ) : null}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          id={id}
          className="k-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            height,
            padding: "0 38px 0 14px",
            appearance: "none",
            WebkitAppearance: "none",
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-input)",
            font: "var(--text-data)",
            color: value ? "var(--ink)" : "var(--ink-3)",
            outline: "none",
            cursor: "pointer",
            boxSizing: "border-box",
            transition: "border-color var(--dur-fast) var(--ease-soft)",
          }}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span style={{ position: "absolute", right: 12, pointerEvents: "none" }}>
          <Icon name="chevronDown" size={16} color="var(--ink-3)" />
        </span>
      </div>
    </label>
  );
}
