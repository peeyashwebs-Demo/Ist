"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, TwoLineCell, DataTableColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/ui/PageHead";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  listAuditLog,
  listUsers,
  listStaffMembers,
  getUser,
  getKycSubmission,
  getTransaction,
  ApiError,
} from "@/lib/api/client";
import type { ApiAuditKind, ApiAuditLogEntry, ApiStaffRole, ApiUser, ApiStaffMember } from "@/lib/api/types";

// Caps for the side-channel lookups that resolve audit `target` ids into
// display names — one bounded fetch each, shared across every row on the page
// instead of N+1 fetching per entry.
const LOOKUP_CAP = 500;

const KIND_OPTIONS: { value: ApiAuditKind; label: string }[] = [
  { value: "kyc", label: "KYC decision" },
  { value: "account", label: "Account change" },
  { value: "transaction", label: "Transaction" },
  { value: "staff", label: "Staff change" },
  { value: "session", label: "Sign-in" },
];

const ROLE_LABEL: Record<ApiStaffRole, string> = {
  super_admin: "Super admin",
  compliance_officer: "Compliance officer",
  kyc_reviewer: "KYC reviewer",
  support: "Support",
};

function roleLabel(r: ApiStaffRole | null) {
  return r ? ROLE_LABEL[r] ?? r : "System";
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function shortId(id: string) {
  return id.slice(0, 8);
}

const DATE_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Today", days: 1 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: Infinity },
];

