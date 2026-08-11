"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiTransaction, ApiTransactionStatus, ApiTransactionType } from "@/lib/api/types";
import { listTransactions, listUsers, ApiError } from "@/lib/api/client";
import { StatusPill, type Status } from "@/components/ui/StatusPill";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/ui/PageHead";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SkeletonTable, SkeletonCard } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { signedKoboToNaira, koboToNaira } from "@/lib/money";

const PER_PAGE = 12;
// Cap for the separate "stats" fetch below — the monitor's headline numbers
// are computed server-side totals over a bounded page; real volumes larger
// than this only understate "today"/"held", never crash.
const STATS_CAP = 500;
// Cap for resolving transaction userId -> client name/email.
const LOOKUP_CAP = 500;

type TypeFilter = "all" | ApiTransactionType;
type StatusFilter = "all" | ApiTransactionStatus;
type DatePreset = "today" | "7" | "30" | "all";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "fund", label: "Deposit" },
  { value: "withdraw", label: "Withdrawal" },
  { value: "convert", label: "Convert" },
];

// All 7 real statuses — wider than the mock's 4-value set. Labels follow the
// design's monitorBar copy where one exists (settled/held/failed).
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Settled" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "review", label: "Held" },
  { value: "flagged", label: "Flagged" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

// "failed" isn't a StatusPill tone — render it as rejected-coloured with the
// design's "Failed" label. approved renders as "Settled", completed as-is.
const STATUS_PILL: Record<ApiTransactionStatus, { status: Status; label: string }> = {
  pending: { status: "pending", label: "Pending" },
  review: { status: "review", label: "Held" },
  flagged: { status: "flagged", label: "Flagged" },
  approved: { status: "approved", label: "Settled" },
  completed: { status: "completed", label: "Completed" },
  rejected: { status: "rejected", label: "Rejected" },
  failed: { status: "rejected", label: "Failed" },
};

const TYPE_LABEL: Record<ApiTransactionType, string> = {
  fund: "Deposit",
  withdraw: "Withdrawal",
  buy: "Buy",
  sell: "Sell",
  convert: "Convert",
};

function statusPill(t: ApiTransaction) {
  const pill = STATUS_PILL[t.status] ?? STATUS_PILL.pending;
  return <StatusPill status={pill.status} label={pill.label} size="sm" />;
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${time} · ${date}`;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

/** Date windows computed against "now" — no fixed mock anchor. */
function datePresetWindow(preset: DatePreset) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return { min: startOfToday, max: now };
  if (preset === "7") return { min: new Date(startOfToday.getTime() - 6 * 86400000), max: now };
  if (preset === "30") return { min: new Date(startOfToday.getTime() - 29 * 86400000), max: now };
  return { min: new Date(0), max: now };
}

/** Abbreviates to the design's "₦482.61M" style once a figure clears ₦1M;
 * smaller sums print in full. The input is integer kobo, so the naira figure
 * is kobo/100 and the "M" threshold is ₦1,000,000 (100,000,000 kobo). */
function compactNaira(kobo: number) {
  const naira = Math.abs(kobo) / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(2)}M`;
  return koboToNaira(kobo);
}

const TYPE_WORD: Record<ApiTransactionType, string> = {
  fund: "deposits",
  withdraw: "withdrawals",
  buy: "buys",
  sell: "sells",
  convert: "converts",
};

const STATUS_WORD: Record<Exclude<StatusFilter, "all">, string> = {
  pending: "pending",
  review: "held",
  flagged: "flagged",
  approved: "settled",
  completed: "completed",
  rejected: "rejected",
  failed: "failed",
};

const DATE_CLAUSE: Record<DatePreset, string> = {
  today: "today",
  "7": "in the last 7 days",
  "30": "in the last 30 days",
  all: "on record",
};

function buildEmptyMessage(type: TypeFilter, status: StatusFilter, date: DatePreset, query: string) {
  const typeWord = type !== "all" ? TYPE_WORD[type as ApiTransactionType] : "transactions";
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

  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [date, setDate] = useState<DatePreset>("today");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"client" | "on" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [usersById, setUsersById] = useState<Map<string, { name: string; email: string }>>(new Map());
  const [allTx, setAllTx] = useState<ApiTransaction[]>([]);

  // Manual refresh — increments the tick the fetch effects depend on so the
  // Refresh button re-runs the live fetches instead of no-op'ing on identical
  // filter state. `refreshing` feeds the button's disabled state.
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
  };

  // The monitor — type/status are server-side filters (the endpoint supports
  // them directly); search and the date preset filter client-side on the
  // fetched page, since there's no date param on GET /transactions.
  useEffect(() => {
    let cancelled = false;
    listTransactions({
      page,
      pageSize: PER_PAGE,
      type: type === "all" ? undefined : type,
      status: status === "all" ? undefined : status,
    })
      .then((res) => {
        if (cancelled) return;
        setTransactions(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load transactions.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, type, status, refreshTick]);

  // Stats strip — a bounded look across all transactions so the headline
  // numbers (volume today, held, failed) are page-independent.
  useEffect(() => {
    let cancelled = false;
    listTransactions({ page: 1, pageSize: STATS_CAP })
      .then((res) => {
        if (!cancelled) setAllTx(res.data);
      })
      .catch(() => {
        // stats are best-effort; the monitor still renders
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  // Client-name resolution for the Client column — the real transaction
  // carries userId but no client name, so a capped users lookup fills it.
  useEffect(() => {
    let cancelled = false;
    listUsers({ page: 1, pageSize: LOOKUP_CAP })
      .then((res) => {
        if (cancelled) return;
        setUsersById(new Map(res.data.map((u) => [u.id, { name: u.fullName, email: u.email }])));
      })
      .catch(() => {
        // name is a display nicety only — fall back to the raw userId
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const clientName = (t: ApiTransaction) => usersById.get(t.userId)?.name ?? t.userId;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const { min, max } = datePresetWindow(date);
    return transactions.filter((t) => {
      const at = new Date(t.createdAt);
      if (at < min || at > max) return false;
      if (q && !(clientName(t).toLowerCase().includes(q) || t.userId.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, query, date, usersById]);

  const sortableList = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      if (!sortKey) return 0;
      if (sortKey === "client") {
        const cmp = clientName(a).localeCompare(clientName(b), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, usersById]);

  const safePage = Math.min(page, totalPages);
  const rows = sortableList;

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const inDay = (t: ApiTransaction, start: Date, end: Date) => {
      const at = new Date(t.createdAt);
      return at >= start && at < end;
    };
    const inDayNamed = (t: ApiTransaction, start: Date, end: Date) => {
      const at = new Date(t.createdAt);
      return at >= start && at < end;
    };

    const todayTx = allTx.filter((t) => inDay(t, startOfToday, new Date(now.getTime() + 86400000)));
    const yestTx = allTx.filter((t) => inDayNamed(t, startOfYesterday, startOfToday));
    const gross = (list: ApiTransaction[]) => list.reduce((s, t) => s + Math.abs(t.amountKobo), 0);
    const volToday = gross(todayTx);
    const volYest = gross(yestTx);
    const pct = volYest ? ((volToday - volYest) / volYest) * 100 : 0;

    const ordersLiveToday = todayTx.filter((t) => (t.type === "buy" || t.type === "sell") && t.status !== "approved" && t.status !== "completed").length;

    const held = allTx.filter((t) => t.status === "review");
    const heldValue = held.reduce((s, t) => s + Math.abs(t.amountKobo), 0);
    const aboveTier = held.filter((t) => t.holdingRule && /tier|limit/i.test(t.holdingRule)).length;

    const failedToday = todayTx.filter((t) => t.status === "rejected" || t.status === "failed").length;
    const failedYest = yestTx.filter((t) => t.status === "rejected" || t.status === "failed").length;
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
  }, [allTx]);

  const exportCsv = () => {
    const header = ["Reference", "Client", "User ID", "Type", "Detail", "Amount", "Status", "Timestamp"];
    const lines = sortableList.map((t) => [
      t.id,
      clientName(t),
      t.userId,
      TYPE_LABEL[t.type],
      `${t.title} · ${t.subtitle}`,
      String(t.amountKobo),
      t.status,
      fmtWhen(t.createdAt),
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
    else {
      setSortKey(key as "client" | "on");
      setSortDir("asc");
    }
  };

  const GRID = "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)";

  const columns: DataTableColumn<ApiTransaction>[] = [
    { key: "client", label: "Client", sortable: true, render: (t) => <TwoLineCell primary={clientName(t)} secondary={shortId(t.userId)} /> },
    { key: "type", label: "Type", render: (t) => TYPE_LABEL[t.type] ?? t.type },
    {
      key: "detail",
      label: "Detail",
      render: (t) => (t.title || t.subtitle ? <TwoLineCell primary={t.title} secondary={t.subtitle} /> : <span>—</span>),
    },
    { key: "id", label: "Reference", render: (t) => <span className="k-tnum">{shortId(t.id)}</span> },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (t) => (
        <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: t.amountKobo < 0 ? "var(--loss)" : "var(--gain)" }}>
          {signedKoboToNaira(t.amountKobo)}
        </span>
      ),
    },
    { key: "status", label: "Status", render: statusPill },
    { key: "on", label: "Timestamp", align: "right", sortable: true, render: (t) => <span className="k-tnum">{fmtWhen(t.createdAt)}</span> },
  ];

  const todayRangeLabel = (() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    if (date === "today") {
      return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    if (date === "7") return `${fmt(new Date(startOfToday.getTime() - 6 * 86400000))} – ${fmt(now)}`;
    if (date === "30") return `${fmt(new Date(startOfToday.getTime() - 29 * 86400000))} – ${fmt(now)}`;
    return "All time";
  })();

  const toolbar = (
    <>
      <SearchPill value={query} onChange={setQuery} placeholder="Search client or reference" width={260} />
      <Select
        aria-label="Filter by type"
        value={type}
        onChange={(v) => {
          setType(v as TypeFilter);
          setPage(1);
        }}
        height={36}
        width={150}
        options={TYPE_OPTIONS}
      />
      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(v) => {
          setStatus(v as StatusFilter);
          setPage(1);
        }}
        height={36}
        width={160}
        options={STATUS_OPTIONS}
      />
      <Select
        aria-label="Filter by date"
        value={date}
        onChange={(v) => {
          setDate(v as DatePreset);
          setPage(1);
        }}
        height={36}
        width={176}
        options={DATE_OPTIONS}
      />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="ghost" size="sm" iconLeft="refresh" onClick={refresh} disabled={refreshing}>
          Refresh
        </Button>
        <Button variant="secondary" size="sm" iconLeft="download" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
    </>
  );

  if (error) {
    return (
      <>
        <PageHead
          eyebrow={todayRangeLabel}
          title="Transactions and orders"
          description="Every buy, sell, deposit and withdrawal across the book. Held rows are waiting on the desk."
        />
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Couldn&apos;t load transactions
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>{error}</span>
          <Button variant="secondary" size="sm" iconLeft="refresh" onClick={refresh} disabled={refreshing} style={{ marginTop: 10 }}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={todayRangeLabel}
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
              value={compactNaira(stats.heldValue)}
              sub={`${stats.heldCount} held · ${stats.aboveTier} above tier limit`}
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
              total > PER_PAGE ? (
                <Pagination page={safePage} pageCount={totalPages} total={total} perPage={PER_PAGE} onChange={setPage} />
              ) : null
            }
          />
        </>
      )}
    </>
  );
}
