"use client";

import { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right";
  /** Tabular-nums, 500 weight — for amounts, counts, dates. */
  numeric?: boolean;
  width?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  /** Fixed-column layout — a CSS grid template. When set, the header and row
   * cells render as distinct tracks with 16px per-cell padding (cell-pad-x)
   * instead of flexed columns, so headers never run together. */
  gridTemplateColumns?: string;
  /** Rendered when `rows` is empty — pass a message string or a full empty-state node. */
  empty?: ReactNode;
  /** Search + filter controls, rendered in a bordered strip above the table. */
  toolbar?: ReactNode;
  /** Typically a <Pagination />, rendered below the rows. */
  footer?: ReactNode;
}

/** Sortable, filterable data table — filtering/search is driven by the caller
 * (via `toolbar` + pre-filtered `rows`); this component owns row rendering,
 * sort-arrow toggling, and the empty/dense states. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir = "asc",
  onSort,
  onRowClick,
  dense = false,
  gridTemplateColumns,
  empty = "Nothing here yet",
  toolbar,
  footer,
}: DataTableProps<T>) {
  const rowHeight = dense ? "var(--row-h-dense)" : "var(--row-h)";
  const grid = Boolean(gridTemplateColumns);
  // Shared cell padding: fixed tracks pad every cell to cell-pad-x so columns
  // sit 16px apart regardless of content; flexed columns rely on container padding.
  const cellPad = grid ? { padding: "0 var(--cell-pad-x)", minWidth: 0 } : {};

  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-table)", overflow: "hidden" }}>
      {toolbar ? (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 10 }}>
          {toolbar}
        </div>
      ) : null}

      <div
        style={{
          display: grid ? "grid" : "flex",
          gridTemplateColumns,
          alignItems: "center",
          height: 40,
          padding: grid ? 0 : "0 var(--cell-pad-x)",
          borderBottom: "1px solid var(--hairline)",
          font: "var(--text-label)",
          letterSpacing: "var(--track-label)",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {columns.map((col) => (
          <span
            key={col.key}
            onClick={col.sortable ? () => onSort?.(col.key) : undefined}
            style={{
              ...(grid ? {} : { flex: col.width ? `0 0 ${col.width}` : 1, width: col.width }),
              display: "flex",
              alignItems: "center",
              justifyContent: col.align === "right" ? "flex-end" : "flex-start",
              gap: 4,
              cursor: col.sortable ? "pointer" : "default",
              userSelect: "none",
              ...cellPad,
            }}
          >
            {col.label}
            {col.sortable ? (
              <Icon
                name={sortKey === col.key ? (sortDir === "asc" ? "chevronUp" : "chevronDown") : "sort"}
                size={12}
                color="var(--ink-3)"
              />
            ) : null}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          {typeof empty === "string" ? (
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{empty}</span>
          ) : (
            empty
          )}
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{
              display: grid ? "grid" : "flex",
              gridTemplateColumns,
              alignItems: "center",
              minHeight: rowHeight,
              padding: grid ? "6px 0" : "6px var(--cell-pad-x)",
              borderBottom: "1px solid var(--hairline)",
              cursor: onRowClick ? "pointer" : "default",
            }}
          >
            {columns.map((col) => (
              <span
                key={col.key}
                className={col.numeric ? "k-tnum" : undefined}
                style={{
                  ...(grid ? {} : { flex: col.width ? `0 0 ${col.width}` : 1, width: col.width }),
                  minWidth: 0,
                  textAlign: col.align === "right" ? "right" : "left",
                  font: "var(--text-data)",
                  letterSpacing: "var(--track-data)",
                  fontWeight: col.numeric ? 500 : 400,
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: col.render ? "normal" : "nowrap",
                  ...cellPad,
                }}
              >
                {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
              </span>
            ))}
          </div>
        ))
      )}

      {footer ? <div style={{ borderTop: rows.length ? "1px solid var(--hairline)" : "none" }}>{footer}</div> : null}
    </div>
  );
}

/** Two-line cell — primary value + secondary meta, used for "Client" / "Staff" / "When" columns. */
export function TwoLineCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ font: "var(--text-data)", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {primary}
      </span>
      {secondary ? (
        <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {secondary}
        </span>
      ) : null}
    </span>
  );
}
