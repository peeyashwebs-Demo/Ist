"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiKycSubmission, KycStatus, ApiAuditLogEntry } from "@/lib/api/types";
import { listKycSubmissions, listUsers, listAuditLog, ApiError } from "@/lib/api/client";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/ui/PageHead";
import { Select } from "@/components/ui/Select";
import { SearchPill } from "@/components/ui/SearchPill";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/icons/Icon";
import { SkeletonTable, SkeletonInline } from "@/components/ui/Skeleton";

const PER_PAGE = 12;
// Cap for the separate "stats" fetch below — the queue strip reports what the
// automation did, so a bounded look at the whole submission set is enough;
// real volumes larger than this only undercount the percentages, never crash.
const STATS_CAP = 500;
// Cap for resolving submission userId -> client email, and the audit-log
// override count. Both are side-channel read helpers, not the queue itself.
const LOOKUP_CAP = 500;

const RANGE_OPTIONS = ["Last 7 days", "Today", "Last 30 days", "All time"];

function shortId(id: string) {
  return id.slice(0, 8);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Date windows computed against "now", not a fixed mock anchor. */
function dateWindow(range: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "Today") return { min: startOfToday, max: now };
  if (range === "Last 7 days") return { min: new Date(startOfToday.getTime() - 6 * 86400000), max: now };
  if (range === "Last 30 days") return { min: new Date(startOfToday.getTime() - 29 * 86400000), max: now };
  return { min: new Date(0), max: now };
}

type ToastPayload = { title: string; message: string };

function vendorPill(decision: ApiKycSubmission["vendorDecision"]) {
  if (decision === "approved") return <StatusPill status="approved" label="Auto-approved" size="sm" />;
  if (decision === "rejected") return <StatusPill status="rejected" label="Auto-rejected" size="sm" />;
  return <StatusPill status="pending" label="No decision" size="sm" />;
}

function casePill(status: KycStatus) {
  if (status === "approved") return <StatusPill status="approved" size="sm" />;
  if (status === "rejected") return <StatusPill status="rejected" size="sm" />;
  if (status === "pending") return <StatusPill status="pending" size="sm" />;
  if (status === "flagged") return <StatusPill status="flagged" size="sm" />;
  return <StatusPill status="review" size="sm" />;
}

/** Bordered strip of tiles separated by hairlines — the "automation stays in
 * view" summary that sits above the exceptions table. */
function StatStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 3, borderLeft: i ? "1px solid var(--hairline)" : "none" }}
        >
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{item.label}</span>
          <span className="k-tnum" style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatStripSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8, borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
          <SkeletonInline width={110} height={9} />
          <SkeletonInline width={70} height={16} />
        </div>
      ))}
    </div>
  );
}

function NoMatches() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0", textAlign: "center", maxWidth: 440 }}>
      <span style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--track)", display: "grid", placeItems: "center" }}>
        <Icon name="shield" size={22} color="var(--ink-3)" />
      </span>
      <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>No cases match this filter</span>
      <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
        Widen the date range or pick a different reason. The queue holds every case the vendor could not decide.
      </span>
    </div>
  );
}

