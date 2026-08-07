"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusPill, DotStatus } from "@/components/ui/StatusPill";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/icons/Icon";
import { getUserById, getUserSummary, getKycAutoDecision } from "@/lib/mock/users";
import { txColumns, move } from "@/components/tables/txColumns";
import { useAccountStatusAction, SUSPEND_REASONS } from "@/lib/hooks/useAccountStatusAction";
import { CURRENT_STAFF } from "@/lib/mock/staff";
import type { AccountStatus, User, UserHolding } from "@/types/api";

const TX_PER_PAGE = 5;

function accountLabel(status: AccountStatus) {
  return status === "active" ? "Active" : "Suspended";
}

function SkeletonBar({ width, height = 12 }: { width: number | string; height?: number }) {
  return <span style={{ display: "inline-block", width, height, borderRadius: 4, background: "var(--track)" }} />;
}

function SkeletonCard() {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <SkeletonBar width={90} height={10} />
      <SkeletonBar width={120} height={22} />
      <SkeletonBar width={70} height={10} />
    </div>
  );
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [txPage, setTxPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      // SEAM: replace with GET /api/admin/users/:id
      setUser(getUserById(params.id) ?? null);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [params.id]);

  const summary = useMemo(() => (user ? getUserSummary(user) : null), [user]);
  const kycDecision = useMemo(() => (user ? getKycAutoDecision(user) : null), [user]);

  const {
    accountStatus,
    suspension,
    modal,
    reason,
    setReason,
    toast,
    openSuspendModal,
    openEnableModal,
    closeModal,
    confirmSuspend,
    confirmEnable,
    dismissToast,
  } = useAccountStatusAction(user ?? null);
  const effectiveAccountStatus = accountStatus ?? user?.accountStatus ?? "active";

  if (!loading && user === null) {
    notFound();
  }

  const txCount = user?.transactions.length ?? 0;
  const txPageCount = Math.max(1, Math.ceil(txCount / TX_PER_PAGE));
  const currentTxPage = Math.min(txPage, txPageCount);
  // SEAM: replace with GET /api/admin/users/:id/transactions
  const txPageRows = user ? user.transactions.slice((currentTxPage - 1) * TX_PER_PAGE, currentTxPage * TX_PER_PAGE) : [];

  function exportTransactionsCsv() {
    if (!user) return;
    const header = ["Date", "Reference", "Type", "Detail", "Amount", "Status"];
    const lines = user.transactions.map((t) =>
      [t.when, t.reference, t.type, t.detail, t.amount, t.statusLabel]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${user.id}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const holdingsColumns: DataTableColumn<UserHolding>[] = [
    {
      key: "symbol",
      label: "Instrument",
      render: (row) => <TwoLineCell primary={row.symbol} secondary={row.name} />,
    },
    { key: "units", label: "Units", align: "right", numeric: true },
    { key: "avgCost", label: "Avg cost", align: "right", numeric: true },
    { key: "lastPrice", label: "Last", align: "right", numeric: true },
    { key: "value", label: "Value", align: "right", numeric: true },
    {
      key: "todayChange",
      label: "Today",
      align: "right",
      numeric: true,
      render: (row) => move(row.todayChange, row.tone),
    },
  ];

  const backLink = (
    <button
      type="button"
      onClick={() => router.push("/users")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        font: "var(--text-label)",
        letterSpacing: "var(--track-label)",
        color: "var(--ink-2)",
      }}
    >
      <Icon name="back" size={14} color="var(--ink-2)" />
      All users
    </button>
  );

  if (loading || !user) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {backLink}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <SkeletonBar width={200} height={28} />
                <SkeletonBar width={90} height={20} />
                <SkeletonBar width={80} height={16} />
              </div>
              <SkeletonBar width={360} height={14} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <SkeletonBar width={110} height={44} />
              <SkeletonBar width={140} height={44} />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {backLink}

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: 0 }}>
                {user.name}
              </h1>
              <StatusPill status={user.kycStatus} />
              <DotStatus tone={effectiveAccountStatus === "active" ? "gain" : "loss"} label={accountLabel(effectiveAccountStatus)} />
            </div>
            <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {user.email} · {user.phone} · {user.city} · Joined {user.joinedAt}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
            <Button variant="secondary" iconLeft="mail">
              Message
            </Button>
            {effectiveAccountStatus === "suspended" ? (
              <Button variant="primary" iconLeft="check" onClick={openEnableModal}>
                Enable account
              </Button>
            ) : (
              <Button variant="secondary" iconLeft="lock" onClick={openSuspendModal}>
                Suspend account
              </Button>
            )}
          </div>
        </div>
      </div>

      {suspension ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            borderRadius: "var(--r-card)",
            background: "var(--status-rejected-tint)",
          }}
        >
          <Icon name="alert" size={18} color="var(--loss)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="k-tnum" style={{ font: "var(--text-card-title)", fontWeight: 700, color: "var(--loss)" }}>
              Account suspended · {suspension.at}
            </span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              Reason: {suspension.reason} · Suspended by {suspension.staffName} · {suspension.openOrdersCancelled} open orders
              cancelled
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          icon="portfolio"
          label="Portfolio value"
          value={user.portfolioValue}
          sub={suspension ? "Frozen" : summary?.portfolioTrend.label}
          subTone={suspension ? "loss" : summary?.portfolioTrend.tone}
        />
        <KpiCard
          icon="wallet"
          label="Cash balance"
          value={summary?.cashBalance ?? "—"}
          sub={suspension ? "Withdrawals blocked" : undefined}
          subTone={suspension ? "loss" : undefined}
        />
        <KpiCard icon="card" label="Lifetime deposits" value={summary?.lifetimeDeposits ?? "—"} />
        <KpiCard
          icon="transfer"
          label="Orders (30 days)"
          value={String(summary?.ordersLast30 ?? 0)}
          sub={summary?.ordersTrend?.label}
          subTone={summary?.ordersTrend?.tone}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
          Holdings
        </span>
        {/* SEAM: replace with GET /api/admin/users/:id/holdings */}
        <DataTable columns={holdingsColumns} rows={user.holdings} rowKey={(row) => row.id} empty="No open positions." />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Transaction history
          </span>
          <Button variant="ghost" size="sm" iconLeft="download" onClick={exportTransactionsCsv}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={txColumns}
          rows={txPageRows}
          rowKey={(row) => row.id}
          empty="No transactions yet."
          footer={
            txCount > 0 ? (
              <Pagination page={currentTxPage} pageCount={txPageCount} total={txCount} perPage={TX_PER_PAGE} onChange={setTxPage} />
            ) : undefined
          }
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
          KYC submission
        </span>
        {/* SEAM: replace with GET /api/admin/users/:id/kyc */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { label: "BVN", value: user.kyc.bvn },
                { label: "NIN", value: user.kyc.nin },
                { label: "Tier", value: user.kyc.tier },
                { label: "Submission date", value: user.kyc.submittedAt },
                { label: "Address", value: user.kyc.address },
                { label: "Next of kin", value: user.kyc.nextOfKin },
              ].map((field) => (
                <div key={field.label} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    {field.label}
                  </span>
                  <span style={{ font: "var(--text-data)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {field.value}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                Documents
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {user.kyc.documents.map((doc, i) => (
                  <div
                    key={doc.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 0",
                      borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    <Icon name="doc" size={18} color="var(--ink-3)" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)" }}>{doc.name}</span>
                      <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)" }}>{doc.meta}</span>
                    </div>
                    <StatusPill status={doc.status} label={doc.statusLabel} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                Automated decision
              </span>
              {kycDecision ? <StatusPill status={kycDecision.status} label={kycDecision.label} /> : null}
              {kycDecision ? (
                <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: 0 }}>{kycDecision.summary}</p>
              ) : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {user.kyc.checks.map((check, i) => (
                <div
                  key={check.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <span style={{ font: "var(--text-data)", color: "var(--ink-2)" }}>{check.label}</span>
                  <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)" }}>
                    {check.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={modal === "suspend"}
        title={`Suspend ${user.name}?`}
        onClose={closeModal}
        onConfirm={confirmSuspend}
        confirmLabel="Suspend account"
        tone="loss"
        confirmDisabled={!reason}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0 }}>
            This immediately blocks the client from trading and signing in. Open orders are cancelled at the next
            market check; settled cash and holdings are untouched. You can enable the account again at any time.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Reason
            </span>
            <Select
              aria-label="Reason"
              value={reason}
              onChange={setReason}
              options={[{ value: "", label: "Select a reason" }, ...SUSPEND_REASONS.map((r) => ({ value: r, label: r }))]}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="shield" size={14} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)" }}>
              Recorded in the audit log against {CURRENT_STAFF.name}
            </span>
          </div>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        open={modal === "enable"}
        title={`Enable ${user.name}?`}
        onClose={closeModal}
        onConfirm={confirmEnable}
        confirmLabel="Enable account"
      >
        <p style={{ margin: 0 }}>
          This immediately restores the client&apos;s ability to trade and sign in. Nothing about their holdings,
          settled cash, or transaction history was affected while the account was suspended.
        </p>
      </ConfirmationModal>

      <Toast
        open={!!toast}
        tone={toast?.tone ?? "default"}
        title={toast?.title ?? ""}
        message={toast?.message ?? ""}
        actionLabel={toast?.actionLabel}
        onAction={toast?.onAction}
        onClose={dismissToast}
      />
    </>
  );
}
