"use client";

import { Icon } from "@/components/icons/Icon";

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  perPage?: number;
  onChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  /** Rows-per-page options shown when provided. */
  perPageOptions?: number[];
}

function pageNumbers(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < pageCount - 1) pages.push("…");
  pages.push(pageCount);
  return pages;
}

export function Pagination({ page, pageCount, total, perPage, onChange, onPerPageChange, perPageOptions }: PaginationProps) {
  const from = perPage ? (page - 1) * perPage + 1 : 0;
  const to = perPage ? Math.min(page * perPage, total) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {perPage ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : `${total.toLocaleString()} results`}
        </span>
        {perPageOptions && onPerPageChange ? (
          <select
            aria-label="Rows per page"
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            style={{
              height: 28,
              padding: "0 8px",
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-input)",
              font: "var(--text-micro)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange?.(page - 1)}
          style={{
            width: 30,
            height: 30,
            display: "grid",
            placeItems: "center",
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: "50%",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.4 : 1,
          }}
        >
          <Icon name="chevronLeft" size={16} color="var(--ink)" />
        </button>
        {pageNumbers(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} style={{ font: "var(--text-micro)", color: "var(--ink-3)", padding: "0 2px" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              onClick={() => onChange?.(p)}
              style={{
                minWidth: 30,
                height: 30,
                padding: "0 4px",
                display: "grid",
                placeItems: "center",
                background: p === page ? "var(--indicator)" : "var(--paper)",
                border: `1px solid ${p === page ? "var(--indicator)" : "var(--hairline)"}`,
                borderRadius: "var(--r-chip)",
                color: p === page ? "var(--feature-ink)" : "var(--ink-2)",
                font: "var(--text-micro)",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onChange?.(page + 1)}
          style={{
            width: 30,
            height: 30,
            display: "grid",
            placeItems: "center",
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: "50%",
            cursor: page >= pageCount ? "not-allowed" : "pointer",
            opacity: page >= pageCount ? 0.4 : 1,
          }}
        >
          <Icon name="chevronRight" size={16} color="var(--ink)" />
        </button>
      </div>
    </div>
  );
}
