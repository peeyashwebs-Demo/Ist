"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KycSubmission } from "@/types/api";
import { KYC_SUBMISSIONS, getKycSubmissions } from "@/lib/mock/kyc";
import { getAuditLog } from "@/lib/mock/audit";
import { useMockLoading } from "@/lib/useMockLoading";
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

// Mock "today" — kept consistent with the rest of the desk (transactions,
// audit log all anchor on 14 Mar 2026).
const TODAY = "2026-03-14";
const LAST_7_DAYS = "2026-03-08";
const LAST_30_DAYS = "2026-02-13";

const RANGE_OPTIONS = ["Last 7 days", "Today", "Last 30 days", "All time"];

type ToastPayload = { title: string; message: string };

function vendorPill(decision: KycSubmission["vendorDecision"]) {
  if (decision === "Approved") return <StatusPill status="approved" label="Auto-approved" size="sm" />;
  if (decision === "Rejected") return <StatusPill status="rejected" label="Auto-rejected" size="sm" />;
  return <StatusPill status="pending" label="No decision" size="sm" />;
}

function casePill(status: KycSubmission["status"]) {
  if (status === "approved") return <StatusPill status="approved" size="sm" />;
  if (status === "rejected") return <StatusPill status="rejected" size="sm" />;
  if (status === "pending") return <StatusPill status="pending" size="sm" />;
  return <StatusPill status="review" size="sm" />;
}

function withinRange(dateIso: string, range: string) {
  if (range === "Today") return dateIso === TODAY;
  if (range === "Last 7 days") return dateIso >= LAST_7_DAYS;
  if (range === "Last 30 days") return dateIso >= LAST_30_DAYS;
  return true; // All time
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
function QueueAllClear({ onSeeDecided, onRefresh }: { onSeeDecided: () => void; onRefresh: () => void }) {
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
          { label: "Decided today", value: "186" },
          { label: "Auto-approved", value: "171" },
          { label: "Auto-rejected", value: "15" },
          { label: "Last exception", value: "Yesterday · 16:04" },
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
  const loading = useMockLoading();

  const [query, setQuery] = useState("");
  const [flag, setFlag] = useState("");
  const [range, setRange] = useState<string>("Last 7 days");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  // Picked up after an approve/reject on the case-detail screen — see
  // app/kyc/[id]/page.tsx, which stashes the toast payload before navigating
  // the desk back here (frame 5g: "back to the queue ... with the audit line
  // in the toast").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("kyc-toast");
      if (raw) {
        sessionStorage.removeItem("kyc-toast");
        // One-time pickup of a cross-navigation payload — there's no external
        // subscription to model here, just a mount-time read.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToast(JSON.parse(raw) as ToastPayload);
      }
    } catch {
      // ignore — sessionStorage unavailable
    }
  }, []);

  // SEAM: replace with GET /api/admin/kyc-queue
  const submissions = useMemo(() => getKycSubmissions(), []);
  const auditLog = useMemo(() => getAuditLog(), []);

  const flagReasons = useMemo(() => Array.from(new Set(submissions.map((s) => s.flagReason))), [submissions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((s) => {
      if (flag && s.flagReason !== flag) return false;
      if (!withinRange(s.submittedOn, range)) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [submissions, flag, range, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const stats = useMemo(() => {
    const total = KYC_SUBMISSIONS.length;
    const last7 = KYC_SUBMISSIONS.filter((s) => s.submittedOn >= LAST_7_DAYS).length;
    const autoDecided = KYC_SUBMISSIONS.filter((s) => s.vendorDecision !== "No decision").length;
    const autoPct = total ? ((autoDecided / total) * 100).toFixed(1) : "0.0";
    const queueLen = submissions.length;
    const queuePct = total ? ((queueLen / total) * 100).toFixed(1) : "0.0";
    const overrides = auditLog.filter((e) => e.kind === "KYC").length;
    return { last7, autoDecided, autoPct, queueLen, queuePct, overrides };
  }, [submissions, auditLog]);

  const statItems = [
    { label: "Submissions · last 7 days", value: stats.last7.toLocaleString() },
    { label: "Auto-decided", value: `${stats.autoDecided.toLocaleString()} · ${stats.autoPct}%` },
    { label: "Sent to the desk", value: `${stats.queueLen.toLocaleString()} · ${stats.queuePct}%` },
    { label: "Overrides logged", value: String(stats.overrides) },
    { label: "Median desk decision", value: "6m 40s" },
  ];

  const exportCsv = () => {
    const header = ["Case", "Client", "Email", "Submitted", "Flagged for", "Flag detail", "Auto-decision", "Vendor detail", "Status", "Waiting"];
    const lines = filtered.map((s) => [s.id, s.name, s.email, s.submittedAt, s.flagReason, s.flagDetail, s.vendorDecision, s.vendorDetail, s.status, s.waitingFor]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kyc-queue.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: DataTableColumn<KycSubmission>[] = [
    { key: "client", label: "Client", width: "220px", render: (s) => <TwoLineCell primary={s.name} secondary={s.email} /> },
    { key: "case", label: "Case", width: "110px", render: (s) => <span className="k-tnum">{s.id}</span> },
    { key: "submittedAt", label: "Submitted", numeric: true, render: (s) => <span className="k-tnum">{s.submittedAt}</span> },
    { key: "flag", label: "Flagged for", width: "260px", render: (s) => <TwoLineCell primary={s.flagReason} secondary={s.flagDetail} /> },
    { key: "vendorDecision", label: "Auto-decision", render: (s) => vendorPill(s.vendorDecision) },
    { key: "status", label: "Status", width: "140px", render: (s) => casePill(s.status) },
    { key: "waitingFor", label: "Waiting", numeric: true, render: (s) => <span className="k-tnum">{s.waitingFor}</span> },
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
      <div style={{ marginLeft: "auto" }}>
        <Button variant="secondary" size="sm" iconLeft="download" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
    </>
  );

  const isAllClear = !loading && submissions.length === 0;

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
        <QueueAllClear onSeeDecided={() => router.push("/audit-log")} onRefresh={() => router.refresh()} />
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
              filtered.length > PER_PAGE ? (
                <Pagination page={safePage} pageCount={pageCount} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
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
