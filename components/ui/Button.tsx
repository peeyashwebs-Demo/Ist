"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, IconName } from "@/components/icons/Icon";

type Variant = "primary" | "secondary" | "ghost";
type Size = "lg" | "md" | "sm";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  type?: "button" | "submit" | "reset";
}

const HEIGHT: Record<Size, number> = { lg: 50, md: 44, sm: 36 };
const PAD_X: Record<Size, number> = { lg: 20, md: 18, sm: 14 };
const FONT_SIZE: Record<Size, number> = { lg: 15, md: 14, sm: 13 };

/** Primary is the one purple moment per view. Secondary/ghost carry everything else. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  const blocked = disabled || loading;
  let bg = "transparent";
  let fg = "var(--ink)";
  let border = "transparent";

  if (variant === "primary") {
    bg = disabled ? "var(--ink-3)" : "var(--indicator)";
    fg = "var(--feature-ink)";
  } else if (variant === "secondary") {
    bg = "var(--paper)";
    fg = disabled ? "var(--ink-3)" : "var(--ink)";
    border = "var(--hairline)";
  } else {
    fg = disabled ? "var(--ink-3)" : "var(--ink)";
  }

  const fontSize = FONT_SIZE[size];

  return (
    <button
      type={type}
      disabled={blocked}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        height: HEIGHT[size],
        padding: `0 ${PAD_X[size]}px`,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: "var(--r-button)",
        font: "var(--text-card-title)",
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: `${(-0.01 * fontSize).toFixed(2)}px`,
        fontFamily: "var(--font-core)",
        cursor: blocked ? "not-allowed" : "pointer",
        position: "relative",
        transition: "transform var(--dur-fast) var(--ease-soft), background var(--dur-fast) var(--ease-soft)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: loading ? 0 : 1 }}>
        {iconLeft ? <Icon name={iconLeft} size={18} color={fg} /> : null}
        {children}
        {iconRight ? <Icon name={iconRight} size={18} color={fg} /> : null}
      </span>
    </button>
  );
}
