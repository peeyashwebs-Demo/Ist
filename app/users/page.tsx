"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusPill, DotStatus } from "@/components/ui/StatusPill";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getUsers } from "@/lib/mock/users";
import type { AccountStatus, KycStatus, User } from "@/types/api";

const PER_PAGE = 10;

const KYC_OPTIONS = [
  { value: "all", label: "All KYC states" },
  { value: "pending", label: "Pending" },
  { value: "review", label: "Under review" },
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

function parseCurrency(v: string) {
  return Number(v.replace(/[^\d.-]/g, "")) || 0;
}

function toCsv(rows: User[]) {
  const header = ["Name", "Email", "Phone", "City", "KYC", "Joined", "Account", "Portfolio value"];
  const lines = rows.map((u) =>
    [u.name, u.email, u.phone, u.city, u.kycStatus, u.joinedAt, accountLabel(u.accountStatus), u.portfolioValue]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function UsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  const [query, setQuery] = useState("");
  const [kycFilter, setKycFilter] = useState<KycStatus | "all">("all");
  const [accountFilter, setAccountFilter] = useState<AccountStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("joinedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => {
      // SEAM: replace with GET /api/admin/users
      setUsers(getUsers());
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const hasActiveFilters = query.trim() !== "" || kycFilter !== "all" || accountFilter !== "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = users.filter((u) => {
      const matchesQuery =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q);
      const matchesKyc = kycFilter === "all" || u.kycStatus === kycFilter;
      const matchesAccount = accountFilter === "all" || u.accountStatus === accountFilter;
      return matchesQuery && matchesKyc && matchesAccount;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "joinedAt") cmp = a.joinedAt.localeCompare(b.joinedAt);
      if (sortKey === "portfolioValue") cmp = parseCurrency(a.portfolioValue) - parseCurrency(b.portfolioValue);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [users, query, kycFilter, accountFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function handleSort(key: string) {
    if (key !== "joinedAt" && key !== "portfolioValue") return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setKycFilter("all");
    setAccountFilter("all");
    setPage(1);
  }

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      label: "Client",
      render: (row) => <TwoLineCell primary={row.name} secondary={row.email} />,
    },
    { key: "phone", label: "Phone", numeric: true },
    {
      key: "kycStatus",
      label: "KYC",
      render: (row) => <StatusPill status={row.kycStatus} size="sm" />,
    },
    { key: "joinedAt", label: "Joined", sortable: true, numeric: true },
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
          width: col.key === "name" ? "70%" : col.align === "right" ? "60%" : "50%",
          borderRadius: 4,
          background: "var(--track)",
        }}
      />
    ),
  }));
  const skeletonRows = Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-${i}` }));

  const activeFilterLabels = [
    kycFilter !== "all" ? KYC_OPTIONS.find((o) => o.value === kycFilter)?.label : null,
    accountFilter !== "all" ? ACCOUNT_OPTIONS.find((o) => o.value === accountFilter)?.label : null,
    query.trim() ? `"${query.trim()}"` : null,
  ].filter(Boolean);

  const toolbar = (
    <>
      <SearchPill value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search name, email or phone" />
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
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="k-eyebrow">Client records</span>
        <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: 0 }}>
          Users
        </h1>
        <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: 0 }}>
          Every registered client, newest first. Open a row for holdings, transactions and the KYC file.
        </p>
      </div>

      {loading ? (
        <DataTable columns={skeletonColumns} rows={skeletonRows} rowKey={(row) => row.id} toolbar={toolbar} />
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
            filtered.length > 0 ? (
              <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
            ) : undefined
          }
          empty={
            <>
              <span style={{ font: "var(--text-card-title)", color: "var(--ink)" }}>No clients match these filters</span>
              <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 420 }}>
                {hasActiveFilters
                  ? `No results for ${activeFilterLabels.join(", ")}. Try widening or clearing your filters.`
                  : "Try widening or clearing your filters."}
              </span>
              <span style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Search all {users.length}
                </Button>
              </span>
            </>
          }
        />
      )}
    </>
  );
}
