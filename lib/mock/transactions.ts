import type { FlaggedTransaction, Transaction, TransactionStatusEvent } from "@/types/api";
import { USERS } from "@/lib/mock/users";

const TYPES: Transaction["type"][] = ["Buy", "Sell", "Deposit", "Withdrawal"];
const ASSETS = ["DANGCEM", "MTNN", "GTCO", "ZENITHBANK", "BUACEMENT", "AIRTELAFRI", "—", "—"];
const HOLD_REASONS = [
  "Above tier limit",
  "New device · first withdrawal",
  "Velocity rule · 3 in 24h",
  "Destination account unverified",
  "Round-trip pattern flagged",
];

function money(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAt(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TX_COUNT = 48;

export const TRANSACTIONS: Transaction[] = Array.from({ length: TX_COUNT }).map((_, i) => {
  const user = USERS[i % USERS.length];
  const type = TYPES[i % TYPES.length];
  const asset = type === "Buy" || type === "Sell" ? ASSETS[i % (ASSETS.length - 2)] : "—";
  const amount = 12000 + ((i * 54831) % 900000);
  const tone: Transaction["tone"] = type === "Withdrawal" || type === "Buy" ? "loss" : "gain";
  const held = i % 8 === 0;
  const failed = !held && i % 13 === 0;
  const pendingSettle = !held && !failed && i % 6 === 0;

  const status: Transaction["status"] = held ? "review" : failed ? "rejected" : pendingSettle ? "pending" : "approved";
  const statusLabel = held ? "Held" : failed ? "Failed" : pendingSettle ? "Pending" : "Settled";

  const statusHistory: TransactionStatusEvent[] | undefined = held
    ? [
        { label: "Submitted", when: timeAt(9 + (i % 6), (i * 11) % 60), by: user.name },
        { label: "Flagged for review", when: timeAt(9 + (i % 6), ((i * 11) % 60) + 2), by: "Risk engine" },
      ]
    : undefined;

  return {
    id: `TRX-${90000 + i * 11}`,
    userId: user.id,
    userName: user.name,
    type,
    asset,
    amount: `${tone === "gain" ? "+" : "-"}${money(amount)}`,
    tone,
    status,
    statusLabel,
    when: `${timeAt(9 + (i % 8), (i * 17) % 60)} · ${1 + (i % 14)} Mar 2026`,
    counterparty: held ? `${["GTBank", "Access Bank", "Zenith Bank", "UBA", "First Bank"][i % 5]} · ****${1000 + (i * 7) % 9000}` : undefined,
    holdingRule: held ? HOLD_REASONS[i % HOLD_REASONS.length] : undefined,
    statusHistory,
  };
});

export const FLAGGED_TRANSACTIONS: FlaggedTransaction[] = TRANSACTIONS.filter((t) => t.status === "review")
  .slice(0, 6)
  .map((t) => ({
    client: t.userName,
    meta: `${t.id} · ${t.type} · ${t.when.split(" · ")[0]}`,
    amount: t.amount,
    reason: t.holdingRule ?? "Above tier limit",
  }));

// SEAM: replace with GET /api/admin/transactions
export function getTransactions() {
  return TRANSACTIONS;
}

// SEAM: replace with GET /api/admin/transactions/:id
export function getTransactionById(id: string) {
  return TRANSACTIONS.find((t) => t.id === id);
}

// SEAM: replace with GET /api/admin/transactions/flagged
export function getFlaggedTransactions() {
  return FLAGGED_TRANSACTIONS;
}
