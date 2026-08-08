"use client";

import { ReactNode, useEffect } from "react";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  /** Footer action row — cancel + confirm buttons, hairline-separated. */
  footer?: ReactNode;
  width?: number;
}

/** Shared modal shell (scrim + panel). Motion is a transform-only enter at
 * var(--dur-slow) — no opacity fade, nothing bounces. */
export function Modal({ open, title, onClose, children, footer, width = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          background: "var(--paper)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-nav)",
          display: "flex",
          flexDirection: "column",
          animation: "k-modal-in var(--dur-slow) var(--ease-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{title}</span>
          <IconButton icon="close" size={32} variant="bare" label="Close" onClick={onClose} />
        </div>

        {children ? <div style={{ padding: 20, font: "var(--text-body)", color: "var(--ink-2)" }}>{children}</div> : null}

        {footer ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid var(--hairline)" }}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
