"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ApiTransaction, ApiTransactionStatus, ApiTransactionType } from "@/lib/api/types";
import {
  getTransaction,
  getUser,
  listTransactions,
  holdTransaction,
  releaseTransaction,
  rejectTransaction,
  ApiError,
} from "@/lib/api/client";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill, type Status } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/icons/Icon";
import { SkeletonCard, SkeletonInline } from "@/components/ui/Skeleton";
import { koboToNaira, signedKoboToNaira } from "@/lib/money";

const STATUS_PILL: Record<ApiTransactionStatus, { status: Status; label: string }> = {
  pending: { status: "pending", label: "Pending" },
  review: { status: "review", label: "Held" },
  flagged: { status: "flagged", label: "Flagged" },
  approved: { status: "approved", label: "Settled" },
  completed: { status: "completed", label: "Completed" },
  rejected: { status: "rejected", label: "Rejected" },
  failed: { status: "rejected", label: "Failed" },
};

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

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

function statusPill(t: ApiTransaction) {
  const pill = STATUS_PILL[t.status] ?? STATUS_PILL.pending;
  return <StatusPill status={pill.status} label={pill.label} size="sm" />;
}

const RECENT_COLUMNS: DataTableColumn<ApiTransaction>[] = [
  { key: "client", label: "Client", render: (t) => <TwoLineCell primary={t.title} secondary={shortId(t.userId)} /> },
  { key: "type", label: "Type", render: (t) => TYPE_LABEL[t.type] ?? t.type },
  { key: "id", label: "Reference", render: (t) => <span className="k-tnum">{shortId(t.id)}</span> },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    render: (t) => (
      <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: t.amountKobo < 0 ? "var(--loss)" : "var(--gain)" }}>
        {signedKoboToNaira(t.amountKobo)}
      </span>
    ),
  },
  { key: "status", label: "Status", render: statusPill },
  { key: "on", label: "Timestamp", align: "right", render: (t) => <span className="k-tnum">{fmtWhen(t.createdAt)}</span> },
];

// Fixed-track layout — flex columns run together at the track boundary (the
// right-aligned Amount visibly touching the left-aligned Status). Distinct
// grid tracks with per-cell padding keep every column separated.
const RECENT_GRID = "minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.3fr)";

