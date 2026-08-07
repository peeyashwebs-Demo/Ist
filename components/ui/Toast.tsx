"use client";

import { useEffect } from "react";
import { Icon, IconName } from "@/components/icons/Icon";
import { IconButton } from "@/components/ui/IconButton";

export type ToastTone = "error" | "success" | "default";

interface ToastProps {
  open: boolean;
  tone?: ToastTone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number;
}

const TONE_ICON: Record<ToastTone, IconName> = {
  error: "alert",
  success: "check",
  default: "bell",
};

const TONE_COLOR: Record<ToastTone, string> = {
  error: "var(--loss)",
  success: "var(--gain)",
  default: "var(--indicator)",
};

/** Shared bottom-corner toast — used for destructive/undoable actions
 * (suspend, reject, deactivate, etc). One toast on screen at a time; the
 * caller owns the open/closed state. */
export function Toast({
  open,
  tone = "default",
  title,
  message,
  actionLabel,
  onAction,
  onClose,
  duration = 6000,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 24,
        bottom: 24,
        zIndex: 200,
        width: 380,
        maxWidth: "calc(100vw - 48px)",
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-nav)",
        padding: 16,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <Icon name={TONE_ICON[tone]} size={18} color={TONE_COLOR[tone]} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ font: "var(--text-card-title)", color: "var(--ink)" }}>{title}</span>
        <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{message}</span>
        {actionLabel ? (
          <button
            type="button"
            onClick={() => {
              onAction?.();
              onClose();
            }}
            style={{
              alignSelf: "flex-start",
              marginTop: 4,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              font: "var(--text-label)",
              letterSpacing: "var(--track-label)",
              textTransform: "uppercase",
              color: "var(--indicator)",
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <IconButton icon="close" size={28} variant="bare" label="Dismiss" onClick={onClose} />
    </div>
  );
}
