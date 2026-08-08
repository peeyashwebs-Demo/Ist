"use client";

import { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  hint?: string;
}

/** Square checkbox — hairline border, 6px radius, purple fill when checked
 * (the one accent moment per row/group). */
export function Checkbox({ checked, onChange, label, hint }: CheckboxProps) {
  return (
    <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <span
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        style={{
          width: 18,
          height: 18,
          flex: "0 0 auto",
          marginTop: 1,
          display: "grid",
          placeItems: "center",
          background: checked ? "var(--indicator)" : "var(--paper)",
          border: `1px solid ${checked ? "var(--indicator)" : "var(--hairline)"}`,
          borderRadius: 6,
          transition: "background var(--dur-fast) var(--ease-soft), border-color var(--dur-fast) var(--ease-soft)",
        }}
      >
        {checked ? <Icon name="check" size={12} stroke={2.4} color="var(--feature-ink)" /> : null}
      </span>
      {label || hint ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label ? <span style={{ font: "var(--text-body)", color: "var(--ink)" }}>{label}</span> : null}
          {hint ? <span style={{ font: "var(--text-micro)", color: "var(--ink-3)" }}>{hint}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