/** The everyday state — reports what the automation did instead of an empty table. */
function QueueAllClear({ onSeeDecided, onRefresh, stats }: { onSeeDecided: () => void; onRefresh: () => void; stats: { decidedToday: number | null; autoApproved: number; autoRejected: number; lastException: string } }) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-card)",
        padding: "56px 24px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", maxWidth: 460 }}>
        <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--status-approved-tint)", display: "grid", placeItems: "center" }}>
          <Icon name="check" size={24} color="var(--gain)" />
        </span>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>Queue is clear</span>
        <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
          Every submission in the last 24 hours was decided by the vendor. New exceptions land here within a minute of submission.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden", width: 760, maxWidth: "100%" }}>
        {[
          { label: "Decided today", value: stats.decidedToday == null ? "—" : stats.decidedToday.toLocaleString() },
          { label: "Auto-approved", value: stats.autoApproved.toLocaleString() },
          { label: "Auto-rejected", value: stats.autoRejected.toLocaleString() },
          { label: "Last exception", value: stats.lastException },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 3, textAlign: "center", borderLeft: i ? "1px solid var(--hairline)" : "none" }}
          >
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{item.label}</span>
            <span className="k-tnum" style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{item.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" size="sm" iconLeft="doc" onClick={onSeeDecided}>
          See decided cases
        </Button>
        <Button variant="ghost" size="sm" iconLeft="refresh" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

export default function KycPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [flag, setFlag] = useState("");
  const [range, setRange] = useState<string>("Last 7 days");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<ApiKycSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Side-channel lookups — client email per userId and the override count.
  // Both tolerate failure (the queue still renders without them).
  const [emailsById, setEmailsById] = useState<Map<string, string>>(new Map());
  const [overrideCount, setOverrideCount] = useState<number | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<ApiKycSubmission[]>([]);
  // KYC decision entries from the audit log. The submission object carries no
  // decision timestamp — only submittedAt — so "decided today" is counted from
  // these entry `when`s, not from submission dates. Null while the audit log
  // is unreachable, which renders "—" instead of a misleading zero.
  const [kycDecisions, setKycDecisions] = useState<ApiAuditLogEntry[] | null>(null);

  // Manual refresh — `refresh` bumps a tick the queue effect depends on, so
  // the Refresh button re-fetches even when page/filters haven't moved.
  // `refreshing` feeds the button's disabled state.
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
  };

  // Picked up after an approve/reject on the case-detail screen — see
  // app/kyc/[id]/page.tsx, which stashes the toast payload before navigating
  // the desk back here.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("kyc-toast");
      if (raw) {
        sessionStorage.removeItem("kyc-toast");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToast(JSON.parse(raw) as ToastPayload);
      }
    } catch {
      // ignore — sessionStorage unavailable
    }
  }, []);

  // The queue is "status in (pending, review)" — the real endpoint's `status`
  // param takes exactly one enum value per call, so this is two requests
  // merged client-side (exceptions only; decided cases drop out server-side).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listKycSubmissions({ page, pageSize: PER_PAGE, status: "pending" }),
      listKycSubmissions({ page, pageSize: PER_PAGE, status: "review" }),
    ])
      .then(([pending, review]) => {
        if (cancelled) return;
        const rows = [...pending.data, ...review.data].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
        setSubmissions(rows);
        setTotal(pending.meta.total + review.meta.total);
        setTotalPages(Math.max(1, Math.ceil((pending.meta.total + review.meta.total) / PER_PAGE)));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load the KYC queue.");
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
  }, [page, refreshTick]);

  // Stats strip — a bounded look across all submissions (approved/rejected
  // included) so "auto-decided" and the queue share the real numbers.
  useEffect(() => {
    let cancelled = false;
    listKycSubmissions({ page: 1, pageSize: STATS_CAP })
      .then((res) => {
        if (!cancelled) setAllSubmissions(res.data);
      })
      .catch(() => {
        // stats are best-effort; the queue still renders
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  // Client email resolution for the Client column's secondary line — the real
  // submission carries userId but no email, so a capped users lookup fills it.
  useEffect(() => {
    let cancelled = false;
    listUsers({ page: 1, pageSize: LOOKUP_CAP })
      .then((res) => {
        if (cancelled) return;
        setEmailsById(new Map(res.data.map((u) => [u.id, u.email])));
      })
      .catch(() => {
        // email is a display nicety only
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // "Overrides logged" + "Decided today" — the audit log's kyc kind. The
  // submission model has no decision timestamp, so both stats read the audit
  // log, and both degrade to "—" when the log is unavailable rather than fail
  // the page. Re-runs on every refresh so a desk decision shows up here.
  useEffect(() => {
    let cancelled = false;
    listAuditLog({ kind: "kyc", page: 1, pageSize: 500 })
      .then((res) => {
        if (cancelled) return;
        setOverrideCount(res.meta.total ?? null);
        setKycDecisions(res.data);
      })
      .catch(() => {
        // audit-log may be unavailable — the stats show "—"
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const flagReasons = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.flagReason).filter((r): r is string => Boolean(r)))),
    [submissions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const { min, max } = dateWindow(range);
    return submissions.filter((s) => {
      if (flag && s.flagReason !== flag) return false;
      const at = new Date(s.submittedAt);
      if (at < min || at > max) return false;
      if (q && !(s.name.toLowerCase().includes(q) || shortId(s.id).toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.bvn.includes(q) || s.nin.includes(q))) return false;
      return true;
    });
  }, [submissions, flag, range, query]);

  const safePage = Math.min(page, totalPages);
  const rows = filtered;

  const stats = useMemo(() => {
    const totalAll = allSubmissions.length;
    const last7 = allSubmissions.filter((s) => new Date(s.submittedAt) >= dateWindow("Last 7 days").min).length;
    const autoDecided = allSubmissions.filter((s) => s.vendorDecision !== "no_decision").length;
    const autoPct = totalAll ? ((autoDecided / totalAll) * 100).toFixed(1) : "0.0";
    const queueLen = allSubmissions.filter((s) => s.status === "pending" || s.status === "review").length;
    const queuePct = totalAll ? ((queueLen / totalAll) * 100).toFixed(1) : "0.0";

    // How many KYC decisions happened today — read from the audit log's entry
    // timestamps (a decision may land days after the submission, and the
    // submission carries no decision time). Null when the audit log is down.
    const decidedToday =
      kycDecisions == null
        ? null
        : kycDecisions.filter((e) => new Date(e.when) >= dateWindow("Today").min).length;
    const autoApproved = allSubmissions.filter((s) => s.vendorDecision === "approved").length;
    const autoRejected = allSubmissions.filter((s) => s.vendorDecision === "rejected").length;
    const lastException = allSubmissions[0] ? fmtDate(allSubmissions[0].submittedAt) : "—";

    return { last7, autoDecided, autoPct, queueLen, queuePct, decidedToday, autoApproved, autoRejected, lastException };
  }, [allSubmissions, kycDecisions]);

  const statItems = [
    { label: "Submissions · last 7 days", value: stats.last7.toLocaleString() },
    { label: "Auto-decided", value: `${stats.autoDecided.toLocaleString()} · ${stats.autoPct}%` },
    { label: "Sent to the desk", value: `${stats.queueLen.toLocaleString()} · ${stats.queuePct}%` },
    { label: "Overrides logged", value: overrideCount == null ? "—" : overrideCount.toLocaleString() },
    { label: "Median desk decision", value: "—" },
  ];

  const exportCsv = () => {
    const header = ["Case", "Client", "Email", "Submitted", "Flagged for", "Flag detail", "Auto-decision", "Vendor detail", "Status", "Attempts"];
    const lines = filtered.map((s) => [
      s.id,
      s.name,
      emailsById.get(s.userId) ?? "",
      fmtDate(s.submittedAt),
      s.flagReason ?? "",
      s.flagDetail ?? "",
      s.vendorDecision,
      s.vendorDetail ?? "",
      s.status,
      `${s.attemptCount}/${s.maxAttempts}`,
    ]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kyc-queue.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: DataTableColumn<ApiKycSubmission>[] = [
    {
      key: "client",
      label: "Client",
      width: "220px",
      render: (s) => <TwoLineCell primary={s.name} secondary={emailsById.get(s.userId) ?? s.userId.slice(0, 8)} />,
    },
    { key: "case", label: "Case", width: "110px", render: (s) => <span className="k-tnum">{shortId(s.id)}</span> },
    { key: "submittedAt", label: "Submitted", numeric: true, render: (s) => <span className="k-tnum">{fmtDate(s.submittedAt)}</span> },
    { key: "flag", label: "Flagged for", width: "260px", render: (s) => <TwoLineCell primary={s.flagReason ?? "Manual review"} secondary={s.flagDetail} /> },
    { key: "vendorDecision", label: "Auto-decision", render: (s) => vendorPill(s.vendorDecision) },
    { key: "status", label: "Status", width: "140px", render: (s) => casePill(s.status) },
    { key: "attempts", label: "Attempt", numeric: true, render: (s) => <span className="k-tnum">{`${s.attemptCount} of ${s.maxAttempts}`}</span> },
  ];

  const toolbar = (
    <>
      <SearchPill value={query} onChange={setQuery} placeholder="Search name, case ref or BVN" width={280} />
      <Select
        aria-label="Filter by flag reason"
        value={flag}
        onChange={setFlag}
        height={36}
        width={220}
        options={[{ value: "", label: "All flag reasons" }, ...flagReasons.map((r) => ({ value: r, label: r }))]}
      />
      <Select aria-label="Filter by date range" value={range} onChange={setRange} height={36} width={150} options={RANGE_OPTIONS.map((r) => ({ value: r, label: r }))} />
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

  const isAllClear = !loading && !error && submissions.length === 0;

  if (error) {
    return (
      <>
        <PageHead
          eyebrow="Compliance · exceptions only"
          title="KYC review"
          description="Cases the verification vendor could not decide, plus anything the desk asked to see. Oldest first."
        />
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Couldn&apos;t load the KYC queue
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
        eyebrow="Compliance · exceptions only"
        title="KYC review"
        description={
          isAllClear
            ? "Nothing is waiting on the desk. Cases appear here only when the vendor cannot decide."
            : "Cases the verification vendor could not decide, plus anything the desk asked to see. Oldest first."
        }
      />

      {loading ? (
        <>
          <StatStripSkeleton />
          <SkeletonTable rows={8} cols={7} />
        </>
      ) : isAllClear ? (
        <QueueAllClear
          onSeeDecided={() => router.push("/audit-log")}
          onRefresh={refresh}
          stats={stats}
        />
      ) : (
        <>
          <StatStrip items={statItems} />
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            toolbar={toolbar}
            onRowClick={(s) => router.push(`/kyc/${s.id}`)}
            empty={<NoMatches />}
            footer={
              total > PER_PAGE ? (
                <Pagination page={safePage} pageCount={totalPages} total={total} perPage={PER_PAGE} onChange={setPage} />
              ) : null
            }
          />
        </>
      )}

      <Toast
        open={toast !== null}
        tone="success"
        title={toast?.title ?? ""}
        message={toast?.message ?? ""}
        actionLabel="View log"
        onAction={() => router.push("/audit-log")}
        onClose={() => setToast(null)}
      />
    </>
  );
}
