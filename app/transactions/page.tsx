"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/types/api";
import { getTransactions } from "@/lib/mock/transactions";
import { useMockLoading } from "@/lib/useMockLoading";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/ui/PageHead";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SkeletonTable, SkeletonCard } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";

const PER_PAGE = 12;
const TODAY = "2026-03-14";
const YESTERDAY = "2026-03-13";

type TypeFilter = "all" | Transaction["type"];
type StatusFilter = "all" | Transaction["status"];
type DatePreset = "today" | "7" | "30" | "all";

const TYPE_OPTIONS = [
  { value: "all" as TypeFilter, label: "All types" },
  { value: "Buy", label: "Buy" },
  { value: "Sell", label: "Sell" },
  { value: "Deposit", label: "Deposit" },
  { value: "Withdrawal", label: "Withdrawal" },
];

// Order matches the design's monitorBar options exactly: All statuses,
// Settled, Pending, Held, Failed.
const STATUS_OPTIONS = [
  { value: "all" as StatusFilter, label: "All statuses" },
  { value: "approved", label: "Settled" },
  { value: "pending", label: "Pending" },
  { value: "review", label: "Held" },
  { value: "rejected", label: "Failed" },
];

const DATE_OPTIONS = [
  { value: "today" as DatePreset, label: "Today" },
  { value: "7" as DatePreset, label: "Last 7 days" },
  { value: "30" as DatePreset, label: "Last 30 days" },
  { value: "all" as DatePreset, label: "1–14 Mar 2026" },
];

// Fixed mock anchor date is 14 Mar 2026 (Tuesday) — matches design frame 6a's
// PageHead eyebrow. 6c's "no matches" frame shows the eyebrow as the active
// range instead, so the eyebrow tracks whichever date preset is selected.
const EYEBROW: Record<DatePreset, string> = {
  today: "Tuesday, 14 March 2026",
  "7": "8–14 March 2026",
  "30": "13 February – 14 March 2026",
  all: "1–14 March 2026",
};

const TYPE_PLURAL: Record<Transaction["type"], string> = {
  Buy: "buys",
  Sell: "sells",
  Deposit: "deposits",
  Withdrawal: "withdrawals",
  Convert: "converts",
};

const STATUS_WORD: Record<Exclude<StatusFilter, "all">, string> = {
  approved: "settled",
  pending: "pending",
  review: "held",
  rejected: "failed",
  completed: "completed",
};

const DATE_CLAUSE: Record<DatePreset, string> = {
  today: "today",
  "7": "in the last 7 days",
  "30": "in the last 30 days",
  all: "between 1 and 14 Mar 2026",
};

function statusPill(t: Transaction) {
  return <StatusPill status={t.status} label={t.statusLabel} size="sm" />;
}

function amountToNumber(a: string) {
  const sign = a.startsWith("−") || a.startsWith("-") ? -1 : 1;
  return sign * parseFloat(a.replace(/[^\d.]/g, ""));
}

function fmtNaira(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Abbreviates to the design's "₦482.61M" style once a figure clears ₦1M;
 * smaller sums (this mock's actual scale) print in full. */
function compactNaira(n: number) {
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return fmtNaira(n);
}

function buildEmptyMessage(type: TypeFilter, status: StatusFilter, date: DatePreset, query: string) {
  const typeWord = type !== "all" ? TYPE_PLURAL[type as Transaction["type"]] : "transactions";
  const statusWord = status !== "all" ? STATUS_WORD[status as Exclude<StatusFilter, "all">] : "";
  const subject = statusWord ? `${statusWord} ${typeWord}` : typeWord;
  const queryClause = query.trim() ? ` for "${query.trim()}"` : "";
  return `No ${subject}${queryClause} ${DATE_CLAUSE[date]}. Widen the date range or clear the status filter.`;
}

function NoMatches({ message, onClear, onResetToday }: { message: string; onClear: () => void; onResetToday: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0", textAlign: "center", maxWidth: 380 }}>
      <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>No transactions match these filters</span>
      <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{message}</span>
      <span style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "center" }}>
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
        <Button variant="ghost" size="sm" iconLeft="refresh" onClick={onResetToday}>
          Reset to today
        </Button>
      </span>
    </div>
  );
}

