"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import {
  listAuditLog,
  listStaffMembers,
  getUser,
  getKycSubmission,
  getTransaction,
  ApiError,
} from "@/lib/api/client";
import type { ApiAuditKind, ApiAuditLogEntry, ApiStaffRole, ApiUser } from "@/lib/api/types";

const LOOKUP_CAP = 500;

const AUDIT_KIND_LABEL: Record<ApiAuditKind, string> = {
  kyc: "KYC decision",
  account: "Account change",
  transaction: "Transaction",
  staff: "Staff change",
  session: "Sign-in",
};

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
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortId(id: string) {
  return id.slice(0, 8);
}

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
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<ApiAuditLogEntry | null>(null);
  const [related, setRelated] = useState<ApiAuditLogEntry[]>([]);

  // Target + client resolution — no single-entry endpoint exists, so we load
  // the newest page of the log, find the entry, and resolve its target the
  // same way the list does.
  const [client, setClient] = useState<ApiUser | null>(null);
  const [targetName, setTargetName] = useState<string>(shortId(id));

  useEffect(() => {
    let cancelled = false;
    listAuditLog({ page: 1, pageSize: 50 })
      .then(async (res) => {
        if (cancelled) return;
        const found = res.data.find((e) => e.id === id) ?? null;
        setEntry(found);
        setRelated((found ? res.data : []).filter((e) => e.id !== id && e.target === found?.target));

        if (!found) return;

        // Resolve the affected entity to a display name.
        if (found.kind === "account") {
          const u = await getUser(found.target).catch(() => null);
          if (cancelled) return;
          setClient(u);
          setTargetName(u?.fullName ?? shortId(found.target));
        } else if (found.kind === "kyc") {
          const s = await getKycSubmission(found.target).catch(() => null);
          if (cancelled) return;
          setTargetName(s?.name ?? shortId(found.target));
        } else if (found.kind === "transaction") {
          const t = await getTransaction(found.target).catch(() => null);
          if (cancelled) return;
          if (t?.userId) {
            const owner = await getUser(t.userId).catch(() => null);
            if (cancelled) return;
            if (owner) setTargetName(owner.fullName);
            else setTargetName(t.title);
          } else {
            setTargetName(t?.title ?? shortId(found.target));
          }
        } else if (found.kind === "staff" || found.kind === "session") {
          const staff = await listStaffMembers({ page: 1, pageSize: LOOKUP_CAP }).catch(() => null);
          if (cancelled) return;
          setTargetName(staff?.data.find((s) => s.id === found.target)?.name ?? shortId(found.target));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load this audit entry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function exportEntry() {
    if (!entry) return;
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-entry-${entry.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const backLink = (
    <Link
      href="/audit-log"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)", width: "fit-content" }}
    >
      <Icon name="chevronLeft" size={13} color="var(--ink-3)" />
      All audit entries
    </Link>
  );

  if (loading) {
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

  if (error || !entry) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {backLink}
        <div className="error-strip">{error ?? "Entry not found — it may have been truncated by the retention window."}</div>
      </div>
    );
  }

  const record: Array<{ label: string; value: string }> = [
    { label: "Entry", value: shortId(entry.id) },
    { label: "When", value: fmtWhen(entry.when) },
    { label: "Staff", value: `${entry.staffName} · ${roleLabel(entry.staffRole)}` },
    { label: "Area", value: AUDIT_KIND_LABEL[entry.kind] },
    { label: "Affected", value: targetName },
  ];
  if (entry.targetDetail) record.push({ label: "Ref", value: entry.targetDetail });

  const hasVendorOrReason = Boolean(entry.vendorFlag || entry.staffReasonQuote);
  const hasBeforeAfter = Boolean(entry.beforeAfter && entry.beforeAfter.length);

  const relatedColumns: DataTableColumn<ApiAuditLogEntry>[] = [
    { key: "when", label: "When", numeric: true, render: (r) => <TwoLineCell primary={fmtWhen(r.when)} secondary={shortId(r.id)} /> },
    { key: "action", label: "Action", render: (r) => <TwoLineCell primary={r.action} secondary={AUDIT_KIND_LABEL[r.kind]} /> },
    { key: "staff", label: "Staff", render: (r) => <span style={{ color: "var(--ink-2)" }}>{r.staffName}</span> },
  ];

  const metaParts = [shortId(entry.id), entry.staffName, fmtWhen(entry.when)];

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
          {entry.kind === "kyc" ? (
            <Button variant="ghost" size="sm" iconLeft="doc" onClick={() => router.push(`/kyc/${entry.target}`)}>
              Open case
            </Button>
          ) : null}
          {entry.kind === "account" && client ? (
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
            <div key={d.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
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
          ) : null}

          <div style={cardStyle()}>
            <span style={labelStyle}>Detail</span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{entry.detail}</span>
          </div>
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
