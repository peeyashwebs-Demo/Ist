"use client";

import { Icon } from "@/components/icons/Icon";

interface SearchPillProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
}

/** Recessed search field — pill radius, search glyph, ink text. Used for
 * searching users / transactions from a table toolbar. */
export function SearchPill({ value, onChange, placeholder = "Search", width = 220 }: SearchPillProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 14px",
        width,
        background: "var(--bg)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-pill)",
        transition: "border-color var(--dur-fast) var(--ease-soft), background var(--dur-fast) var(--ease-soft)",
      }}
    >
      <Icon name="search" size={15} color="var(--ink-3)" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          width: "100%",
          font: "var(--text-data)",
          color: "var(--ink)",
        }}
      />
    </label>
  );
}
