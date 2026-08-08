"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusPill, DotStatus, type Status } from "@/components/ui/StatusPill";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/icons/Icon";
import { move } from "@/components/tables/txColumns";
import { getUser, getUserHoldings, listTransactions, listKycSubmissions, suspendUser, reactivateUser, ApiError } from "@/lib/api/client";
import type { ApiHolding, ApiKycSubmission, ApiTransaction } from "@/lib/api/types";
import { useAuth } from "@/lib/api/auth";
import type { AccountStatus } from "@/types/api";
import { koboToNaira, signedKoboToNaira } from "@/lib/money";

const TX_PER_PAGE = 5;

const SUSPEND_REASONS = [
  "Suspicious deposit pattern",
  "Failed re-verification",
  "Client request",
  "Regulator instruction",
  "Chargeback dispute",
];

interface AccountToastState {
  tone: "error" | "success";
  title: string;
  message: string;
}

function accountLabel(status: AccountStatus) {
  return status === "active" ? "Active" : "Suspended";
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

function vendorDecisionStatus(v: ApiKycSubmission["vendorDecision"]): "pending" | "approved" | "rejected" {
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "pending";
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

interface UserDetailState {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  memberSince: string;
  accountStatus: AccountStatus;
  kycStatus: string;
  portfolioValue: number;
  returnPct: number | null;
  returnTrend: "gain" | "loss" | null;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [user, setUser] = useState<UserDetailState | null>(null);
  const [holdings, setHoldings] = useState<ApiHolding[]>([]);
  const [kyc, setKyc] = useState<ApiKycSubmission | null>(null);

  const [txPage, setTxPage] = useState(1);
  const [txRows, setTxRows] = useState<ApiTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txLoading, setTxLoading] = useState(true);

  const [modal, setModal] = useState<"suspend" | "enable" | null>(null);
  const [reason, setReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [toast, setToast] = useState<AccountToastState | null>(null);
  const [suspensionNote, setSuspensionNote] = useState<{ reason: string; at: string } | null>(null);

  // Core detail — getUser, getUserHoldings, listKycSubmissions. There's no
  // single backend call that returns a user with these nested, per the
  // wiring guide, so this is three parallel calls.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFoundFlag(false);

    Promise.all([
      getUser(params.id),
      getUserHoldings(params.id, { page: 1, pageSize: 50 }),
      listKycSubmissions({ userId: params.id, page: 1, pageSize: 1 }),
    ])
      .then(([apiUser, holdingsRes, kycRes]) => {
        if (cancelled) return;
        setUser({
          id: apiUser.id,
          fullName: apiUser.fullName,
          email: apiUser.email,
          phone: apiUser.phone,
          city: apiUser.city,
          memberSince: apiUser.memberSince,
          accountStatus: apiUser.accountStatus,
          kycStatus: apiUser.kycStatus,
          portfolioValue: apiUser.portfolioValue,
          returnPct: apiUser.returnPct,
          returnTrend: apiUser.returnTrend,
        });
        setHoldings(holdingsRes.data);
        // A user can genuinely have zero KYC submissions pre-onboarding.
        setKyc(kycRes.data[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFoundFlag(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Couldn't load this client.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Transaction history — separate call so paging it doesn't refetch
  // holdings/KYC.
  useEffect(() => {
    let cancelled = false;
    setTxLoading(true);
    listTransactions({ userId: params.id, page: txPage, pageSize: TX_PER_PAGE })
      .then((res) => {
        if (cancelled) return;
        setTxRows(res.data);
        setTxTotal(res.meta.total);
        setTxTotalPages(res.meta.totalPages);
      })
      .catch(() => {
        if (!cancelled) {
          setTxRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, txPage]);

  if (notFoundFlag) {
    notFound();
  }

  const totalReturnKobo = useMemo(() => holdings.reduce((sum, h) => sum + h.totalReturnKobo, 0), [holdings]);

  function exportTransactionsCsv() {
    if (!user) return;
    const header = ["Date", "Title", "Type", "Amount", "Status"];
    const lines = txRows.map((t) =>
      [formatDateTime(t.createdAt), t.title, t.type, koboToNaira(t.amountKobo), t.status]
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

  function openSuspendModal() {
    setReason("");
    setModal("suspend");
  }

  function openEnableModal() {
    setModal("enable");
  }

  function closeModal() {
    if (actionPending) return;
    setModal(null);
  }

  async function confirmSuspend() {
    if (!user || !reason) return;
    setActionPending(true);
    try {
      const updated = await suspendUser(user.id, reason);
      setUser((prev) => (prev ? { ...prev, accountStatus: updated.accountStatus } : prev));
      setSuspensionNote({ reason, at: formatDateTime(new Date().toISOString()) });
      setModal(null);
      setToast({
        tone: "error",
        title: "Account suspended",
        message: `${user.fullName} can no longer trade or sign in.`,
      });
    } catch (err) {
      setToast({
        tone: "error",
        title: "Couldn't suspend account",
        message: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setActionPending(false);
    }
  }

  async function confirmEnable() {
    if (!user) return;
    setActionPending(true);
    try {
      const updated = await reactivateUser(user.id);
      setUser((prev) => (prev ? { ...prev, accountStatus: updated.accountStatus } : prev));
      setSuspensionNote(null);
      setModal(null);
      setToast({
        tone: "success",
        title: "Account enabled",
        message: `${user.fullName} can trade and sign in again.`,
      });
    } catch (err) {
      setToast({
        tone: "error",
        title: "Couldn't enable account",
        message: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setActionPending(false);
    }
  }

  function dismissToast() {
    setToast(null);
  }

  const holdingsColumns: DataTableColumn<ApiHolding>[] = [
    {
      key: "ticker",
      label: "Instrument",
      render: (row) => <TwoLineCell primary={row.ticker} secondary={`${row.units.toLocaleString("en-NG")} units`} />,
    },
    { key: "units", label: "Units", align: "right", numeric: true, render: (row) => row.units.toLocaleString("en-NG") },
    { key: "avgPriceKobo", label: "Avg cost", align: "right", numeric: true, render: (row) => koboToNaira(row.avgPriceKobo) },
    { key: "marketValueKobo", label: "Value", align: "right", numeric: true, render: (row) => koboToNaira(row.marketValueKobo) },
    {
      key: "totalReturnKobo",
      label: "Return",
      align: "right",
      numeric: true,
      render: (row) => move(`${signedKoboToNaira(row.totalReturnKobo)} (${row.returnPct}%)`, row.returnTrend),
    },
  ];

  const transactionColumns: DataTableColumn<ApiTransaction>[] = [
    { key: "createdAt", label: "Date", numeric: true, render: (row) => formatDateTime(row.createdAt) },
    {
      key: "title",
      label: "Transaction",
      render: (row) => <TwoLineCell primary={row.title} secondary={row.subtitle} />,
    },
    { key: "type", label: "Type" },
    {
      key: "amountKobo",
      label: "Amount",
      align: "right",
      numeric: true,
      render: (row) => move(signedKoboToNaira(row.amountKobo), row.amountKobo < 0 ? "loss" : "gain"),
    },
    {
      key: "status",
      label: "Status",
      align: "right",
      render: (row) => <StatusPill status={row.status as Status} size="sm" />,
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

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {backLink}
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Couldn&apos;t load this client
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>{error}</span>
        </div>
      </div>
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

  const suspended = user.accountStatus === "suspended";

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
              <StatusPill status={user.kycStatus as Status} />
              <DotStatus tone={user.accountStatus === "active" ? "gain" : "loss"} label={accountLabel(user.accountStatus)} />
            </div>
            <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {user.email} · {user.phone} · {user.city} · Joined {formatDate(user.memberSince)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
            <Button variant="secondary" iconLeft="mail">
              Message
            </Button>
            {suspended ? (
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

      {suspended ? (
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
              Account suspended{suspensionNote ? ` · ${suspensionNote.at}` : ""}
            </span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {suspensionNote
                ? `Reason: ${lowerFirst(suspensionNote.reason)}. Open orders are cancelled at the next market check.`
                : "This account is currently suspended. Open orders are cancelled at the next market check."}
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          icon="portfolio"
          label="Portfolio value"
          value={koboToNaira(user.portfolioValue)}
          sub={suspended ? "Frozen" : user.returnPct != null ? `${user.returnPct}%` : undefined}
          subTone={suspended ? "loss" : user.returnTrend ?? "neutral"}
        />
        <KpiCard
          icon="wallet"
          label="Unrealized return"
          value={signedKoboToNaira(totalReturnKobo)}
          subTone={totalReturnKobo >= 0 ? "gain" : "loss"}
        />
        <KpiCard icon="card" label="Holdings" value={String(holdings.length)} />
        <KpiCard icon="transfer" label="Transactions" value={String(txTotal)} />
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
          columns={transactionColumns}
          rows={txRows}
          rowKey={(row) => row.id}
          empty={txLoading ? "Loading…" : "No transactions yet."}
          footer={
            txTotal > 0 ? (
              <Pagination page={txPage} pageCount={txTotalPages} total={txTotal} perPage={TX_PER_PAGE} onChange={setTxPage} />
            ) : undefined
          }
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
          KYC submission
        </span>
        {!kyc ? (
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: "40px 20px", textAlign: "center" }}>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>No KYC submission on file yet.</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "BVN", value: kyc.bvn },
                  { label: "NIN", value: kyc.nin },
                  { label: "Tier", value: kyc.tier },
                  { label: "Submission date", value: formatDate(kyc.submittedAt) },
                  { label: "Address", value: kyc.address },
                  { label: "Next of kin", value: `${kyc.nextOfKin.name} (${kyc.nextOfKin.relationship})` },
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
                  {kyc.documents.length === 0 ? (
                    <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>No documents uploaded.</span>
                  ) : (
                    kyc.documents.map((doc, i) => (
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
                            {doc.documentKind} · {formatDateTime(doc.uploadedAt)}
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
                  <StatusPill status={vendorDecisionStatus(kyc.vendorDecision)} />
                </div>
                <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: 0 }}>
                  {kyc.vendorDetail ?? "No vendor detail recorded for this submission."}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                  <span style={{ font: "var(--text-data)", color: "var(--ink-2)" }}>Liveness match</span>
                  <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)" }}>
                    {kyc.livenessMatchPct}%
                  </span>
                </div>
                {Object.entries(kyc.providerChecks).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderTop: "1px solid var(--hairline)",
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
        confirmDisabled={!reason || actionPending}
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
              Recorded in the audit log{session?.staffId ? ` against ${session.staffId}` : ""}
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
        confirmDisabled={actionPending}
      >
        <p style={{ margin: 0 }}>
          This immediately restores the client&apos;s ability to trade and sign in. Nothing about their holdings,
          settled cash, or transaction history was affected while the account was suspended.
        </p>
      </ConfirmationModal>

      <style>{"@keyframes k-spin { to { transform: rotate(360deg); } }"}</style>
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
