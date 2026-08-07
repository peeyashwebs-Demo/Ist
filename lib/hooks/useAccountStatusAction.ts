import { useRef, useState } from "react";
import { CURRENT_STAFF } from "@/lib/mock/staff";
import type { AccountStatus, User } from "@/types/api";

export const SUSPEND_REASONS = [
  "Suspicious deposit pattern",
  "Failed re-verification",
  "Client request",
  "Regulator instruction",
  "Chargeback dispute",
];

export interface SuspensionRecord {
  reason: string;
  staffName: string;
  at: string;
  openOrdersCancelled: number;
}

export interface AccountToastState {
  tone: "error" | "success";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function nowLabel() {
  const d = new Date();
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Owns the suspend/enable mock mutation for a single client, isolated from
 * page render logic so the local-state toggle here can be swapped for a real
 * POST /api/admin/users/:id/suspend | /enable call later without touching
 * the page's layout/JSX. */
export function useAccountStatusAction(user: User | null) {
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [suspension, setSuspension] = useState<SuspensionRecord | null>(null);
  const [modal, setModal] = useState<"suspend" | "enable" | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<AccountToastState | null>(null);

  // Reset local mock state whenever we land on a different client — adjusted
  // during render (React's recommended pattern for "reset state when a prop
  // changes"), so it never fights the effect-based setState lint rule.
  const lastUserId = useRef<string | null | undefined>(undefined);
  if (user?.id !== lastUserId.current) {
    lastUserId.current = user?.id ?? null;
    if (accountStatus !== null || suspension !== null || modal !== null || reason !== "" || toast !== null) {
      setAccountStatus(null);
      setSuspension(null);
      setModal(null);
      setReason("");
      setToast(null);
    }
  }

  function openSuspendModal() {
    setReason("");
    setModal("suspend");
  }

  function openEnableModal() {
    setModal("enable");
  }

  function closeModal() {
    setModal(null);
  }

  function confirmSuspend() {
    if (!user || !reason) return;
    // SEAM: replace with POST /api/admin/users/:id/suspend { reason }
    const openOrdersCancelled = user.transactions.filter(
      (t) => (t.type === "Buy" || t.type === "Sell") && t.status === "review",
    ).length;
    setAccountStatus("suspended");
    setSuspension({ reason, staffName: CURRENT_STAFF.name, at: nowLabel(), openOrdersCancelled });
    setModal(null);
    setToast({
      tone: "error",
      title: "Account suspended",
      message: `${user.name} can no longer trade or sign in. The client has been emailed.`,
      actionLabel: "Undo",
      onAction: () => doEnable(),
    });
  }

  function doEnable() {
    if (!user) return;
    // SEAM: replace with POST /api/admin/users/:id/enable
    setAccountStatus("active");
    setSuspension(null);
  }

  function confirmEnable() {
    if (!user) return;
    doEnable();
    setModal(null);
    setToast({
      tone: "success",
      title: "Account enabled",
      message: `${user.name} can trade and sign in again.`,
    });
  }

  function dismissToast() {
    setToast(null);
  }

  return {
    accountStatus,
    suspension,
    modal,
    reason,
    setReason,
    toast,
    openSuspendModal,
    openEnableModal,
    closeModal,
    confirmSuspend,
    confirmEnable,
    dismissToast,
  };
}
