"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHead } from "@/components/ui/PageHead";
import { BalancePanel } from "@/components/ui/BalancePanel";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/icons/Icon";
import {
  TODAY_LABEL,
  getDeskHeadline,
  getFlaggedTransactionsPanel,
  getPendingKycPanel,
} from "@/lib/mock/overview";
import type { FlaggedTransaction, KycSubmission, OverviewPanel } from "@/types/api";
import { getDeskOverview, ApiError } from "@/lib/api/client";
import type { ApiDeskOverview } from "@/lib/api/types";
import { koboToNaira, signedKoboToNaira } from "@/lib/money";

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

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<ApiDeskOverview | null>(null);
  // Needs-attention / flagged-transactions panels stay on mock data for now —
  // GET /desk-overview doesn't nest them, and the wiring guide leaves calling
  // listKycSubmissions({status:'review'}) / listTransactions({status:'flagged'})
  // directly here as a follow-up, independent of the KPI section above.
  const [kycPanel, setKycPanel] = useState<OverviewPanel<KycSubmission> | null>(null);
  const [flaggedPanel, setFlaggedPanel] = useState<OverviewPanel<FlaggedTransaction> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDeskOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        // Mock panels still load locally until they're wired to the real endpoints.
        setKycPanel(getPendingKycPanel(5));
        setFlaggedPanel(getFlaggedTransactionsPanel(5));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load the desk overview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const headline = useMemo(
    () => (kycPanel && flaggedPanel ? getDeskHeadline(kycPanel.total, flaggedPanel.total) : ""),
    [kycPanel, flaggedPanel],
  );

  const kycColumns: DataTableColumn<KycSubmission>[] = [
    {
      key: "name",
      label: "Client",
      render: (row) => <TwoLineCell primary={row.name} secondary={row.email} />,
    },
    { key: "id", label: "Case", numeric: true },
    { key: "documentType", label: "Document" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusPill status={row.status} />,
    },
    { key: "portfolioValue", label: "Portfolio", align: "right", numeric: true },
    { key: "waitingFor", label: "Waiting", align: "right", numeric: true },
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

  if (loading || !overview || !kycPanel || !flaggedPanel) {
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
            <SeeAllLink href="/kyc" count={kycPanel.total} />
          </div>
          <DataTable
            columns={kycColumns}
            rows={kycPanel.items}
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="k-eyebrow">Flagged transactions</span>
            <SeeAllLink href="/transactions" count={flaggedPanel.total} />
          </div>
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
            {flaggedPanel.items.length === 0 ? (
              <PanelEmptyState title="No flags" message="Trades and withdrawals that breach a rule land here for review." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {flaggedPanel.items.map((tx, i) => (
                  <div
                    key={`${tx.client}-${tx.meta}`}
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
                        {tx.client}
                      </span>
                      <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)" }}>
                        {tx.meta}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "0 0 auto" }}>
                      <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 700, color: "var(--ink)" }}>
                        {tx.amount}
                      </span>
                      <StatusPill status="flagged" label={tx.reason} size="sm" />
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