export default function TransactionsPage() {
  const router = useRouter();
  const loading = useMockLoading();

  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [date, setDate] = useState<DatePreset>("today");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"client" | "on" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // SEAM: replace with GET /api/admin/transactions
  const transactions = useMemo(() => getTransactions(), []);

  const clearFilters = () => {
    setType("all");
    setStatus("all");
    setQuery("");
    setDate("all");
    setPage(1);
  };

  const resetToToday = () => {
    setDate("today");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = transactions;

    if (type !== "all") list = list.filter((t) => t.type === type);
    if (status !== "all") list = list.filter((t) => t.status === status);
    if (date === "today") list = list.filter((t) => t.on === TODAY);
    if (date === "7") list = list.filter((t) => t.on >= "2026-03-08");
    if (date === "30") list = list.filter((t) => t.on >= "2026-02-13");
    if (q) list = list.filter((t) => t.userName.toLowerCase().includes(q) || t.userId.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));

    return list;
  }, [transactions, type, status, date, query]);

  const sortableList = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      if (!sortKey) return 0;
      let av: string, bv: string;
      if (sortKey === "client") {
        av = a.userName;
        bv = b.userName;
      } else {
        const at = a.on + a.when.split(" · ")[0];
        const bt = b.on + b.when.split(" · ")[0];
        av = at;
        bv = bt;
      }
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortableList.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const rows = sortableList.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const stats = useMemo(() => {
    const todayTx = transactions.filter((t) => t.on === TODAY);
    const yestTx = transactions.filter((t) => t.on === YESTERDAY);
    const gross = (list: Transaction[]) => list.reduce((s, t) => s + Math.abs(amountToNumber(t.amount)), 0);
    const volToday = gross(todayTx);
    const volYest = gross(yestTx);
    const pct = volYest ? ((volToday - volYest) / volYest) * 100 : 0;

    const ordersLiveToday = todayTx.filter((t) => (t.type === "Buy" || t.type === "Sell") && t.status !== "approved").length;

    const held = transactions.filter((t) => t.status === "review");
    const heldValue = held.reduce((s, t) => s + Math.abs(amountToNumber(t.amount)), 0);
    const aboveTier = held.filter((t) => t.holdingRule === "Above tier limit").length;

    const failedToday = todayTx.filter((t) => t.status === "rejected").length;
    const failedYest = yestTx.filter((t) => t.status === "rejected").length;
    const failedDiff = failedToday - failedYest;

    return {
      volToday,
      pct,
      txToday: todayTx.length,
      ordersLiveToday,
      heldCount: held.length,
      heldValue,
      aboveTier,
      failedToday,
      failedDiff,
    };
  }, [transactions]);

  const exportCsv = () => {
    const header = ["Reference", "Client", "User ID", "Type", "Asset", "Units", "Unit price", "Amount", "Status", "Timestamp"];
    const lines = sortableList.map((t) => [
      t.id,
      t.userName,
      t.userId,
      t.type,
      t.asset === "—" ? "—" : `${t.asset} · ${t.units ?? ""} @ ${t.unitPrice ?? ""}`,
      t.units ?? "",
      t.unitPrice ?? "",
      t.amount,
      t.statusLabel,
      t.when,
    ]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key as "client" | "on"); setSortDir("asc"); }
  };

  const GRID = "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)";

  const columns: DataTableColumn<Transaction>[] = [
    { key: "client", label: "Client", sortable: true, render: (t) => <TwoLineCell primary={t.userName} secondary={t.userId} /> },
    { key: "type", label: "Type", render: (t) => t.type },
    { key: "asset", label: "Asset", render: (t) => t.asset === "—" ? "—" : <span className="k-tnum">{`${t.asset} · ${t.units} @ ${t.unitPrice}`}</span> },
    { key: "id", label: "Reference", render: (t) => <span className="k-tnum">{t.id}</span> },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (t) => (
        <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: t.tone === "gain" ? "var(--gain)" : "var(--loss)" }}>
          {t.amount}
        </span>
      ),
    },
    { key: "status", label: "Status", render: statusPill },
    { key: "on", label: "Timestamp", align: "right", sortable: true, render: (t) => <span className="k-tnum">{t.when}</span> },
  ];

  // Toolbar order matches the design's monitorBar exactly: search first,
  // then type/status/date filters, then the CSV export pinned right.
  const toolbar = (
    <>
      <SearchPill value={query} onChange={setQuery} placeholder="Search client or reference" width={260} />
      <Select aria-label="Filter by type" value={type} onChange={(v) => setType(v as TypeFilter)} height={36} width={150} options={TYPE_OPTIONS} />
      <Select aria-label="Filter by status" value={status} onChange={(v) => setStatus(v as StatusFilter)} height={36} width={160} options={STATUS_OPTIONS} />
      <Select aria-label="Filter by date" value={date} onChange={(v) => setDate(v as DatePreset)} height={36} width={176} options={DATE_OPTIONS} />
      <div style={{ marginLeft: "auto" }}>
        <Button variant="secondary" size="sm" iconLeft="download" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
    </>
  );

  return (
    <>
      <PageHead
        eyebrow={EYEBROW[date]}
        title="Transactions and orders"
        description="Every buy, sell, deposit and withdrawal across the book. Held rows are waiting on the desk."
      />

      {loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
          <SkeletonTable rows={8} cols={7} />
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
            <StatCard
              label="Volume today"
              value={compactNaira(stats.volToday)}
              sub={`${stats.pct >= 0 ? "+" : "−"}${Math.abs(stats.pct).toFixed(2)}% vs yesterday`}
              subTone={stats.pct >= 0 ? "gain" : "loss"}
            />
            <StatCard
              label="Transactions today"
              value={String(stats.txToday)}
              sub={`${stats.ordersLiveToday} orders live`}
              subTone="neutral"
            />
            <StatCard
              label="Held for review"
              value={`${stats.heldCount} · ${compactNaira(stats.heldValue)}`}
              sub={`${stats.aboveTier} above tier limit`}
              subTone={stats.aboveTier > 0 ? "loss" : "neutral"}
            />
            <StatCard
              label="Failed today"
              value={String(stats.failedToday)}
              sub={`${stats.failedDiff > 0 ? "+" : stats.failedDiff < 0 ? "−" : "±"}${Math.abs(stats.failedDiff)} vs yesterday`}
              subTone={stats.failedDiff <= 0 ? "gain" : "loss"}
            />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(t) => t.id}
            sortKey={sortKey ?? undefined}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={(t) => router.push(`/transactions/${t.id}`)}
            empty={<NoMatches message={buildEmptyMessage(type, status, date, query)} onClear={clearFilters} onResetToday={resetToToday} />}
            toolbar={toolbar}
            gridTemplateColumns={GRID}
            footer={
              sortableList.length > PER_PAGE ? (
                <Pagination page={safePage} pageCount={pageCount} total={sortableList.length} perPage={PER_PAGE} onChange={setPage} />
              ) : null
            }
          />
        </>
      )}
    </>
  );
}
