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

/** "Today", per the desk's fixed mock anchor date (see dateAt(0) across lib/mock). */
export const TODAY_LABEL = dateAt(0);

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

// SEAM: replace with GET /api/admin/kyc?status=pending,review&sort=-waitingFor&limit=N
export function getPendingKycPanel(limit = 5): OverviewPanel<KycSubmission> {
  const queue = getKycSubmissions()
    .filter((s) => s.status === "pending" || s.status === "review")
    .sort((a, b) => waitingMinutes(b.waitingFor) - waitingMinutes(a.waitingFor));
  return { items: queue.slice(0, limit), total: queue.length };
}

// SEAM: replace with GET /api/admin/transactions/flagged?limit=N (total from
// the same endpoint's pagination metadata)
export function getFlaggedTransactionsPanel(limit = 5): OverviewPanel<FlaggedTransaction> {
  const total = TRANSACTIONS.filter((t) => t.status === "review").length;
  return { items: getFlaggedTransactions().slice(0, limit), total };
}

// ---------------------------------------------------------------------------
// Desk KPI row — total users, KYC approval rate, pending KYC, active orders.
// SEAM: replace the whole block with GET /api/admin/overview/summary
// ---------------------------------------------------------------------------

const totalUsers = USERS.length;
const approvedUsers = USERS.filter((u) => u.kycStatus === "approved").length;
const kycApprovalRatePct = totalUsers === 0 ? 0 : (approvedUsers / totalUsers) * 100;
const pendingKycTotal = getPendingKycPanel().total;
const activeOrdersCount = TRANSACTIONS.filter(
  (t) => (t.type === "Buy" || t.type === "Sell") && (t.status === "review" || t.status === "pending"),
).length;

export function getDeskSummary(): DeskSummary {
  return {
    totalUsers,
    totalUsersTrend: trend(totalUsers * 3 + 6, "new this month", 10),
    kycApprovalRate: `${kycApprovalRatePct.toFixed(1)}%`,
    kycApprovalTrend: kycApprovalRatePct >= 90 ? { label: "+1.4% vs last month", tone: "gain" } : { label: "-0.8% vs last month", tone: "loss" },
    pendingKyc: pendingKycTotal,
    pendingKycTrend: trend(pendingKycTotal * 5 + 2, "vs yesterday"),
    activeOrders: activeOrdersCount,
    activeOrdersTrend: trend(activeOrdersCount * 7 + 4, "vs yesterday"),
  };
}

// ---------------------------------------------------------------------------
// Today's transaction volume + intraday sparkline. A desk-level rollup, not
// summed client-side from TRANSACTIONS — in production this is its own
// backend aggregate (SEAM below), generated independently here.
// SEAM: replace with GET /api/admin/overview/volume-today
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
