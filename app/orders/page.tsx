"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiOrder, ApiOrderStatus } from "@/lib/api/types";
import { listOrders, approveOrder, rejectOrder, ApiError } from "@/lib/api/client";
import { DataTable, DataTableColumn, TwoLineCell } from "@/components/ui/DataTable";
import { StatusPill, Status } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { PageHead } from "@/components/ui/PageHead";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/icons/Icon";
import { SkeletonTable, SkeletonInline } from "@/components/ui/Skeleton";
import { koboToNaira } from "@/lib/money";

const PER_PAGE = 12;
// Cap for the separate "stats" fetch (pending count + value) below — the
// queue is described as a narrow, self-clearing cleanup surface, so this
// comfortably covers real volumes without paging through the whole book.
const STATS_CAP = 200;

type StatusFilter = ApiOrderStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending only" },
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const ORDER_STATUS_PILL: Record<ApiOrderStatus, Status> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

/** ISO timestamp → "10:42 · 14 Mar 2026", matching the rest of the desk's display convention. */
function fmtWhen(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${time} · ${date}`;
}

/** Bordered strip of tiles separated by hairlines — mirrors the KYC and
 * transactions screens' "automation stays in view" summary. */
function StatStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      {items.map((item, i) => (
        <div key={item.label} style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 3, borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{item.label}</span>
          <span className="k-tnum" style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatStripSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} style={{ flex: 1, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8, borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
          <SkeletonInline width={110} height={9} />
          <SkeletonInline width={70} height={16} />
        </div>
      ))}
    </div>
  );
}

function NoMatches() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0", textAlign: "center", maxWidth: 440 }}>
      <span style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--track)", display: "grid", placeItems: "center" }}>
        <Icon name="markets" size={20} color="var(--ink-3)" />
      </span>
      <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>No orders match this filter</span>
      <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>Try a different status, or clear the search.</span>
    </div>
  );
}

/** The everyday state — the market cleared everything on its own, so there's
 * nothing waiting on the desk. Reports what happened instead of a bare
 * empty table, matching the KYC queue's "all clear" convention. */
function QueueAllClear({ onSeeAll }: { onSeeAll: () => void }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: "56px 24px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", maxWidth: 480 }}>
        <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--status-approved-tint)", display: "grid", placeItems: "center" }}>
          <Icon name="check" size={24} color="var(--gain)" />
        </span>
        <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>Queue is empty</span>
        <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
          Every order crossed the market price and auto-filled with no staff involvement. This queue only fills when a limit order is left sitting away
          from the market — nothing to clean up right now.
        </span>
      </div>
      <Button variant="secondary" size="sm" iconLeft="doc" onClick={onSeeAll}>
        See all orders
      </Button>
    </div>
  );
}

export default function OrdersPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingValueKobo, setPendingValueKobo] = useState(0);
  const [statsCapped, setStatsCapped] = useState(false);

  const [active, setActive] = useState<ApiOrder | null>(null);
  const [reason, setReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listOrders({ page, pageSize: PER_PAGE, status: status === "all" ? undefined : status })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load orders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, page, refreshKey]);

  // Separate lightweight fetch that always looks at status=pending,
  // regardless of the status filter above — drives the "awaiting a
  // decision" stat and the empty-queue state.
  useEffect(() => {
    let cancelled = false;
    listOrders({ status: "pending", page: 1, pageSize: STATS_CAP })
      .then((res) => {
        if (cancelled) return;
        setPendingCount(res.meta.total);
        setPendingValueKobo(res.data.reduce((s, o) => s + o.value, 0));
        setStatsCapped(res.meta.total > res.data.length);
      })
      .catch(() => {
        if (!cancelled) setPendingCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.clientName.toLowerCase().includes(q) ||
        o.userId.toLowerCase().includes(q) ||
        o.ticker.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    );
  }, [orders, query]);

  const statItems = [
    {
      label: "Awaiting a decision",
      value: pendingCount == null ? "—" : `${pendingCount}${statsCapped ? "+" : ""} · ${koboToNaira(pendingValueKobo)}${statsCapped ? "+" : ""}`,
    },
    { label: "On this page", value: String(filteredRows.length) },
  ];

  const openOrder = (o: ApiOrder) => {
    setActive(o);
    setReason("");
  };

  const closeModal = () => {
    if (actionPending) return;
    setActive(null);
    setReason("");
  };

  async function confirmApprove() {
    if (!active) return;
    setActionPending(true);
    try {
      const updated = await approveOrder(active.id);
      setToast({
        title: `${active.id} approved`,
        message: `Filled at ${koboToNaira(updated.price)} · units applied to ${active.clientName}'s holding.`,
      });
      setActive(null);
      setReason("");
      setRefreshKey((n) => n + 1);
    } catch (err) {
      setToast({
        title: "Couldn't approve order",
        message: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setActionPending(false);
    }
  }

  async function confirmReject() {
    if (!active || !reason.trim()) return;
    setActionPending(true);
    try {
      await rejectOrder(active.id, reason.trim());
      setToast({ title: `${active.id} rejected`, message: reason.trim() });
      setActive(null);
      setReason("");
      setRefreshKey((n) => n + 1);
    } catch (err) {
      setToast({
        title: "Couldn't reject order",
        message: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setActionPending(false);
    }
  }

  const GRID = "minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.3fr)";

  const columns: DataTableColumn<ApiOrder>[] = [
    { key: "client", label: "Client", render: (o) => <TwoLineCell primary={o.clientName} secondary={o.userId} /> },
    { key: "side", label: "Side", render: (o) => (o.side === "buy" ? "Buy" : "Sell") },
    { key: "ticker", label: "Ticker", render: (o) => <TwoLineCell primary={o.ticker} secondary={o.orderType === "limit" ? "Limit" : "Market"} /> },
    { key: "units", label: "Units", align: "right", render: (o) => <span className="k-tnum">{o.units.toLocaleString("en-NG")}</span> },
    { key: "limitPrice", label: "Limit price", align: "right", render: (o) => <span className="k-tnum">{o.limitPrice != null ? koboToNaira(o.limitPrice) : "—"}</span> },
    { key: "value", label: "Value", align: "right", render: (o) => <span className="k-tnum">{koboToNaira(o.value)}</span> },
    { key: "status", label: "Status", render: (o) => <StatusPill status={ORDER_STATUS_PILL[o.status]} size="sm" /> },
    { key: "createdAt", label: "Placed", align: "right", render: (o) => <span className="k-tnum">{fmtWhen(o.createdAt)}</span> },
  ];

  const toolbar = (
    <>
      <SearchPill value={query} onChange={setQuery} placeholder="Search client or ticker" width={240} />
      <Select aria-label="Filter by status" value={status} onChange={(v) => { setStatus(v as StatusFilter); setPage(1); }} height={36} width={160} options={STATUS_OPTIONS} />
    </>
  );

  const isAllClear = !loading && !error && status === "pending" && !query.trim() && pendingCount === 0;

  if (error) {
    return (
      <>
        <PageHead
          eyebrow="Order management · uncrossed limit orders only"
          title="Order queue"
          description="Not a review-every-trade gate. Market orders, and limit orders that cross the market price immediately, auto-fill with zero staff involvement. What lands here is the stale-order cleanup: a limit order the market hasn't crossed yet, still sitting pending."
        />
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
            Couldn&apos;t load orders
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>{error}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Order management · uncrossed limit orders only"
        title="Order queue"
        description="Not a review-every-trade gate. Market orders, and limit orders that cross the market price immediately, auto-fill with zero staff involvement. What lands here is the stale-order cleanup: a limit order the market hasn't crossed yet, still sitting pending."
      />

      {loading ? (
        <>
          <StatStripSkeleton />
          <SkeletonTable rows={6} cols={8} />
        </>
      ) : isAllClear ? (
        <QueueAllClear onSeeAll={() => setStatus("all")} />
      ) : (
        <>
          <StatStrip items={statItems} />
          <DataTable
            columns={columns}
            rows={filteredRows}
            rowKey={(o) => o.id}
            onRowClick={openOrder}
            empty={<NoMatches />}
            toolbar={toolbar}
            gridTemplateColumns={GRID}
            footer={
              total > PER_PAGE ? (
                <Pagination page={page} pageCount={totalPages} total={total} perPage={PER_PAGE} onChange={setPage} />
              ) : null
            }
          />
        </>
      )}

      <Modal
        open={active !== null}
        title={active ? `${active.side === "buy" ? "Buy" : "Sell"} ${active.units.toLocaleString("en-NG")} ${active.ticker} · ${active.id}` : ""}
        onClose={closeModal}
        footer={
          active?.status === "pending" ? (
            <>
              <Button variant="ghost" size="md" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="secondary" size="md" disabled={!reason.trim() || actionPending} onClick={confirmReject}>
                Reject
              </Button>
              <Button size="md" iconLeft="check" disabled={actionPending} onClick={confirmApprove}>
                Approve
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="md" onClick={closeModal}>
              Close
            </Button>
          )
        }
      >
        {active ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {active.status === "pending"
                ? `Placed by ${active.clientName} at a limit of ${active.limitPrice != null ? koboToNaira(active.limitPrice) : "—"} — the market hasn't crossed it yet. Approving fills the order at that price and updates the holding; rejecting cancels it with no side effect.`
                : `This order is already ${active.status}. No further action is available.`}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Client", value: `${active.clientName} · ${active.userId}` },
                { label: "Order type", value: active.orderType === "limit" ? "Limit" : "Market" },
                { label: "Limit price", value: active.limitPrice != null ? koboToNaira(active.limitPrice) : "—" },
                { label: "Fill price", value: koboToNaira(active.price) },
                { label: "Placed", value: fmtWhen(active.createdAt) },
              ].map((f, i, arr) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>{f.label}</span>
                  <span className="k-tnum" style={{ font: "var(--text-data)", color: "var(--ink)" }}>{f.value}</span>
                </div>
              ))}
            </div>
            {active.status === "pending" ? (
              <Input
                label="Reason · required to reject"
                placeholder="Why this order is being cancelled"
                hint="Stored in the audit log — approving needs no reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Toast
        open={toast !== null}
        tone="success"
        title={toast?.title ?? ""}
        message={toast?.message ?? ""}
        onClose={() => setToast(null)}
      />
    </>
  );
}
