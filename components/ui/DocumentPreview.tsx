import type { KycDocument } from "@/types/api";
import { Icon } from "@/components/icons/Icon";
import { StatusPill } from "./StatusPill";

/** A submitted document in the KYC case detail — thumbnail, name, upload
 * meta, and its verification status. */
export function DocumentPreview({ document: doc }: { document: KycDocument }) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-card)",
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 40,
          height: 48,
          flex: "0 0 auto",
          borderRadius: 8,
          background: "var(--bg)",
          border: "1px solid var(--hairline)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="doc" size={20} color="var(--ink-3)" />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ font: "var(--text-card-title)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc.name}
        </span>
        <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc.meta}
        </span>
      </span>
      <StatusPill status={doc.status} label={doc.statusLabel} size="sm" />
    </div>
  );
}
