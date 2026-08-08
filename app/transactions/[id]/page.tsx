"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Transaction } from "@/types/api";
import {
  getClientRecentTransactions,
  getCounterpartyFacts,
  getHoldingRuleDetail,
  getTransactionById,
  getTransactionFacts,
  getTransactionTimeline,
  releaseTransaction,
} from "@/lib/mock/transactions";
import { CURRENT_STAFF } from "@/lib/mock/staff";
import { useMockLoading } from "@/lib/useMockLoading";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/icons/Icon";
import { SkeletonCard, SkeletonInline } from "@/components/ui/Skeleton";

function money(t: Transaction) {
  return (
    <span className="k-tnum" style={{ font: "var(--text-data)", fontWeight: 500, color: t.tone === "gain" ? "var(--gain)" : "var(--loss)" }}>
      {t.amount}
    </span>
  );
}

const RECENT_COLUMNS: DataTableColumn<Transaction>[] = [
  { key: "client", label: "Client", render: (t) => <TwoLineCell primary={t.userName} secondary={t.userId} /> },
  { key: "type", label: "Type", render: (t) => t.type },
  { key: "asset", label: "Asset", render: (t) => (t.asset === "—" ? "—" : <span className="k-tnum">{`${t.asset} · ${t.units} @ ${t.unitPrice}`}</span>) },
  { key: "id", label: "Reference", render: (t) => <span className="k-tnum">{t.id}</span> },
  { key: "amount", label: "Amount", align: "right", render: money },
  { key: "status", label: "Status", render: (t) => <StatusPill status={t.status} label={t.statusLabel} size="sm" /> },
  { key: "on", label: "Timestamp", align: "right", render: (t) => <span className="k-tnum">{t.when}</span> },
];

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

export default function TransactionDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const loading = useMockLoading();

  const [tx, setTx] = useState<Transaction | null | undefined>(() => getTransactionById(id));
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [released, setReleased] = useState(false);

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

  const ruleDetail = getHoldingRuleDetail(tx);
  const [timeStr, dateStr] = tx.when.split(" · ");
  const facts = getTransactionFacts(tx);
  const counterparty = getCounterpartyFacts(tx);
  const timeline = getTransactionTimeline(tx);
  const recent = getClientRecentTransactions(tx);
  const amountAbs = tx.amount.replace(/^[-−+]/, "");

  const confirmRelease = () => {
    const updated = releaseTransaction(tx.id, reason || "Above tier limit override", CURRENT_STAFF.name);
    if (updated) setTx({ ...updated });
    setReleaseOpen(false);
    setReleased(true);
    setReason("");
  };

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
            <h1 className="k-tnum" style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: tx.tone === "gain" ? "var(--gain)" : "var(--loss)", margin: 0 }}>
              {tx.amount}
            </h1>
            <StatusPill status={tx.status} label={tx.statusLabel} />
          </div>
          <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {`${tx.type} · ${tx.id} · ${tx.userName} · ${tx.userId} · ${dateStr} · ${timeStr}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <Button variant="ghost" size="sm" iconLeft="users" onClick={() => router.push(`/users/${tx.userId}`)}>
            Open client
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            Return to client
          </Button>
          {tx.status === "review" ? (
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
            Payout released and settled. Logged against {CURRENT_STAFF.name}.
          </span>
        </div>
      ) : null}

      {ruleDetail ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "var(--indicator-tint)", borderRadius: "var(--r-card)" }}>
          <Icon name="alert" size={17} color="var(--indicator)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--indicator)" }}>
              {`Held by rule ${ruleDetail.code} · ${ruleDetail.message}`}
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
          rows={recent}
          rowKey={(t) => t.id}
          empty="No other transactions for this client."
          onRowClick={(t) => router.push(`/transactions/${t.id}`)}
        />
      </div>

      <Modal
        open={releaseOpen}
        title={`Release ${amountAbs} to ${tx.userName}?`}
        onClose={() => setReleaseOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setReleaseOpen(false)}>
              Cancel
            </Button>
            <Button size="md" disabled={!reason.trim()} onClick={confirmRelease}>
              Release payout
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            The payout leaves the settlement account within the hour and cannot be recalled.
            {ruleDetail ? " You are releasing above the Tier 2 daily limit, so the client's limit is treated as waived for today." : ""}
          </span>
          <Input
            label="Reason · required"
            placeholder="Why this payout can be released"
            hint={`Stored in the audit log against ${CURRENT_STAFF.name}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {`Rule ${ruleDetail?.code ?? "W-00"} override · ${tx.id} · ${dateStr}`}
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
}
