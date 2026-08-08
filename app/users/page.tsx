"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusPill, DotStatus } from "@/components/ui/StatusPill";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { listUsers, ApiError } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";
import type { AccountStatus, KycStatus } from "@/types/api";
import { koboToNaira } from "@/lib/money";

const PER_PAGE = 10;

/** Small inline spinner — used for the loading captions this screen and the
 * user-detail screen share (frames 3b / 4b), no shared Spinner component exists yet. */
function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid var(--hairline)",
        borderTopColor: "var(--ink-3)",
        animation: "k-spin 0.7s linear infinite",
      }}
    />
  );
}

const KYC_OPTIONS = [
  { value: "all", label: "All KYC states" },
  { value: "pending", label: "Pending" },
  { value: "review", label: "Under review" },
  { value: "flagged", label: "Flagged" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const ACCOUNT_OPTIONS = [
  { value: "all", label: "All accounts" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

type SortKey = "joinedAt" | "portfolioValue";

function accountLabel(status: AccountStatus) {
  return status === "active" ? "Active" : "Suspended";
}

function toCsv(rows: ApiUser[]) {
  const header = ["Name", "Email", "Phone", "City", "KYC", "Joined", "Account", "Portfolio value"];
  const lines = rows.map((u) =>
    [u.fullName, u.email, u.phone, u.city, u.kycStatus, u.memberSince, accountLabel(u.accountStatus), koboToNaira(u.portfolioValue)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function UsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [query, setQuery] = useState("");
  const [kycFilter, setKycFilter] = useState<KycStatus | "all">("all");
  const [accountFilter, setAccountFilter] = useState<AccountStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("joinedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filters and pagination hit the API directly — there's no client-side
  // filtering layer anymore, per the wiring guide.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listUsers({
      page,
      pageSize: PER_PAGE,
      kycStatus: kycFilter === "all" ? undefined : kycFilter,
      accountStatus: accountFilter === "all" ? undefined : accountFilter,
    })
      .then((res) => {
        if (cancelled) return;
        setUsers(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load clients.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, kycFilter, accountFilter]);

  const hasActiveFilters = query.trim() !== "" || kycFilter !== "all" || accountFilter !== "all";

  // Search and sort apply to the current page only — the API has no
  // free-text search or sort param, so this is a best-effort refinement of
  // whatever page the server already filtered for us.
  const pageRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = users.filter((u) => {
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q)
      );
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "joinedAt") cmp = a.memberSince.localeCompare(b.memberSince);
      if (sortKey === "portfolioValue") cmp = a.portfolioValue - b.portfolioValue;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [users, query, sortKey, sortDir]);

  function handleSort(key: string) {
    if (key !== "joinedAt" && key !== "portfolioValue") return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setQuery("");
    setKycFilter("all");
    setAccountFilter("all");
    setPage(1);
  }

  function exportCsv() {
    const csv = toCsv(pageRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataTableColumn<ApiUser>[] = [
    {
      key: "fullName",
      label: "Client",
      render: (row) => <TwoLineCell primary={row.fullName} secondary={row.email} />,
    },
    { key: "phone", label: "Phone", numeric: true },
    {
      key: "kycStatus",
      label: "KYC",
      render: (row) => <StatusPill status={row.kycStatus} size="sm" />,
    },
    { key: "joinedAt", label: "Joined", sortable: true, numeric: true, render: (row) => row.memberSince.slice(0, 10) },
    {
      key: "accountStatus",
      label: "Account",
      render: (row) => (
        <DotStatus tone={row.accountStatus === "active" ? "gain" : "loss"} label={accountLabel(row.accountStatus)} />
      ),
    },
    {
      key: "portfolioValue",
      label: "Portfolio",
      sortable: true,
      numeric: true,
      align: "right",
      render: (row) => koboToNaira(row.portfolioValue),
    },
  ];

  // Skeleton columns mirror the real columns but render placeholder bars,
  // regardless of row content — DataTable's existing `render` prop covers this,
  // no changes to DataTable itself were needed.
  const skeletonColumns: DataTableColumn<{ id: string }>[] = columns.map((col) => ({
    ...col,
    render: () => (
      <span
        style={{
          display: "inline-block",
          height: 12,
          width: col.key === "fullName" ? "70%" : col.align === "right" ? "60%" : "50%",
          borderRadius: 4,
          background: "var(--track)",
        }}
      />
    ),
  }));
  const skeletonRows = Array.from({ length: 10 }).map((_, i) => ({ id: `skeleton-${i}` }));

  const activeKycLabel = kycFilter !== "all" ? KYC_OPTIONS.find((o) => o.value === kycFilter)?.label.toLowerCase() : null;
  const activeAccountLabel =
    accountFilter !== "all" ? ACCOUNT_OPTIONS.find((o) => o.value === accountFilter)?.label.toLowerCase() : null;
  const activeQuery = query.trim();

  // "No {kyc filter}, {account filter} client matches "{search}". Widen the
  // KYC state or clear the search." — omits a clause for any filter left at
  // "All" (see frame 3c).
  function noMatchesText() {
    const adjectives = [activeKycLabel, activeAccountLabel].filter((v): v is string => Boolean(v));
    const prefix = adjectives.length ? `${adjectives.join(", ")} ` : "";
    const subject = activeQuery
      ? `${prefix}client matches "${activeQuery}"`
      : `${prefix}clients match these filters`;
    return `No ${subject}. Widen the KYC state or clear the search.`;
  }

  const toolbar = (
    <>
      <SearchPill value={query} onChange={setQuery} placeholder="Search name, email or phone" />
      <Select
        aria-label="Filter by KYC status"
        value={kycFilter}
        onChange={(v) => { setKycFilter(v as KycStatus | "all"); setPage(1); }}
        options={KYC_OPTIONS}
      />
      <Select
        aria-label="Filter by account status"
        value={accountFilter}
        onChange={(v) => { setAccountFilter(v as AccountStatus | "all"); setPage(1); }}
        options={ACCOUNT_OPTIONS}
      />
      <span style={{ flex: 1 }} />
      <Button variant="secondary" size="sm" iconLeft="download" onClick={exportCsv}>
        Export CSV
      </Button>
    </>
  );

  return (
    <>
      <style>{"@keyframes k-spin { to { transform: rotate(360deg); } }"}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="k-eyebrow">Client records</span>
        <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: 0 }}>
          Users
        </h1>
        <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: 0 }}>
          Every registered client, newest first. Open a row for holdings, transactions and the KYC file.
        </p>
      </div>

      {error ? (
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Couldn&apos;t load clients
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>{error}</span>
        </div>
      ) : loading ? (
        <DataTable
          columns={skeletonColumns}
          rows={skeletonRows}
          rowKey={(row) => row.id}
          toolbar={toolbar}
          footer={
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
              <Spinner />
              <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                Loading clients
              </span>
            </div>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => row.id}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={(row) => router.push(`/users/${row.id}`)}
          toolbar={toolbar}
          footer={
            total > 0 ? (
              <Pagination page={page} pageCount={totalPages} total={total} perPage={PER_PAGE} onChange={setPage} />
            ) : undefined
          }
          empty={
            <>
              <span style={{ font: "var(--text-card-title)", color: "var(--ink)" }}>No clients match these filters</span>
              <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 420 }}>
                {hasActiveFilters ? noMatchesText() : "Try widening or clearing your filters."}
              </span>
              <span style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </span>
            </>
          }
        />
      )}
    </>
  );
}
