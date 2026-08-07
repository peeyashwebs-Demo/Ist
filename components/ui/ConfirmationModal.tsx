"use client";

import { ReactNode, useEffect } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Purple primary by default; pass "loss" for destructive actions (suspend, deactivate, reject). */
  tone?: "default" | "loss";
  confirmDisabled?: boolean;
  width?: number;
}

/** The shared confirm-dialog shape reused across the desk: suspend/enable a
 * client, approve/reject a KYC override, deactivate a staff member. Same
 * Modal shell, different title/body/footer copy per call site. */
export function ConfirmationModal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  confirmDisabled = false,
  width = 480,
}: ConfirmationModalProps) {
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            {title}
          </span>
          <IconButton icon="close" size={32} variant="bare" label="Close" onClick={onClose} />
        </div>

        {children ? (
          <div style={{ padding: 20, font: "var(--text-body)", color: "var(--ink-2)" }}>{children}</div>
        ) : (
          <div style={{ paddingBottom: 20 }} />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: 16,
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={confirmDisabled}
            onClick={onConfirm}
            style={tone === "loss" ? { background: confirmDisabled ? "var(--ink-3)" : "var(--loss)" } : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
