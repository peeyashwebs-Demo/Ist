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
  getDeskSummary,
  getFlaggedTransactionsPanel,
  getPendingKycPanel,
  getTodayVolume,
} from "@/lib/mock/overview";
import type { DeskSummary, FlaggedTransaction, KycSubmission, OverviewPanel, TodayVolume } from "@/types/api";

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

function PanelEmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
      <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{message}</span>
    </div>
  );
}

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DeskSummary | null>(null);
  const [volume, setVolume] = useState<TodayVolume | null>(null);
  const [kycPanel, setKycPanel] = useState<OverviewPanel<KycSubmission> | null>(null);
  const [flaggedPanel, setFlaggedPanel] = useState<OverviewPanel<FlaggedTransaction> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      // SEAM: replace with GET /api/admin/overview/summary
      setSummary(getDeskSummary());
      // SEAM: replace with GET /api/admin/overview/volume-today
      setVolume(getTodayVolume());
      // SEAM: replace with GET /api/admin/kyc?status=pending,review&sort=-waitingFor&limit=5
      setKycPanel(getPendingKycPanel(5));
      // SEAM: replace with GET /api/admin/transactions/flagged?limit=5
      setFlaggedPanel(getFlaggedTransactionsPanel(5));
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
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
    { key: "id", label: "Case ref", numeric: true },
    { key: "submittedAt", label: "Submitted", numeric: true },
    { key: "flagReason", label: "Flag reason" },
    { key: "waitingFor", label: "Waiting", align: "right", numeric: true },
  ];

  if (loading || !summary || !volume || !kycPanel || !flaggedPanel) {
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
        <BalancePanel label="Transaction volume today" value={volume.amount} change={volume.change} series={volume.series} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <KpiCard
            icon="users"
            label="Total users"
            value={String(summary.totalUsers)}
            sub={summary.totalUsersTrend.label}
            subTone={summary.totalUsersTrend.tone}
          />
          <KpiCard
            icon="shield"
            label="KYC approval rate"
            value={summary.kycApprovalRate}
            sub={summary.kycApprovalTrend.label}
            subTone={summary.kycApprovalTrend.tone}
          />
          <KpiCard
            icon="clock"
            label="Pending KYC"
            value={String(summary.pendingKyc)}
            sub={summary.pendingKycTrend.label}
            subTone={summary.pendingKycTrend.tone}
          />
          <KpiCard
            icon="transfer"
            label="Active orders"
            value={String(summary.activeOrders)}
            sub={summary.activeOrdersTrend.label}
            subTone={summary.activeOrdersTrend.tone}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
              Needs attention · pending KYC
            </span>
            <SeeAllLink href="/kyc" count={kycPanel.total} />
          </div>
          <DataTable
            columns={kycColumns}
            rows={kycPanel.items}
            rowKey={(row) => row.id}
            empty="New submissions land here as clients finish onboarding."
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
              Flagged transactions
            </span>
            <SeeAllLink href="/transactions" count={flaggedPanel.total} />
          </div>
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
            {flaggedPanel.items.length === 0 ? (
              <PanelEmptyState message="Flagged transactions land here when the risk engine holds an order for review." />
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