export default function AuditLogPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("All staff");
  const [kindFilter, setKindFilter] = useState<ApiAuditKind | "All actions">("All actions");
  const [rangeDays, setRangeDays] = useState<number>(7);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Side-channel maps for target resolution — capped fetches shared across
  // the whole page rather than one request per row.
  const [usersById, setUsersById] = useState<Map<string, ApiUser>>(new Map());
  const [staffById, setStaffById] = useState<Map<string, ApiStaffMember>>(new Map());
  const [targetNames, setTargetNames] = useState<Map<string, string>>(new Map());
  const targetNameCache = useRef<Map<string, string>>(new Map());

  // Manual refresh — `refresh` bumps a tick the fetch effect depends on, so
  // the Refresh button re-runs the live fetch even when filters haven't moved.
  // `refreshing` feeds the button's disabled state.
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
  };

  const resetPage = () => setPage(1);

  useEffect(() => {
    let cancelled = false;
    listAuditLog({
      page,
      pageSize: perPage,
      kind: kindFilter === "All actions" ? undefined : kindFilter,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? `${err.message} (HTTP ${err.status})` : "Couldn't load the audit log.");
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
  }, [page, perPage, kindFilter, refreshTick]);

  // Users + staff lookups — populate once, tolerate failure (the log still
  // renders with raw ids as the fallback).
  useEffect(() => {
    let cancelled = false;
    Promise.all([listUsers({ page: 1, pageSize: LOOKUP_CAP }), listStaffMembers({ page: 1, pageSize: LOOKUP_CAP })])
      .then(([users, staff]) => {
        if (cancelled) return;
        setUsersById(new Map(users.data.map((u) => [u.id, u])));
        setStaffById(new Map(staff.data.map((s) => [s.id, s])));
      })
      .catch(() => {
        // resolution is a display nicety — raw ids fall back
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Batch-resolve only the targets visible on the current page. The real API
  // has no targetName on the wire, so each kind resolves to a display name:
  // account -> user.fullName, kyc -> submission.name, transaction -> the
  // owning user's name (via targetDetail "user:<id>"), staff/session -> the
  // staff member's name.
  useEffect(() => {
    let cancelled = false;
    const missing: { key: string; kind: ApiAuditKind; id: string }[] = [];
    for (const e of rows) {
      const key = `${e.kind}:${e.target}`;
      if (targetNameCache.current.has(key)) continue;
      missing.push({ key, kind: e.kind, id: e.target });
    }
    if (!missing.length) return;

    async function resolveOne(entry: { key: string; kind: ApiAuditKind; id: string }) {
      try {
        if (entry.kind === "account") {
          const u = usersById.get(entry.id) ?? (await getUser(entry.id));
          return [entry.key, u?.fullName ?? shortId(entry.id)] as const;
        }
        if (entry.kind === "kyc") {
          const s = await getKycSubmission(entry.id);
          return [entry.key, s?.name ?? shortId(entry.id)] as const;
        }
        if (entry.kind === "transaction") {
          const t = await getTransaction(entry.id);
          if (t?.userId) {
            const owner = usersById.get(t.userId);
            if (owner) return [entry.key, owner.fullName] as const;
          }
          return [entry.key, t?.title ?? shortId(entry.id)] as const;
        }
        if (entry.kind === "staff" || entry.kind === "session") {
          const s = staffById.get(entry.id);
          return [entry.key, s?.name ?? shortId(entry.id)] as const;
        }
        return [entry.key, shortId(entry.id)] as const;
      } catch {
        return [entry.key, shortId(entry.id)] as const;
      }
    }

    Promise.all(missing.map(resolveOne)).then((results) => {
      if (cancelled) return;
      const next = new Map(targetNameCache.current);
      results.forEach(([k, v]) => next.set(k, v));
      targetNameCache.current = next;
      setTargetNames(new Map(next));
    });
    return () => {
      cancelled = true;
    };
    // usersById/staffById are stable once populated; re-running only adds
    // newly-visible ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const targetNameOf = (e: ApiAuditLogEntry) => targetNames.get(`${e.kind}:${e.target}`) ?? shortId(e.target);

  const staffNames = useMemo(() => Array.from(new Set(rows.map((e) => e.staffName))), [rows]);

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = rangeDays === Infinity ? null : new Date(now.getTime() - (rangeDays - 1) * 86400000);
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (staffFilter !== "All staff" && e.staffName !== staffFilter) return false;
      if (cutoff && new Date(e.when) < cutoff) return false;
      if (q && !`${targetNameOf(e)} ${e.target} ${e.targetDetail} ${e.detail} ${e.action}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, staffFilter, rangeDays, targetNames]);

  const safePage = Math.min(page, totalPages);
  const displayRows = filtered;

  function exportCsv() {
    const header = ["When", "Entry", "Staff", "Role", "Action", "Kind", "Affected", "Affected detail", "Detail"];
    const lines = filtered.map((e) =>
      [e.when, e.id, e.staffName, e.staffRole, e.action, e.kind, targetNameOf(e), e.targetDetail, e.detail]
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

  const AUDIT_KIND_LABEL: Record<ApiAuditKind, string> = {
    kyc: "KYC decision",
    account: "Account change",
    transaction: "Transaction",
    staff: "Staff change",
    session: "Sign-in",
  };

  const columns: DataTableColumn<ApiAuditLogEntry>[] = [
    { key: "when", label: "When", numeric: true, render: (r) => <TwoLineCell primary={fmtWhen(r.when)} secondary={shortId(r.id)} /> },
    { key: "staff", label: "Staff", render: (r) => <TwoLineCell primary={r.staffName} secondary={roleLabel(r.staffRole)} /> },
    { key: "action", label: "Action", render: (r) => <TwoLineCell primary={r.action} secondary={AUDIT_KIND_LABEL[r.kind]} /> },
    { key: "target", label: "Affected", render: (r) => <TwoLineCell primary={targetNameOf(r)} secondary={r.targetDetail} /> },
    { key: "detail", label: "Detail", render: (r) => <span style={{ color: "var(--ink-2)" }}>{r.detail}</span> },
  ];

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-section)" }}>
        <PageHead
          eyebrow="Compliance record"
          title="Audit log"
          description="Every action taken on the desk, newest first. Entries cannot be edited or deleted, only read and exported."
        />
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Couldn&apos;t load the audit log
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>
            The audit log is read-only — if the service is down the record is still intact, it just can&apos;t be reached right now. {error}
          </span>
          <Button variant="secondary" size="sm" iconLeft="refresh" onClick={refresh} disabled={refreshing} style={{ marginTop: 10 }}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

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
          Read-only · {total.toLocaleString()} entries retained for seven years · exports are themselves logged
        </span>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          rows={displayRows}
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
                  setKindFilter(v as ApiAuditKind | "All actions");
                  resetPage();
                }}
                height={36}
                width={176}
                options={[
                  { value: "All actions", label: "All actions" },
                  ...KIND_OPTIONS.map((k) => ({ value: k.value, label: k.label })),
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
              <Button variant="ghost" size="sm" iconLeft="refresh" onClick={refresh} disabled={refreshing}>
                Refresh
              </Button>
              <Button variant="secondary" size="sm" iconLeft="download" onClick={exportCsv}>
                Export CSV
              </Button>
            </>
          }
          footer={
            <Pagination
              page={safePage}
              pageCount={totalPages}
              total={total}
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
                <Button variant="secondary" size="sm" iconLeft="refresh" onClick={refresh} disabled={refreshing}>
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
