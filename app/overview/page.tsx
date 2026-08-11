"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHead } from "@/components/ui/PageHead";
import { BalancePanel } from "@/components/ui/BalancePanel";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/icons/Icon";
import { TODAY_LABEL, getDeskHeadline } from "@/lib/mock/overview";
import { getDeskOverview, listKycSubmissions, listTransactions, listUsers, ApiError } from "@/lib/api/client";
import type { ApiDeskOverview, ApiKycSubmission, ApiTransaction, ApiTransactionType, KycStatus } from "@/lib/api/types";
import { koboToNaira, signedKoboToNaira } from "@/lib/money";

interface PanelState<T> {
  items: T[];
  total: number;
}

const TYPE_LABEL: Record<ApiTransactionType, string> = {
  fund: "Deposit",
  withdraw: "Withdrawal",
  buy: "Buy",
  sell: "Sell",
  convert: "Convert",
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Mirrors app/kyc/page.tsx's casePill — kept local since that page doesn't
 * export it, and the two are free to diverge in a preview-panel context. */
function casePill(status: KycStatus) {
  if (status === "approved") return <StatusPill status="approved" size="sm" />;
  if (status === "rejected") return <StatusPill status="rejected" size="sm" />;
  if (status === "pending") return <StatusPill status="pending" size="sm" />;
  return <StatusPill status="review" size="sm" />;
}

function SkeletonBar({ width, height = 12 }: { width: number | string; height?: number }) {
  return <span style={{ display: "inline-block", width, height, borderRadius: 4, background: "var(--track)" }} />;
}

function SkeletonCard({ height = 100 }: { height?: number }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, height, display: "flex", flexDirection: "column", gap: 12 }}>
      <SkeletonBar width={90} height={10} />
      <SkeletonBar width={120} height={22} />
      <SkeletonBar width={70} height={10} />
    </div>
  );
}

function SeeAllLink({ href, count }: { href: string; count: number }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        font: "var(--text-label)",
        letterSpacing: "var(--track-label)",
        color: "var(--ink-2)",
      }}
    >
      See all {count}
      <Icon name="chevronRight" size={12} color="var(--ink-2)" />
    </Link>
  );
}

function PanelEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
      <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{title}</span>
      <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 300 }}>{message}</span>
    </div>
  );
}

/** Inline, panel-scoped error — a failure here never promotes to the
 * page-level error screen (rule 7 of the fix guide): the KPI section above
 * is independently valuable and shouldn't go dark because one preview panel
 * couldn't load. */
function PanelError({ message }: { message: string }) {
  return (
    <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <span style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--loss)" }}>Couldn&apos;t load this panel</span>
      <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 300 }}>{message}</span>
    </div>
  );
}

