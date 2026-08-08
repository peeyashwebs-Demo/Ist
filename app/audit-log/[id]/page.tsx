"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { getAuditLog, getAuditLogEntryById } from "@/lib/mock/audit";
import { getUsers } from "@/lib/mock/users";
import type { AuditKind, AuditLogEntry } from "@/types/api";

// Same wording as the audit-log list's action filter — used for the
// "Area" field in the record card.
const AUDIT_KIND_LABEL: Record<AuditKind, string> = {
  KYC: "KYC decision",
  Account: "Account change",
  Transaction: "Transaction",
  Staff: "Staff change",
  Session: "Sign-in",
};

const labelStyle = {
  font: "var(--text-label)",
  letterSpacing: "var(--track-label)",
  textTransform: "uppercase",
  color: "var(--ink-3)",
} as const;

function cardStyle(background = "var(--paper)") {
  return {
    background,
    border: "1px solid var(--hairline)",
    borderRadius: "var(--r-card)",
    padding: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  };
}

export default function AuditEntryDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<AuditLogEntry | null | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      // SEAM: replace with GET /api/admin/audit-log/:id
      setEntry(getAuditLogEntryById(id) ?? null);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [id]);

  const client = useMemo(() => {
    if (!entry || entry.kind !== "Account") return undefined;
    // `target` is already the real user id for Account-kind entries — no
    // name lookup needed.
    return getUsers().find((u) => u.id === entry.target);
  }, [entry]);

  const related = useMemo(() => {
    if (!entry) return [];
    return getAuditLog().filter((e) => e.id !== entry.id && e.target === entry.target);
  }, [entry]);

  if (!loading && entry === null) {
    notFound();
  }

  const backLink = (
    <Link
      href="/audit-log"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        font: "var(--text-label)",
        letterSpacing: "var(--track-label)",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        width: "fit-content",
      }}
    >
      <Icon name="chevronLeft" size={13} color="var(--ink-3)" />
      All entries
    </Link>
  );

  if (loading || !entry) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {backLink}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 16 }}>
          <SkeletonCard lines={5} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  function exportEntry() {
    if (!entry) return;
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const record: Array<{ label: string; value: string }> = [
    { label: "Entry", value: entry.id },
    { label: "When", value: entry.when },
    { label: "Staff", value: `${entry.staffName} · ${entry.staffRole}` },
    { label: "Area", value: entry.area ?? AUDIT_KIND_LABEL[entry.kind] },
  ];
  if (entry.caseId) record.push({ label: "Case", value: `${entry.caseId} · ${entry.targetName}` });
  if (entry.sessionId) record.push({ label: "Session", value: entry.sessionId });

  const hasVendorOrReason = Boolean(entry.vendorFlag || entry.staffReasonQuote);
  const hasBeforeAfter = Boolean(entry.beforeAfter && entry.beforeAfter.length);

  const relatedColumns: DataTableColumn<AuditLogEntry>[] = [
    { key: "when", label: "When", numeric: true, render: (r) => <TwoLineCell primary={r.when} secondary={r.id} /> },
    { key: "action", label: "Action", render: (r) => <TwoLineCell primary={r.action} secondary={r.kind} /> },
  ];

  const metaParts = [entry.id, entry.staffName, entry.when];
  if (entry.caseId) metaParts.push(`case ${entry.caseId}`);
  metaParts.push(entry.targetName);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {backLink}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: 0 }}>
              {entry.action}
            </h1>
            <StatusPill status="approved" label="Recorded" size="sm" />
          </div>
          <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {metaParts.join(" · ")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          {entry.kind === "KYC" && entry.caseId ? (
            <Button variant="ghost" size="sm" iconLeft="doc" onClick={() => router.push(`/kyc/${entry.caseId}`)}>
              Open case
            </Button>
          ) : null}
          {client ? (
            <Button variant="ghost" size="sm" iconLeft="users" onClick={() => router.push(`/users/${client.id}`)}>
              Open client
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" iconLeft="download" onClick={exportEntry}>
            Export entry
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={cardStyle()}>
          <span style={labelStyle}>Record</span>
          {record.map((d) => (
            <div
              key={d.label}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}
            >
              <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                {d.label}
              </span>
              <span className="k-tnum" style={{ font: "var(--text-data)", color: "var(--ink)", textAlign: "right" }}>
                {d.value}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {hasVendorOrReason ? (
            <>
              {entry.vendorFlag ? (
                <div style={cardStyle()}>
                  <span style={labelStyle}>Vendor flag</span>
                  <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{entry.vendorFlag}</span>
                </div>
              ) : null}
              {entry.staffReasonQuote ? (
                <div style={cardStyle()}>
                  <span style={labelStyle}>Staff override reason</span>
                  <span style={{ font: "var(--text-body)", color: "var(--ink)" }}>&ldquo;{entry.staffReasonQuote.replace(/^"|"$/g, "")}&rdquo;</span>
                  {entry.staffReasonTiming ? (
                    <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                      Entered by {entry.staffName} · {entry.staffReasonTiming} before confirming
                    </span>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div style={cardStyle()}>
              <span style={labelStyle}>Detail</span>
              <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{entry.detail}</span>
            </div>
          )}
        </div>

        {hasBeforeAfter ? (
          <div style={cardStyle()}>
            <span style={labelStyle}>Before and after</span>
            {entry.beforeAfter!.map((b) => (
              <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
                <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                  {b.label}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="k-tnum" style={{ font: "var(--text-data)", color: "var(--ink-3)" }}>{b.before}</span>
                  <Icon name="chevronRight" size={13} color="var(--ink-3)" />
                  <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)" }}>{b.after}</span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
          Other entries on this client
        </span>
        <DataTable
          columns={relatedColumns}
          rows={related}
          rowKey={(r) => r.id}
          dense
          onRowClick={(r) => router.push(`/audit-log/${r.id}`)}
          empty="No other entries recorded for this client."
        />
      </div>
    </div>
  );
}
