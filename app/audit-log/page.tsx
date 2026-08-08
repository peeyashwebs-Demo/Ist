"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable, TwoLineCell, DataTableColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/ui/PageHead";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { getAuditLog } from "@/lib/mock/audit";
import type { AuditLogEntry, AuditKind } from "@/types/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseWhen(s: string): Date {
  const [datePart, timePart] = s.split(", ");
  const [day, month] = datePart.split(" ");
  const [h, m] = timePart.split(":");
  return new Date(2026, MONTHS.indexOf(month), Number(day), Number(h), Number(m));
}

const ACTIONS: AuditKind[] = ["KYC", "Account", "Transaction", "Staff", "Session"];
const DATE_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Today", days: 1 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: Infinity },
];

// Exact wording from the design's action-filter options — distinct from the
// underlying AuditKind values the filter actually matches against.
export const AUDIT_KIND_LABEL: Record<AuditKind, string> = {
  KYC: "KYC decision",
  Account: "Account change",
  Transaction: "Transaction",
  Staff: "Staff change",
  Session: "Sign-in",
};

export default function AuditLogPage() {
  const router = useRouter();
  const all = useMemo(() => getAuditLog(), []);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("All staff");
  const [kindFilter, setKindFilter] = useState<AuditKind | "All actions">("All actions");
  const [rangeDays, setRangeDays] = useState<number>(7);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  const staffNames = useMemo(() => Array.from(new Set(all.map((e) => e.staffName))), [all]);

  const resetPage = () => setPage(1);

  function resetFilters() {
    setSearch("");
    setStaffFilter("All staff");
    setKindFilter("All actions");
    setRangeDays(7);
    resetPage();
  }

  const filtered = useMemo(() => {
    const today = new Date(2026, 2, 14);
    const cutoff = rangeDays === Infinity ? null : new Date(today.getTime() - (rangeDays - 1) * 86400000);
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      if (staffFilter !== "All staff" && e.staffName !== staffFilter) return false;
      if (kindFilter !== "All actions" && e.kind !== kindFilter) return false;
      if (cutoff && parseWhen(e.when) < cutoff) return false;
      if (q && !`${e.targetName} ${e.target} ${e.targetDetail}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, search, staffFilter, kindFilter, rangeDays]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  function exportCsv() {
    const header = ["When", "Entry", "Staff", "Role", "Action", "Kind", "Affected", "Affected detail", "Detail"];
    const lines = filtered.map((e) =>
      [e.when, e.id, e.staffName, e.staffRole, e.action, e.kind, e.targetName, e.targetDetail, e.detail]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataTableColumn<AuditLogEntry>[] = [
    { key: "when", label: "When", numeric: true, render: (r) => <TwoLineCell primary={r.when} secondary={r.id} /> },
    { key: "staff", label: "Staff", render: (r) => <TwoLineCell primary={r.staffName} secondary={r.staffRole} /> },
    { key: "action", label: "Action", render: (r) => <TwoLineCell primary={r.action} secondary={r.kind} /> },
    { key: "target", label: "Affected", render: (r) => <TwoLineCell primary={r.targetName} secondary={r.targetDetail} /> },
    { key: "detail", label: "Detail", render: (r) => <span style={{ color: "var(--ink-2)" }}>{r.detail}</span> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-section)" }}>
      <PageHead
        eyebrow="Compliance record"
        title="Audit log"
        description="Every action taken on the desk, newest first. Entries cannot be edited or deleted, only read and exported."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-card)",
        }}
      >
        <Icon name="lock" size={16} color="var(--ink-3)" />
        <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
          Read-only · {all.length.toLocaleString()} entries retained for seven years · exports are themselves logged
        </span>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          dense
          onRowClick={(r) => router.push(`/audit-log/${r.id}`)}
          toolbar={
            <>
              <SearchPill
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  resetPage();
                }}
                placeholder="Search affected client or ref"
                width={260}
              />
              <Select
                aria-label="Filter by staff"
                value={staffFilter}
                onChange={(v) => {
                  setStaffFilter(v);
                  resetPage();
                }}
                height={36}
                width={176}
                options={[{ value: "All staff", label: "All staff" }, ...staffNames.map((s) => ({ value: s, label: s }))]}
              />
              <Select
                aria-label="Filter by action"
                value={kindFilter}
                onChange={(v) => {
                  setKindFilter(v as AuditKind | "All actions");
                  resetPage();
                }}
                height={36}
                width={176}
                options={[
                  { value: "All actions", label: "All actions" },
                  ...ACTIONS.map((k) => ({ value: k, label: AUDIT_KIND_LABEL[k] })),
                ]}
              />
              <Select
                aria-label="Filter by date range"
                value={String(rangeDays)}
                onChange={(v) => {
                  setRangeDays(Number(v));
                  resetPage();
                }}
                height={36}
                width={150}
                options={DATE_RANGES.map((r) => ({ value: String(r.days), label: r.label }))}
              />
              <span style={{ flex: 1 }} />
              <Button variant="secondary" size="sm" iconLeft="download" onClick={exportCsv}>
                Export CSV
              </Button>
            </>
          }
          footer={
            <Pagination
              page={safePage}
              pageCount={pageCount}
              total={filtered.length}
              perPage={perPage}
              onChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
              perPageOptions={[10, 25, 50]}
            />
          }
          empty={
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "8px 0", textAlign: "center", maxWidth: 460 }}>
              <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>No activity yet</span>
              <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
                KYC overrides, account suspensions, payout releases, staff changes and sign-ins are written here as they happen.
                Nothing on the desk can be done without leaving an entry.
              </span>
              <div style={{ marginTop: 8 }}>
                <Button variant="secondary" size="sm" iconLeft="refresh" onClick={resetFilters}>
                  Refresh
                </Button>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