export default function OverviewPage() {
  // Page-level (KPI row + balance panel) — unchanged from the original wiring pass.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<ApiDeskOverview | null>(null);

  // Needs-attention · pending KYC — now live, panel-scoped loading/error.
  const [kycLoading, setKycLoading] = useState(true);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycPanel, setKycPanel] = useState<PanelState<ApiKycSubmission> | null>(null);

  // Flagged transactions — now live, panel-scoped loading/error.
  const [flaggedLoading, setFlaggedLoading] = useState(true);
  const [flaggedError, setFlaggedError] = useState<string | null>(null);
  const [flaggedPanel, setFlaggedPanel] = useState<PanelState<ApiTransaction> | null>(null);

  // Best-effort client name/email lookup shared by both panels' rows — a
  // display nicety only. On failure both panels fall back to a shortened id,
  // never blank.
  const [usersById, setUsersById] = useState<Map<string, { name: string; email: string }>>(new Map());

  useEffect(() => {
    let cancelled = false;

    // SEAM: GET /desk-overview — page-level; its own error still gates the
    // whole page, since the KPI row has no independent fallback. No
    // synchronous setState here (matches app/kyc/page.tsx's pattern) — the
    // initial useState values already cover the pre-fetch state, since this
    // effect only ever runs once ([] deps).
    getDeskOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the desk overview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // SEAM: GET /kyc-submissions?status=review&page=1&pageSize=5 — fired
    // alongside the calls above (no sequential await), but tracked with its
    // own loading/error state so a failure here only degrades this panel.
    listKycSubmissions({ status: "review", page: 1, pageSize: 5 })
      .then((res) => {
        if (!cancelled) setKycPanel({ items: res.data, total: res.meta.total });
      })
      .catch((err) => {
        if (!cancelled) setKycError(err instanceof ApiError ? err.message : "Couldn't load pending KYC.");
      })
      .finally(() => {
        if (!cancelled) setKycLoading(false);
      });

    // SEAM: GET /transactions?status=flagged&page=1&pageSize=5
    listTransactions({ status: "flagged", page: 1, pageSize: 5 })
      .then((res) => {
        if (!cancelled) setFlaggedPanel({ items: res.data, total: res.meta.total });
      })
      .catch((err) => {
        if (!cancelled) setFlaggedError(err instanceof ApiError ? err.message : "Couldn't load flagged transactions.");
      })
      .finally(() => {
        if (!cancelled) setFlaggedLoading(false);
      });

    // SEAM: GET /users?page=1&pageSize=500 — side-channel name/email
    // resolution shared by both panels' Client columns, same pattern as
    // app/kyc/page.tsx and app/transactions/page.tsx already use.
    listUsers({ page: 1, pageSize: 500 })
      .then((res) => {
        if (!cancelled) setUsersById(new Map(res.data.map((u) => [u.id, { name: u.fullName, email: u.email }])));
      })
      .catch(() => {
        // name/email are display niceties only — rows fall back to a shortened id
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const headline = useMemo(
    () => (kycPanel && flaggedPanel ? getDeskHeadline(kycPanel.total, flaggedPanel.total) : ""),
    [kycPanel, flaggedPanel],
  );

  const kycColumns: DataTableColumn<ApiKycSubmission>[] = [
    {
      key: "client",
      label: "Client",
      render: (s) => <TwoLineCell primary={s.name} secondary={usersById.get(s.userId)?.email ?? shortId(s.userId)} />,
    },
    { key: "case", label: "Case", numeric: true, render: (s) => <span className="k-tnum">{shortId(s.id)}</span> },
    { key: "submittedAt", label: "Submitted", numeric: true, render: (s) => <span className="k-tnum">{fmtDate(s.submittedAt)}</span> },
    {
      key: "flag",
      label: "Flagged for",
      render: (s) => <TwoLineCell primary={s.flagReason ?? "Manual review"} secondary={s.flagDetail ?? undefined} />,
    },
    { key: "status", label: "Status", align: "right", render: (s) => casePill(s.status) },
  ];

  if (error) {
    return (
      <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
          Couldn&apos;t load the desk overview
        </span>
        <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>{error}</span>
      </div>
    );
  }

  if (loading || !overview) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SkeletonBar width={100} height={11} />
          <SkeletonBar width={220} height={26} />
          <SkeletonBar width={380} height={14} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <SkeletonCard height={176} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <SkeletonCard height={260} />
          <SkeletonCard height={260} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow={TODAY_LABEL} title="Desk overview" description={headline} />

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <BalancePanel
          label="Assets under management"
          value={koboToNaira(overview.aumTotalKobo)}
          change={{
            label: `${signedKoboToNaira(overview.aumChangeAbsKobo)} (${overview.aumChangePct >= 0 ? "+" : ""}${overview.aumChangePct}%)`,
            tone: overview.aumChangeAbsKobo >= 0 ? "gain" : "loss",
          }}
          series={overview.aumSeries}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <KpiCard
            icon="users"
            label="Total users"
            value={String(overview.totalUsers)}
            sub={overview.totalUsersTrend.label}
            subTone={overview.totalUsersTrend.tone}
          />
          <KpiCard
            icon="shield"
            label="KYC approval rate"
            value={overview.kycApprovalRate}
            sub={overview.kycApprovalTrend.label}
            subTone={overview.kycApprovalTrend.tone}
          />
          <KpiCard
            icon="clock"
            label="Pending KYC"
            value={String(overview.pendingKyc)}
            sub={overview.pendingKycTrend.label}
            subTone={overview.pendingKycTrend.tone}
          />
          <KpiCard
            icon="transfer"
            label="Active orders"
            value={String(overview.activeOrders)}
            sub={overview.activeOrdersTrend.label}
            subTone={overview.activeOrdersTrend.tone}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="k-eyebrow">Needs attention · pending KYC</span>
            <SeeAllLink href="/kyc" count={kycPanel?.total ?? 0} />
          </div>
          {kycLoading ? (
            <SkeletonCard height={260} />
          ) : kycError ? (
            <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
              <PanelError message={kycError} />
            </div>
          ) : (
            <DataTable
              columns={kycColumns}
              rows={kycPanel?.items ?? []}
              rowKey={(row) => row.id}
              empty={
                <>
                  <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
                    Nothing waiting on you
                  </span>
                  <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 320 }}>
                    New submissions land here as clients finish onboarding.
                  </span>
                </>
              }
            />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="k-eyebrow">Flagged transactions</span>
            <SeeAllLink href="/transactions" count={flaggedPanel?.total ?? 0} />
          </div>
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
            {flaggedLoading ? (
              <div style={{ padding: 4 }}>
                <SkeletonCard height={236} />
              </div>
            ) : flaggedError ? (
              <PanelError message={flaggedError} />
            ) : (flaggedPanel?.items.length ?? 0) === 0 ? (
              <PanelEmptyState title="No flags" message="Trades and withdrawals that breach a rule land here for review." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {flaggedPanel!.items.map((tx, i) => (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "14px 16px",
                      borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {usersById.get(tx.userId)?.name ?? shortId(tx.userId)}
                      </span>
                      <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)" }}>
                        {`${shortId(tx.id)} · ${TYPE_LABEL[tx.type] ?? tx.type} · ${fmtTime(tx.createdAt)}`}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "0 0 auto" }}>
                      <span
                        className="k-tnum"
                        style={{ font: "var(--text-data)", fontWeight: 700, color: tx.amountKobo < 0 ? "var(--loss)" : "var(--gain)" }}
                      >
                        {signedKoboToNaira(tx.amountKobo)}
                      </span>
                      <StatusPill status="flagged" label={tx.holdingRule ?? "Flagged"} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--hairline)" }}>
              <span className="k-eyebrow">Held pending review · none released today</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
