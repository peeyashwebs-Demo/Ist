import { InputHTMLAttributes } from "react";
import { Icon } from "@/components/icons/Icon";

interface SearchPillProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
}

const HEIGHT: Record<NonNullable<SearchPillProps["size"]>, number> = { md: 36, sm: 32 };

/** Search input in a hairline pill — the shared filter-bar search control. */
export function SearchPill({ value, onChange, placeholder = "Search", size = "md", style, ...rest }: SearchPillProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: HEIGHT[size],
        minWidth: 240,
        background: "var(--bg)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-pill)",
        padding: "0 14px",
        ...style,
      }}
    >
      <Icon name="search" size={16} color="var(--ink-3)" />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          background: "transparent",
          outline: "none",
          font: "var(--text-body)",
          color: "var(--ink)",
        }}
      />
    </span>
  );
}
