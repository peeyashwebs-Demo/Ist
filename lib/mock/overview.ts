import type { DeskSummary, DeskTrend, FlaggedTransaction, KycSubmission, OverviewPanel, TodayVolume } from "@/types/api";
import { USERS } from "@/lib/mock/users";
import { getKycSubmissions } from "@/lib/mock/kyc";
import { TRANSACTIONS, getFlaggedTransactions } from "@/lib/mock/transactions";

function money(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateAt(dayOffset: number) {
  const base = new Date(Date.UTC(2026, 2, 14));
  base.setUTCDate(base.getUTCDate() - dayOffset);
  return base.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** "Today", per the desk's fixed mock anchor date (see dateAt(0) across lib/mock).
 * The design's fixed mock date is 14 March 2026 — literally captioned "Tuesday"
 * in the approved design (frame 2a), so the weekday is matched to that copy
 * rather than computed from the real calendar. */
export const TODAY_LABEL = `Tuesday, ${dateAt(0)}`;

function waitingMinutes(w: string) {
  const m = w.match(/(\d+)h\s*(\d+)m/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function trend(seed: number, unit: string, spread = 8): DeskTrend {
  const delta = (seed % spread) - Math.floor(spread / 2);
  if (delta === 0) return { label: `Flat ${unit}`, tone: "gain" };
  return { label: `${delta > 0 ? "+" : ""}${delta} ${unit}`, tone: delta >= 0 ? "gain" : "loss" };
}

// ---------------------------------------------------------------------------
// "Needs attention" panels — bounded preview + true total, like a paginated
// endpoint's own count metadata.
// ---------------------------------------------------------------------------

// SEAM: replace with GET /kyc-submissions?status=pending&pageSize=N (plus a
// second GET /kyc-submissions?status=review&pageSize=N call, merged
// client-side — the real `status` query param takes one enum value per
// call, not a list). Sort is not client-selectable either: the real
// endpoint is always ordered by submission date, most recent first, not by
// waitingFor as this preview does — resort client-side after fetching if
// the "longest waiting first" ordering still matters.
export function getPendingKycPanel(limit = 5): OverviewPanel<KycSubmission> {
  const queue = getKycSubmissions()
    .filter((s) => s.status === "pending" || s.status === "review")
    .sort((a, b) => waitingMinutes(b.waitingFor) - waitingMinutes(a.waitingFor));
  return { items: queue.slice(0, limit), total: queue.length };
}

// SEAM: no dedicated /flagged endpoint on the real API — replace with
// GET /transactions?status=flagged&pageSize=N (total from the same
// endpoint's pagination metadata). See the reconciliation note on
// getFlaggedTransactions in lib/mock/transactions.ts: the real status enum
// separates "review" from "flagged", where this mock currently treats
// status === "review" as the flagged set.
export function getFlaggedTransactionsPanel(limit = 5): OverviewPanel<FlaggedTransaction> {
  const total = TRANSACTIONS.filter((t) => t.status === "review").length;
  return { items: getFlaggedTransactions().slice(0, limit), total };
}

// ---------------------------------------------------------------------------
// Desk KPI row — total users, KYC approval rate, pending KYC, active orders.
// SEAM: replace the whole block with a single GET /desk-overview call —
// consolidating what used to be modelled here as two separate calls
// (overview/summary + overview/volume-today, see getTodayVolume below) into
// the real API's one computed snapshot endpoint. As of the current backend
// docs, GET /desk-overview's DeskOverview shape only carries AUM/queue
// fields (aumTotalKobo, awaitingReviewCount, medianDecisionSeconds,
// withdrawalsHeldTotalKobo, verifiedClientsCount, queueMixByDocType, …) —
// none of totalUsers/kycApprovalRate/pendingKyc/activeOrders exist there
// yet. A backend PR landing separately adds exactly those four fields
// (+ trends) to this same endpoint, which is what this mock's DeskSummary
// shape (types/api.ts) is modelled after; confirm that PR has merged before
// wiring this block to a live call.
// ---------------------------------------------------------------------------

const totalUsers = USERS.length;
const approvedUsers = USERS.filter((u) => u.kycStatus === "approved").length;
const kycApprovalRatePct = totalUsers === 0 ? 0 : (approvedUsers / totalUsers) * 100;
const pendingKycTotal = getPendingKycPanel().total;
const activeOrdersCount = TRANSACTIONS.filter(
  (t) => (t.type === "Buy" || t.type === "Sell") && (t.status === "review" || t.status === "pending"),
).length;

// Day-one copy — when the underlying count is zero, the design swaps the
// generic trend text for a sentence that explains the mechanism instead of
// a delta that has no meaning yet (see frame 2b).
export function getDeskSummary(): DeskSummary {
  return {
    totalUsers,
    totalUsersTrend: totalUsers === 0 ? { label: "No registrations yet", tone: "gain" } : trend(totalUsers * 3 + 6, "new this month", 10),
    kycApprovalRate: totalUsers === 0 ? "—" : `${kycApprovalRatePct.toFixed(1)}%`,
    kycApprovalTrend:
      totalUsers === 0
        ? { label: "Needs 10 decisions", tone: "gain" }
        : kycApprovalRatePct >= 90
          ? { label: "+1.4% vs last month", tone: "gain" }
          : { label: "-0.8% vs last month", tone: "loss" },
    pendingKyc: pendingKycTotal,
    pendingKycTrend: pendingKycTotal === 0 ? { label: "Queue is empty", tone: "gain" } : trend(pendingKycTotal * 5 + 2, "vs yesterday"),
    activeOrders: activeOrdersCount,
    activeOrdersTrend: activeOrdersCount === 0 ? { label: "Market opens 10:00", tone: "gain" } : trend(activeOrdersCount * 7 + 4, "vs yesterday"),
  };
}

// ---------------------------------------------------------------------------
// Today's transaction volume + intraday sparkline. A desk-level rollup, not
// summed client-side from TRANSACTIONS — in production this is its own
// backend aggregate (SEAM below), generated independently here.
// SEAM: no matching field exists on the real API. GET /desk-overview's
// closest field is aumSeries — a short historical AUM series (5 points in
// the docs' example), not an intraday per-hour transaction-volume series —
// so it is not a drop-in replacement for this sparkline's `series`. There is
// currently no backend aggregate for "today's transaction volume by hour";
// flag this as a product/backend gap, or derive a coarser version
// client-side from GET /transactions filtered to today's date (expensive,
// and loses the true hourly granularity this mock fabricates).
// ---------------------------------------------------------------------------

const VOLUME_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function getTodayVolume(): TodayVolume {
  const series = VOLUME_HOURS.map((h, i) => {
    const base = 4_200_000;
    const wave = Math.sin((i / (VOLUME_HOURS.length - 1)) * Math.PI) * 2_400_000;
    const noise = ((h * 97) % 13) * 41_000;
    return Math.round(base + wave + noise);
  });
  const total = series.reduce((sum, v) => sum + v, 0);
  const yesterday = Math.round(total * 0.91);
  const changePct = yesterday === 0 ? 0 : ((total - yesterday) / yesterday) * 100;
  return {
    amount: money(total),
    change: {
      label: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% vs yesterday`,
      tone: changePct >= 0 ? "gain" : "loss",
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Headline sentence for PageHead's description — adjusts to however many
// queues actually need a decision, including the zero-state.
// ---------------------------------------------------------------------------

export function getDeskHeadline(pendingKyc: number, flaggedTx: number): string {
  const queues: Array<{ label: string; count: number }> = [];
  if (pendingKyc > 0) queues.push({ label: "KYC", count: pendingKyc });
  if (flaggedTx > 0) queues.push({ label: "transaction", count: flaggedTx });

  if (queues.length === 0) return "Nothing needs a decision today. The desk is clear.";
  if (queues.length === 1) {
    const q = queues[0];
    return `${q.count} ${q.label} case${q.count === 1 ? "" : "s"} need${q.count === 1 ? "s" : ""} a decision today. Everything else is clear.`;
  }
  return "Two queues need a decision today. Everything else is clear.";
}
