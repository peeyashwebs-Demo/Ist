import { DataTableColumn } from "@/components/ui/DataTable";
import { StatusPill, type Status } from "@/components/ui/StatusPill";
import type { UserTransactionEntry } from "@/types/api";

/** Colored, tabular-nums ± figure — shared by any table showing a signed
 * money move (transaction amounts, holding day-change, etc). */
export function move(value: string, tone: "gain" | "loss") {
  return (
    <span className="k-tnum" style={{ color: tone === "gain" ? "var(--gain)" : "var(--loss)" }}>
      {value}
    </span>
  );
}

/** StatusPill sized for a table cell, with an optional display-label override. */
export function pill(status: Status, label?: string) {
  return <StatusPill status={status} label={label} size="sm" />;
}

/** Transaction history columns — reused by the User detail screen now, and
 * intended for the Transactions monitor screen (6) later, so it lives here
 * rather than inline in a single page. */
export const txColumns: DataTableColumn<UserTransactionEntry>[] = [
  { key: "when", label: "Date", numeric: true },
  { key: "reference", label: "Reference" },
  { key: "type", label: "Type" },
  { key: "detail", label: "Detail" },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    numeric: true,
    render: (row) => move(row.amount, row.amount.trim().startsWith("-") ? "loss" : "gain"),
  },
  {
    key: "status",
    label: "Status",
    align: "right",
    render: (row) => pill(row.status, row.statusLabel),
  },
];
