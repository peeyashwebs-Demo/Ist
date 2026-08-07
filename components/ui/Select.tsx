import { SelectHTMLAttributes } from "react";
import { Icon } from "@/components/icons/Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  size?: "sm" | "md";
  "aria-label": string;
}

const HEIGHT: Record<NonNullable<SelectProps["size"]>, number> = { md: 36, sm: 32 };

/** Hairline-bordered filter select — paired chevron, no native arrow. */
export function Select({ value, onChange, options, size = "md", style, ...rest }: SelectProps) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: HEIGHT[size],
      }}
    >
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          height: "100%",
          padding: "0 32px 0 12px",
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-input)",
          font: "var(--text-body)",
          color: "var(--ink)",
          cursor: "pointer",
          ...style,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span style={{ position: "absolute", right: 10, pointerEvents: "none", display: "flex" }}>
        <Icon name="chevronDown" size={14} color="var(--ink-3)" />
      </span>
    </span>
  );
}
