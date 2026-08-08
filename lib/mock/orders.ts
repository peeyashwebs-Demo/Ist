import { USERS } from "@/lib/mock/users";

// ---------------------------------------------------------------------------
// Order — kept local to this file rather than added to types/api.ts. Shape
// mirrors the real API's Order exactly (see admin-api-reference.html, EX_ORDER
// fixture, cat:'orders'):
//   { id, userId, clientName, ticker, side('buy'|'sell'), units, amountKobo,
//     orderType('market'|'limit'), limitPrice, price, value, status, createdAt }
// Order Management is a narrow surface on the real backend: a market order,
// or a limit order that crosses the market price immediately, auto-fills to
// status=approved with zero staff involvement. approve/reject exist only to
// resolve a limit order the broker left status=pending because it did NOT
// cross at placement — a small stale-order cleanup queue, not a
// review-every-trade gate. status is only ever pending|approved|rejected —
// there is no review/flagged/expired state for an order.
// ---------------------------------------------------------------------------
export interface Order {
  id: string;
  userId: string;
  clientName: string;
  ticker: string;
  side: "buy" | "sell";
  units: number;
  amountKobo: number | null;
  orderType: "market" | "limit";
  limitPrice: number | null;
  price: number | null;
  value: number | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const TICKERS = ["DANGCEM", "MTNN", "GTCO", "ZENITHBANK", "BUACEMENT", "AIRTELAFRI", "NESTLE", "SEPLAT", "FBNH", "STANBIC"];

// Rough per-ticker naira price band, used only to derive plausible
// mock price/limitPrice/value figures — has no counterpart on the real API.
const PRICE_BASE: Record<string, number> = {
  DANGCEM: 410, MTNN: 205, GTCO: 58, ZENITHBANK: 41, BUACEMENT: 92,
  AIRTELAFRI: 2150, NESTLE: 1180, SEPLAT: 3400, FBNH: 27, STANBIC: 68,
};

/** Deterministic ISO timestamp, walking backward from the desk's "today"
 * anchor (14 Mar 2026, matches the rest of the mock data) by whole hours. */
function isoAt(hoursAgo: number) {
  const base = new Date(Date.UTC(2026, 2, 14, 15, 0, 0));
  base.setUTCHours(base.getUTCHours() - hoursAgo);
  return base.toISOString();
}

const ORDER_COUNT = 26;
// A small, deterministic set of rows land pending — the actual actionable
// queue. Everything else auto-filled (approved), a couple rejected as
// realistic noise (staff cleared a stale one previously).
const PENDING_INDEXES = new Set([2, 7, 13, 18, 22]);
const REJECTED_INDEXES = new Set([9, 20]);

export const ORDERS: Order[] = Array.from({ length: ORDER_COUNT }).map((_, i) => {
  const user = USERS[i % USERS.length];
  const ticker = TICKERS[i % TICKERS.length];
  const side: Order["side"] = i % 3 === 0 ? "sell" : "buy";
  const units = 50 + ((i * 37) % 950);
  const orderType: Order["orderType"] = i % 4 === 0 ? "limit" : "market";
  const base = PRICE_BASE[ticker];
  const drift = ((i * 13) % 21) - 10; // -10..+10 naira wander, deterministic
  const marketPrice = Math.max(1, base + drift);

  const isPending = PENDING_INDEXES.has(i);
  const isRejected = !isPending && REJECTED_INDEXES.has(i);
  const status: Order["status"] = isPending ? "pending" : isRejected ? "rejected" : "approved";

  // A pending row is, by definition, a limit order whose limitPrice never
  // crossed marketPrice at placement — buy sits above quote, sell sits below.
  let limitPrice: number | null = null;
  let price: number | null = marketPrice;
  if (orderType === "limit") {
    if (isPending) {
      limitPrice = side === "buy" ? marketPrice - 4 - (i % 6) : marketPrice + 4 + (i % 6);
      price = null; // never filled — no execution price yet
    } else {
      limitPrice = side === "buy" ? marketPrice + 1 + (i % 3) : marketPrice - 1 - (i % 3);
      price = marketPrice; // crossed at placement, auto-filled at market
    }
  }

  const value = price != null ? price * units : null;

  return {
    id: `ORD-${71000 + i * 5}`,
    userId: user.id,
    clientName: user.name,
    ticker,
    side,
    units,
    amountKobo: null,
    orderType,
    limitPrice,
    price,
    value,
    status,
    createdAt: isoAt(2 + i * 5),
  };
});

// SEAM: replace with GET /orders (query: page, pageSize, status —
// status enum is pending|approved|rejected). Real response shape is
// PaginatedList<Order>; this mock returns the flat array.
export function getOrders() {
  return ORDERS;
}

// SEAM: replace with GET /orders?status=pending. This is the screen's real
// queue — everything else in the order book auto-filled with zero staff
// involvement, so a full GET /orders history is not what the desk works
// from day to day.
export function getPendingOrders() {
  return ORDERS.filter((o) => o.status === "pending");
}

// SEAM: replace with GET /orders/:id. Also reachable by the investor who
// placed the order on the real API (sharedWith: investor) — irrelevant to
// this staff-only screen, noted for completeness.
export function getOrderById(id: string) {
  return ORDERS.find((o) => o.id === id);
}

// SEAM: replace with PATCH /orders/:id/approve — no request body. Marks the
// order approved and, on the real backend, applies its holding side effect
// (a buy adds units to the investor's holding, a sell reduces it). This mock
// only flips status.
export function approveOrder(id: string) {
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return undefined;
  order.status = "approved";
  return order;
}

// SEAM: replace with PATCH /orders/:id/reject, body { reason: string }
// (required, non-empty). No holding/portfolio side effect is applied. The
// real API does not persist `reason` on the Order itself — it is written
// only to the audit log — so this mock keeps it as a local param, not a
// stored field.
export function rejectOrder(id: string, reason: string) {
  void reason; // mock has nowhere to store this — see SEAM note above
  const order = ORDERS.find((o) => o.id === id);
  if (!order) return undefined;
  order.status = "rejected";
  return order;
}
