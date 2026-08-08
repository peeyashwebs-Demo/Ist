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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const TX_COUNT = 48;

export const TRANSACTIONS: Transaction[] = Array.from({ length: TX_COUNT }).map((_, i) => {
  const user = USERS[i % USERS.length];
  const type = TYPES[i % TYPES.length];
  const isOrder = type === "Buy" || type === "Sell";
  const asset = isOrder ? ASSETS[i % (ASSETS.length - 2)] : "—";
  const amount = 12000 + ((i * 54831) % 900000);
  const units = isOrder ? 100 + ((i * 37) % 900) : undefined;
  const unitPrice = units ? amount / units : undefined;
  const tone: Transaction["tone"] = type === "Withdrawal" || type === "Buy" ? "loss" : "gain";
  const held = i % 8 === 0;
  const failed = !held && i % 13 === 0;
  const pendingSettle = !held && !failed && i % 6 === 0;

  const status: Transaction["status"] = held ? "review" : failed ? "rejected" : pendingSettle ? "pending" : "approved";
  const statusLabel = held ? "Held" : failed ? "Failed" : pendingSettle ? "Pending" : "Settled";

  const day = 1 + (i % 14);
  const hour = 9 + (i % 8);
  const minute = (i * 17) % 60;
  const on = `2026-03-${pad(day)}`;

  const statusHistory: TransactionStatusEvent[] | undefined = held
    ? [
        { label: "Submitted", when: timeAt(hour, minute), by: user.name },
        { label: "Flagged for review", when: timeAt(hour, minute + 2), by: "Risk engine" },
      ]
    : undefined;

  return {
    id: `TRX-${90000 + i * 11}`,
    userId: user.id,
    userName: user.name,
    type,
    asset,
    units: units != null ? units.toLocaleString("en-NG") : undefined,
    unitPrice: unitPrice != null ? `₦${unitPrice.toFixed(2)}` : undefined,
    amount: `${tone === "gain" ? "+" : "−"}${money(amount)}`,
    tone,
    status,
    statusLabel,
    when: `${timeAt(hour, minute)} · ${day} Mar 2026`,
    on,
    orderId: type === "Buy" || type === "Sell" ? `ORD-${71000 + i * 5}` : `PAY-${53000 + i * 5}`,
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

// SEAM: replace with GET /transactions (query: page, pageSize, type, status —
// type enum is fund|withdraw|buy|sell|convert, status enum is
// pending|review|flagged|approved|rejected|completed|failed)
export function getTransactions() {
  return TRANSACTIONS;
}

// SEAM: replace with GET /transactions/:id
export function getTransactionById(id: string) {
  return TRANSACTIONS.find((t) => t.id === id);
}

// SEAM: no dedicated /flagged endpoint on the real API — replace with
// GET /transactions?status=flagged&pageSize=N. Note the real status enum
// has both "review" (a staff-initiated compliance hold, see txn-hold) and a
// separate "flagged" value — this mock currently treats status === "review"
// as the "flagged" panel's source, which is worth reconciling against the
// real distinction when this is wired live.
export function getFlaggedTransactions() {
  return FLAGGED_TRANSACTIONS;
}

// ---------------------------------------------------------------------------
// Transaction detail (screen 6d) — held-withdrawal breakdown, counterparty,
// status timeline and "this client's recent activity". Derived from the
// transaction's own fields rather than stored separately, since the mock
// Transaction shape (types/api.ts) carries no dedicated detail-view fields
// beyond what's already on the row.
// ---------------------------------------------------------------------------

function amountToNumber(a: string) {
  const sign = a.startsWith("−") || a.startsWith("-") ? -1 : 1;
  return sign * parseFloat(a.replace(/[^\d.]/g, ""));
}

/** Held-transaction rule code + plain-English explanation, keyed off the
 * same HOLD_REASONS copy the row generator assigns. Mirrors the design's
 * "Held by rule W-04 · above the Tier 2 daily payout limit of ₦1,000,000.00" pattern. */
const HOLD_RULE_DETAIL: Record<string, { code: string; explain: (t: Transaction) => string }> = {
  "Above tier limit": {
    code: "W-04",
    explain: (t) =>
      t.type === "Withdrawal"
        ? "above the Tier 2 daily payout limit of ₦1,000,000.00"
        : t.type === "Deposit"
          ? "above the Tier 2 daily deposit limit of ₦2,000,000.00"
          : "above the Tier 2 daily trading limit of ₦2,000,000.00",
  },
  "New device · first withdrawal": {
    code: "W-07",
    explain: () => "the first withdrawal attempted from a new, unrecognised device",
  },
  "Velocity rule · 3 in 24h": {
    code: "W-11",
    explain: () => "3 or more withdrawals submitted within a 24-hour window",
  },
  "Destination account unverified": {
    code: "W-15",
    explain: () => "the destination account has not completed verification",
  },
  "Round-trip pattern flagged": {
    code: "W-19",
    explain: () => "a deposit-and-withdraw round-trip pattern on this account",
  },
};

export function getHoldingRuleDetail(t: Transaction): { code: string; message: string } | undefined {
  if (!t.holdingRule) return undefined;
  const rule = HOLD_RULE_DETAIL[t.holdingRule];
  if (!rule) return { code: "W-00", message: t.holdingRule };
  return { code: rule.code, message: rule.explain(t) };
}

function pseudoFee(t: Transaction) {
  const amt = Math.abs(amountToNumber(t.amount));
  return money(Math.min(500, Math.max(25, amt * 0.00003)));
}

function absAmount(t: Transaction) {
  return t.amount.replace(/^[-−+]/, "");
}

/** "10:42 · 14 Mar 2026" (as stored) → "14 Mar 2026 · 10:42" (as designed). */
function dateTimeFirst(when: string) {
  const [time, date] = when.split(" · ");
  return `${date} · ${time}`;
}

export function getTransactionFacts(t: Transaction): { label: string; value: string }[] {
  const isOrder = t.type === "Buy" || t.type === "Sell";
  return [
    { label: "Reference", value: t.id },
    {
      label: "Type",
      value: isOrder
        ? `${t.type} · ${t.asset}${t.units ? ` · ${t.units} @ ${t.unitPrice}` : ""}`
        : `${t.type} · naira wallet`,
    },
    { label: "Amount", value: absAmount(t) },
    { label: "Fee", value: pseudoFee(t) },
    { label: "Requested", value: dateTimeFirst(t.when) },
    { label: "Related order", value: t.orderId ?? "—" },
  ];
}

export function getCounterpartyFacts(t: Transaction): { label: string; value: string }[] {
  if (t.counterparty) {
    const [bank, account] = t.counterparty.split(" · ");
    const priorSameType = TRANSACTIONS.filter(
      (o) => o.userId === t.userId && o.id !== t.id && o.type === t.type && o.status === "approved" && o.on <= t.on,
    );
    const priorSum = priorSameType.reduce((s, o) => s + Math.abs(amountToNumber(o.amount)), 0);
    return [
      { label: "Beneficiary", value: t.userName },
      { label: "Bank", value: bank ?? "—" },
      { label: "Account", value: account ?? "—" },
      { label: "Added", value: "9 Mar 2026 · 5 days ago" },
      { label: "Prior payouts", value: `${priorSameType.length} · ${money(priorSum)}` },
    ];
  }
  return [
    { label: "Beneficiary", value: t.userName },
    { label: "Account holder", value: t.userId },
    { label: "Prior transactions", value: `${TRANSACTIONS.filter((o) => o.userId === t.userId && o.id !== t.id).length} on record` },
  ];
}

export function getTransactionTimeline(t: Transaction): { when: string; what: string; who: string }[] {
  const [, date] = t.when.split(" · ");
  if (t.statusHistory && t.statusHistory.length) {
    return t.statusHistory.map((event) => ({
      when: `${date} · ${event.when}`,
      what: event.label,
      who: event.by ?? "System",
    }));
  }
  return [
    { when: dateTimeFirst(t.when), what: `${t.type} submitted`, who: t.userName },
    { when: dateTimeFirst(t.when), what: `Marked ${t.statusLabel.toLowerCase()}`, who: "System" },
  ];
}

// SEAM: the real API has no per-user transaction filter today — GET
// /transactions accepts page/pageSize/type/status only, no userId. Per the
// admin-scoped userId-filter PR landing separately, this becomes
// GET /transactions?userId=:id once that ships (working assumption — confirm
// the final param name when that PR merges). There is no `exclude` param
// documented either way; filter the current transaction out client-side
// after fetching, as this mock does.
export function getClientRecentTransactions(t: Transaction, limit = 6) {
  return TRANSACTIONS.filter((o) => o.userId === t.userId && o.id !== t.id)
    .sort((a, b) => (a.on + a.when < b.on + b.when ? 1 : -1))
    .slice(0, limit);
}

// SEAM: replace with PATCH /transactions/:id/release — no request body on
// the real endpoint. The `reason` param here is dashboard-only journaling
// text for the timeline entry, not something the real call accepts; the
// hold's original reason (already on holdingRule, set at txn-hold time) is
// what compliance actually sees. Also note the real release has a special
// case: releasing a withdrawal that was auto-held for exceeding the tier
// limit fires a deferred Flutterwave transfer and can land on pending or
// failed instead of a bare approved — this mock always settles to approved.
export function releaseTransaction(id: string, reason: string, staffName: string) {
  const tx = TRANSACTIONS.find((t) => t.id === id);
  if (!tx) return undefined;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  tx.status = "approved";
  tx.statusLabel = "Settled";
  tx.statusHistory = [
    ...(tx.statusHistory ?? []),
    { label: `Payout released · ${reason}`, when: time, by: staffName },
  ];
  return tx;
}