function FactPanel({ title, facts }: { title: string; facts: { label: string; value: string }[] }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{title}</span>
      {facts.map((f, i) => (
        <div
          key={f.label}
          style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: i < facts.length - 1 ? "1px solid var(--hairline)" : "none" }}
        >
          <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>{f.label}</span>
          <span className="k-tnum" style={{ font: "var(--text-data)", color: "var(--ink)", textAlign: "right" }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

interface ToastState {
  tone: "error" | "success";
  title: string;
  message: string;
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<ApiTransaction | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);

  const [recent, setRecent] = useState<ApiTransaction[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [released, setReleased] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTransaction(id)
      .then((t) => {
        if (!cancelled) setTx(t);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError(null);
          setTx(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Couldn't load this transaction.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Client display name for the header/modal copy — the real transaction
  // carries userId only; a single user lookup fills the name in.
  useEffect(() => {
    if (!tx) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientName(null);
    getUser(tx.userId)
      .then((u) => {
        if (!cancelled) setClientName(u.fullName);
      })
      .catch(() => {
        // fall back to the raw userId
      });
    return () => {
      cancelled = true;
    };
  }, [tx]);

  // This client's recent activity — GET /transactions supports a staff-only
  // userId filter, so no N+1 paging needed; exclude the row being viewed.
  useEffect(() => {
    if (!tx) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentLoading(true);
    listTransactions({ userId: tx.userId, page: 1, pageSize: 20 })
      .then((res) => {
        if (!cancelled) setRecent(res.data.filter((t) => t.id !== tx.id));
      })
      .catch(() => {
        // recent activity is a nicety — an empty table renders if it fails
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tx]);

  if (loading) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonInline width={120} height={11} />
          <SkeletonInline width={280} height={28} />
          <SkeletonInline width={440} height={12} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16 }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
        <SkeletonCard lines={5} />
      </>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link
          href="/transactions"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)", width: "fit-content" }}
        >
          <Icon name="chevronLeft" size={13} color="var(--ink-3)" />
          All transactions
        </Link>
        <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
          <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--ink)" }}>Couldn&apos;t load this transaction</span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => router.push("/transactions")} style={{ alignSelf: "flex-start", marginTop: 8 }}>
            Back to monitor
          </Button>
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link
          href="/transactions"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)", width: "fit-content" }}
        >
          <Icon name="chevronLeft" size={13} color="var(--ink-3)" />
          All transactions
        </Link>
        <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
          <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--ink)" }}>Transaction not found</span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            No transaction matches {id}. It may have settled off the monitor, or the reference is wrong.
          </span>
          <Button variant="secondary" size="sm" onClick={() => router.push("/transactions")} style={{ alignSelf: "flex-start", marginTop: 8 }}>
            Back to monitor
          </Button>
        </div>
      </div>
    );
  }

  const typeLabel = TYPE_LABEL[tx.type] ?? tx.type;
  const absAmount = koboToNaira(Math.abs(tx.amountKobo));
  const canHold = tx.status !== "review";
  const isHeld = tx.status === "review";

  const openHold = () => {
    setHoldReason("");
    setHoldOpen(true);
  };
  const openReject = () => {
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmHold = async () => {
    if (!tx || !holdReason.trim()) return;
    setActionPending(true);
    try {
      const updated = await holdTransaction(tx.id, holdReason.trim());
      setTx({ ...updated });
      setHoldOpen(false);
      setToast({ tone: "success", title: "Transaction held", message: `${absAmount} moved into review. Reason logged against your name.` });
    } catch (err) {
      setToast({ tone: "error", title: "Couldn't hold transaction", message: err instanceof ApiError ? err.message : "Something went wrong. Try again." });
    } finally {
      setActionPending(false);
    }
  };

  const confirmRelease = async () => {
    if (!tx) return;
    setActionPending(true);
    try {
      const updated = await releaseTransaction(tx.id);
      setTx({ ...updated });
      setReleaseOpen(false);
      setReleased(true);
      setToast({ tone: "success", title: "Payout released", message: `${absAmount} released to ${clientName ?? "the client"}. Status is now ${STATUS_PILL[updated.status]?.label ?? updated.status}.` });
    } catch (err) {
      setToast({ tone: "error", title: "Couldn't release transaction", message: err instanceof ApiError ? err.message : "Something went wrong. Try again." });
    } finally {
      setActionPending(false);
    }
  };

  const confirmReject = async () => {
    if (!tx || !rejectReason.trim()) return;
    setActionPending(true);
    try {
      const updated = await rejectTransaction(tx.id, rejectReason.trim());
      setTx({ ...updated });
      setRejectOpen(false);
      setToast({ tone: "success", title: "Transaction rejected", message: `${absAmount} returned and the balance hold reversed.` });
    } catch (err) {
      setToast({ tone: "error", title: "Couldn't reject transaction", message: err instanceof ApiError ? err.message : "Something went wrong. Try again." });
    } finally {
      setActionPending(false);
    }
  };

  const facts = [
    { label: "Reference", value: tx.id },
    { label: "Type", value: tx.method ? `${typeLabel} · ${tx.method}` : typeLabel },
    { label: "Amount", value: absAmount },
    { label: "Requested", value: fmtWhen(tx.createdAt) },
    { label: "Holding rule", value: tx.holdingRule ?? "—" },
  ];

  const counterparty = [
    { label: "Beneficiary", value: clientName ?? tx.userId },
    { label: "Bank", value: tx.counterparty ?? tx.bankCode ?? "—" },
    { label: "Account", value: tx.accountNumber ?? "—" },
    { label: "Method", value: tx.method ?? "—" },
  ];

  const timeline =
    tx.statusHistory && tx.statusHistory.length
      ? tx.statusHistory.map((event) => ({ when: fmtWhen(event.when), what: event.label, who: event.by ?? "System" }))
      : [{ when: fmtWhen(tx.createdAt), what: `${typeLabel} submitted`, who: clientName ?? tx.userId }];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            href="/transactions"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)", width: "fit-content" }}
          >
            <Icon name="chevronLeft" size={13} color="var(--ink-3)" />
            All transactions
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="k-tnum" style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: tx.amountKobo < 0 ? "var(--loss)" : "var(--gain)", margin: 0 }}>
              {signedKoboToNaira(tx.amountKobo)}
            </h1>
            {statusPill(tx)}
          </div>
          <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {`${typeLabel} · ${shortId(tx.id)} · ${clientName ?? tx.userId} · ${shortId(tx.userId)} · ${fmtWhen(tx.createdAt)}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <Button variant="ghost" size="sm" iconLeft="users" onClick={() => router.push(`/users/${tx.userId}`)}>
            Open client
          </Button>
          <Button variant="ghost" size="sm" iconLeft="lock" onClick={() => router.back()}>
            Return
          </Button>
          {isHeld ? (
            <Button variant="secondary" size="sm" iconLeft="alert" onClick={openReject}>
              Reject
            </Button>
          ) : (
            <Button variant="secondary" size="sm" iconLeft="lock" onClick={openHold} disabled={!canHold}>
              Hold
            </Button>
          )}
          {isHeld ? (
            <Button size="sm" iconLeft="check" onClick={() => setReleaseOpen(true)}>
              Release payout
            </Button>
          ) : null}
        </div>
      </div>

      {released ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--status-approved-tint)", borderRadius: "var(--r-card)" }}>
          <Icon name="check" size={18} color="var(--gain)" />
          <span style={{ font: "var(--text-body)", color: "var(--ink)" }}>
            Payout released and settled. Logged against your name.
          </span>
        </div>
      ) : null}

      {tx.holdingRule ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "var(--indicator-tint)", borderRadius: "var(--r-card)" }}>
          <Icon name="alert" size={17} color="var(--indicator)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--indicator)" }}>
              {`Held by rule · ${tx.holdingRule}`}
            </span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              Funds are ring-fenced in the client&apos;s wallet until the desk decides. Releasing is logged against your name.
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16, alignItems: "start" }}>
        <FactPanel title="Transaction" facts={facts} />
        <FactPanel title="Counterparty" facts={counterparty} />
        <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Status history</span>
          {timeline.map((event, i) => (
            <div key={`${event.what}-${i}`} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: i < timeline.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <span className="k-tnum" style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)", width: 132, flex: "0 0 auto" }}>
                {event.when}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ font: "var(--text-data)", color: "var(--ink)" }}>{event.what}</span>
                <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)" }}>{event.who}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>This client&apos;s recent activity</span>
        <DataTable
          columns={RECENT_COLUMNS}
          rows={recentLoading ? [] : recent}
          rowKey={(t) => t.id}
          gridTemplateColumns={RECENT_GRID}
          empty={recentLoading ? "Loading recent activity…" : "No other transactions for this client."}
          onRowClick={(t) => router.push(`/transactions/${t.id}`)}
        />
      </div>

      <Modal
        open={holdOpen}
        title={`Hold ${absAmount} to ${clientName ?? "this client"}?`}
        onClose={() => setHoldOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setHoldOpen(false)} disabled={actionPending}>
              Cancel
            </Button>
            <Button size="md" disabled={!holdReason.trim() || actionPending} loading={actionPending} onClick={confirmHold}>
              Hold transaction
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            Moving this into review ring-fences the funds in the client&apos;s wallet and notifies them. The desk then decides to release or reject.
          </span>
          <Input
            label="Reason · required"
            placeholder="Why this transaction is being held"
            hint="Shown to the investor and stored in the audit log"
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {`Hold logged against your name · ${tx.id}`}
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={releaseOpen}
        title={`Release ${absAmount} to ${clientName ?? "this client"}?`}
        onClose={() => setReleaseOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setReleaseOpen(false)} disabled={actionPending}>
              Cancel
            </Button>
            <Button size="md" disabled={actionPending} loading={actionPending} onClick={confirmRelease}>
              Release payout
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            The payout leaves the settlement account within the hour and cannot be recalled.
            {tx.holdingRule ? ` You are releasing the hold set on ${tx.holdingRule}.` : ""}
          </span>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {`Release logged against your name · ${tx.id}`}
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={rejectOpen}
        title={`Reject ${absAmount} to ${clientName ?? "this client"}?`}
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setRejectOpen(false)} disabled={actionPending}>
              Cancel
            </Button>
            <Button size="md" disabled={!rejectReason.trim() || actionPending} loading={actionPending} onClick={confirmReject}>
              Reject transaction
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            Rejecting marks the transaction as failed (terminal) and reverses any pending balance hold.
          </span>
          <Input
            label="Reason · required"
            placeholder="Why this transaction is being rejected"
            hint="Shown to the investor and stored in the audit log"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {`Rejection logged against your name · ${tx.id}`}
            </span>
          </div>
        </div>
      </Modal>

      <Toast
        open={toast !== null}
        tone={toast?.tone ?? "default"}
        title={toast?.title ?? ""}
        message={toast?.message ?? ""}
        onClose={() => setToast(null)}
      />
    </>
  );
}
