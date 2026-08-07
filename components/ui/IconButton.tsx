"use client";

import { ButtonHTMLAttributes } from "react";
import { Icon, IconName } from "@/components/icons/Icon";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  size?: number;
  variant?: "solid" | "bare" | "float";
  label: string;
}

/** Circular icon action — white + hairline; `float` adds the soft shadow. */
export function IconButton({ icon, size = 40, variant = "solid", label, style, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        background: variant === "bare" ? "transparent" : "var(--paper)",
        border: `1px solid ${variant === "bare" ? "transparent" : "var(--hairline)"}`,
        borderRadius: "50%",
        cursor: "pointer",
        padding: 0,
        boxShadow: variant === "float" ? "var(--shadow-float)" : "none",
        transition: "transform var(--dur-fast) var(--ease-soft)",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color="var(--ink)" />
    </button>
  );
}
