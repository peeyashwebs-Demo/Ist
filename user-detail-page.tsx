"use client";

import { useEffect, useState } from "react";
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
import { move, pill } from "@/components/tables/txColumns";
import { getUser, getUserHoldings, listTransactions, listKycSubmissions, suspendUser, reactivateUser, ApiError } from "@/lib/api/client";
import type { ApiUser, ApiHolding, ApiTransaction, ApiKycSubmission } from "@/lib/api/types";
import type { AccountStatus } from "@/types/api";
import { koboToNaira, signedKoboToNaira } from "@/lib/money";

const TX_PER_PAGE = 5;

// Common preset reasons shown in the suspend dropdown — the real
// PATCH /users/:id/suspend just takes a required non-empty `reason` string
// (no server-side enum), so these are UX presets, not a wire-format enum.
const SUSPEND_REASONS = [
  "Suspicious deposit pattern",
  "Failed re-verification",
  "Client request",
  "Regulator instruction",
  "Chargeback dispute",
];

function accountLabel(status: AccountStatus) {
  return status === "active" ? "Active" : "Suspended";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const date = new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** GET /kyc-submissions?userId= returns a list — in practice a user has at
 * most one submission. Vendor pre-check fields double as the "Automated
 * decision" panel this screen shows. */
function vendorDecisionStatus(v: ApiKycSubmission["vendorDecision"]): "pending" | "approved" | "rejected" {
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "pending";
}

/** StatusPill's Status union has no "failed" state — the real
 * ApiTransactionStatus does (a released hold's deferred transfer can land
 * there). Rendered as "rejected" (same red/terminal treatment) with the
 * real word kept as the label override. */
function txStatusPill(status: ApiTransaction["status"]) {
  if (status === "failed") return pill("rejected", "Failed");
  return pill(status);
}

/** Small inline spinner — used for the loading captions this screen and the
 * users list share (frames 4b / 3b), no shared Spinner component exists yet. */
function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid var(--hairline)",
        borderTopColor: "var(--ink-3)",
        animation: "k-spin 0.7s linear infinite",
      }}
    />
  );
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [holdings, setHoldings] = useState<ApiHolding[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ApiKycSubmission | null>(null);

  const [txPage, setTxPage] = useState(1);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(true);

  // Local account-status state, mirrors the pattern the mock hook used —
  // kept in the page itself (rather than a shared hook) since suspend/
  // reactivate here call the real endpoints directly.
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [modal, setModal] = useState<"suspend" | "enable" | null>(null);
  const [reason, setReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [toast, setToast] = useState<{ tone: "error" | "success"; title: string; message: string } | null>(null);
  const effectiveAccountStatus = accountStatus ?? user?.accountStatus ?? "active";

  // Composed screen — the real API has no single call that returns a user
  // with holdings/transactions/KYC nested (see the docs' users-get note),
  // so this is four calls: getUser, getUserHoldings, listTransactions,
  // listKycSubmissions (the last returns a list; a user has at most one
  // submission in practice — data[0], with a genuine empty case).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setLoadError(null);
      setNotFoundFlag(false);
      try {
        const [u, h, k] = await Promise.all([
          getUser(params.id),
          getUserHoldings(params.id, { pageSize: 50 }),
          listKycSubmissions({ userId: params.id, pageSize: 1 }),
        ]);
        if (cancelled) return;
        setUser(u);
        setHoldings(h.data);
        setKycSubmission(k.data[0] ?? null);
        setAccountStatus(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setNotFoundFlag(true);
        } else {
          setLoadError(e instanceof ApiError ? e.message : "Couldn't load this client. Try refreshing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setTxLoading(true);
      try {
        const res = await listTransactions({ userId: params.id, page: txPage, pageSize: TX_PER_PAGE });
        if (cancelled) return;
        setTransactions(res.data);
        setTxTotal(res.meta.total);
      } catch {
        if (!cancelled) {
          setTransactions([]);
          setTxTotal(0);
        }
      } finally {
        if (!cancelled) setTxLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [params.id, txPage]);

  if (notFoundFlag) {
    notFound();
  }

  const txPageCount = Math.max(1, Math.ceil(txTotal / TX_PER_PAGE));
  const currentTxPage = Math.min(txPage, txPageCount);

  function openSuspendModal() {
    setReason("");
    setModal("suspend");
  }
  function openEnableModal() {
    setModal("enable");
  }
  function closeModal() {
    setModal(null);
  }
  function dismissToast() {
    setToast(null);
  }

  async function confirmSuspend() {
    if (!user || !reason || actionPending) return;
    setActionPending(true);
    try {
      await suspendUser(user.id, reason);
      setAccountStatus("suspended");
      setModal(null);
      setToast({
        tone: "error",
        title: "Account suspended",
        message: `${user.fullName} can no longer trade or sign in.`,
      });
    } catch (e) {
      setToast({
        tone: "error",
        title: "Couldn't suspend account",
        message: e instanceof ApiError ? e.message : "Something went wrong. Try again.",
      });
    } finally {
      setActionPending(false);
    }
  }

  async function confirmEnable() {
    if (!user || actionPending) return;
    setActionPending(true);
    try {
      await reactivateUser(user.id);
      setAccountStatus("active");
      setModal(null);
      setToast({
        tone: "success",
        title: "Account enabled",
        message: `${user.fullName} can trade and sign in again.`,
      });
    } catch (e) {
      setToast({
        tone: "error",
        title: "Couldn't enable account",
        message: e instanceof ApiError ? e.message : "Something went wrong. Try again.",
      });
    } finally {
      setActionPending(false);
    }
  }

  function exportTransactionsCsv() {
    if (!user) return;
    const header = ["Date", "Reference", "Type", "Amount", "Status"];
    const lines = transactions.map((t) =>
      [fmtDateTime(t.createdAt), t.id, t.type, signedKoboToNaira(t.amountKobo), t.status]
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

  const holdingsColumns: DataTableColumn<ApiHolding>[] = [
    { key: "ticker", label: "Instrument", render: (row) => <TwoLineCell primary={row.ticker} secondary={`${row.units.toLocaleString("en-NG")} units`} /> },
    { key: "avgCost", label: "Avg cost", align: "right", numeric: true, render: (row) => koboToNaira(row.avgPriceKobo) },
    { key: "value", label: "Value", align: "right", numeric: true, render: (row) => koboToNaira(row.marketValueKobo) },
    {
      key: "totalReturn",
      label: "Total return",
      align: "right",
      numeric: true,
      render: (row) => move(`${signedKoboToNaira(row.totalReturnKobo)} (${row.returnPct.toFixed(2)}%)`, row.returnTrend),
    },
  ];

  const txColumns: DataTableColumn<ApiTransaction>[] = [
    { key: "when", label: "Date", numeric: true, render: (row) => fmtDateTime(row.createdAt) },
    { key: "reference", label: "Reference", render: (row) => <TwoLineCell primary={row.id} secondary={row.title} /> },
    { key: "type", label: "Type", render: (row) => row.type[0].toUpperCase() + row.type.slice(1) },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      numeric: true,
      render: (row) => move(signedKoboToNaira(row.amountKobo), row.amountKobo < 0 ? "loss" : "gain"),
    },
    { key: "status", label: "Status", align: "right", render: (row) => txStatusPill(row.status) },
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

  if (loadError) {
    return (
      <>
        {backLink}
        <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>Couldn&apos;t load this client</span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 360 }}>{loadError}</span>
        </div>
      </>
    );
  }

  if (loading || !user) {
    return (
      <>
        <style>{"@keyframes k-spin { to { transform: rotate(360deg); } }"}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {backLink}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <SkeletonBar width={200} height={28} />
                <SkeletonBar width={90} height={20} />
                <SkeletonBar width={80} height={16} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Spinner />
                <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                  Loading holdings, transactions and KYC file
                </span>
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
                {user.fullName}
              </h1>
              <StatusPill status={user.kycStatus} />
              <DotStatus tone={effectiveAccountStatus === "active" ? "gain" : "loss"} label={accountLabel(effectiveAccountStatus)} />
            </div>
            <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {user.email} · {user.phone} · {user.city}, {user.state} · Joined {fmtDate(user.memberSince)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
            <Button variant="secondary" iconLeft="mail">
              Message
            </Button>
            {effectiveAccountStatus === "suspended" ? (
              <Button variant="primary" iconLeft="check" onClick={openEnableModal} disabled={actionPending}>
                Enable account
              </Button>
            ) : (
              <Button variant="secondary" iconLeft="lock" onClick={openSuspendModal} disabled={actionPending}>
                Suspend account
              </Button>
            )}
          </div>
        </div>
      </div>

      {effectiveAccountStatus === "suspended" ? (
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
              Account suspended
            </span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              This client can&apos;t trade or sign in. The action is recorded in the audit log.
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          icon="portfolio"
          label="Portfolio value"
          value={koboToNaira(user.portfolioValue)}
          sub={effectiveAccountStatus === "suspended" ? "Frozen" : undefined}
          subTone={effectiveAccountStatus === "suspended" ? "loss" : undefined}
        />
        <KpiCard
          icon="transfer"
          label="Total return"
          value={user.returnPct != null ? `${user.returnPct.toFixed(2)}%` : "—"}
          sub={user.returnTrend ?? undefined}
          subTone={user.returnTrend ?? "neutral"}
        />
        <KpiCard icon="doc" label="Holdings" value={String(holdings.length)} />
        <KpiCard icon="card" label="CSCS number" value={user.cscsNumber ?? "Not yet assigned"} sub={user.tier} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
          Holdings
        </span>
        <DataTable columns={holdingsColumns} rows={holdings} rowKey={(row) => row.id} empty="No open positions." />
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
          rows={transactions}
          rowKey={(row) => row.id}
          empty={txLoading ? "Loading transactions…" : "No transactions yet."}
          footer={
            txTotal > 0 ? (
              <Pagination page={currentTxPage} pageCount={txPageCount} total={txTotal} perPage={TX_PER_PAGE} onChange={setTxPage} />
            ) : undefined
          }
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            KYC submission
          </span>
          {kycSubmission ? <StatusPill status={kycSubmission.status} /> : null}
        </div>
        {!kycSubmission ? (
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
            <span style={{ font: "var(--text-card-title)", color: "var(--ink)" }}>No KYC submission yet</span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 360 }}>
              This client hasn&apos;t submitted onboarding documents.
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "BVN", value: kycSubmission.bvn },
                  { label: "NIN", value: kycSubmission.nin },
                  { label: "Tier", value: kycSubmission.tier },
                  { label: "Submission date", value: fmtDate(kycSubmission.submittedAt) },
                  { label: "Address", value: `${kycSubmission.address}, ${kycSubmission.city}, ${kycSubmission.state}` },
                  {
                    label: "Next of kin",
                    value: `${kycSubmission.nextOfKin.name} · ${kycSubmission.nextOfKin.relationship} · ${kycSubmission.nextOfKin.phone}`,
                  },
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
                  {kycSubmission.documents.length === 0 ? (
                    <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>No documents uploaded.</span>
                  ) : (
                    kycSubmission.documents.map((doc, i) => (
                      <div
                        key={doc.id}
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
                          <span style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)" }}>{doc.documentName}</span>
                          <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)" }}>
                            {doc.documentKind} · uploaded {fmtDate(doc.uploadedAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    Automated decision
                  </span>
                  <StatusPill
                    status={vendorDecisionStatus(kycSubmission.vendorDecision)}
                    label={kycSubmission.vendorDecision === "no_decision" ? "No decision" : undefined}
                  />
                </div>
                <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: 0 }}>
                  {kycSubmission.vendorDetail ??
                    `Liveness match ${kycSubmission.livenessMatchPct.toFixed(1)}% · attempt ${kycSubmission.attemptCount} of ${kycSubmission.maxAttempts}.`}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {Object.entries(kycSubmission.providerChecks).map(([label, value], i) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    <span style={{ font: "var(--text-data)", color: "var(--ink-2)" }}>{label}</span>
                    <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)" }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={modal === "suspend"}
        title={`Suspend ${user.fullName}?`}
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
              Recorded in the audit log against your staff account
            </span>
          </div>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        open={modal === "enable"}
        title={`Enable ${user.fullName}?`}
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
        onClose={dismissToast}
      />
    </>
  );
}
