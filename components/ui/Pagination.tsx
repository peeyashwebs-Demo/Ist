import { Icon } from "@/components/icons/Icon";

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  perPage?: number;
  onChange?: (page: number) => void;
}

export function Pagination({ page, pageCount, total, perPage, onChange }: PaginationProps) {
  const from = perPage ? (page - 1) * perPage + 1 : 0;
  const to = perPage ? Math.min(page * perPage, total) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
      <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
        {perPage ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : `${total.toLocaleString()} results`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
          Page {page} of {pageCount}
        </span>
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
