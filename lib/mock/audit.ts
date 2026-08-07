import type { AuditBeforeAfterField, AuditKind, AuditLogEntry } from "@/types/api";
import { USERS } from "@/lib/mock/users";

const STAFF = [
  { name: "Fola Adeyemi", role: "Compliance officer" },
  { name: "Tomi Balogun", role: "KYC reviewer" },
  { name: "Chidi Nwankwo", role: "Super admin" },
  { name: "Amaka Eze", role: "Support" },
  { name: "Segun Okoye", role: "KYC reviewer" },
];

const ACTIONS: Array<{ action: string; kind: AuditKind }> = [
  { action: "Account suspended", kind: "Account" },
  { action: "Account enabled", kind: "Account" },
  { action: "KYC approved · override", kind: "KYC" },
  { action: "KYC rejected · override", kind: "KYC" },
  { action: "Transaction opened", kind: "Transaction" },
  { action: "Payout released", kind: "Transaction" },
  { action: "Role changed", kind: "Staff" },
  { action: "Staff invited", kind: "Staff" },
  { action: "Staff deactivated", kind: "Staff" },
  { action: "Signed in", kind: "Session" },
];

function timeAt(dayOffset: number, hour: number, minute: number) {
  const base = new Date(Date.UTC(2026, 2, 14 - dayOffset, hour, minute));
  return base.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function detailFor(kind: AuditKind, target: string) {
  switch (kind) {
    case "Account":
      return `${target} — reason logged, client notified by email.`;
    case "KYC":
      return `${target} — staff decision recorded against the vendor's automated result.`;
    case "Transaction":
      return `${target} — held funds released to the client's verified bank account.`;
    case "Staff":
      return `${target} — desk access updated.`;
    case "Session":
    default:
      return `${target} — session started from a trusted device.`;
  }
}

function beforeAfterFor(kind: AuditKind): AuditBeforeAfterField[] | undefined {
  if (kind !== "KYC") return undefined;
  return [
    { label: "KYC status", before: "Under review", after: "Approved" },
    { label: "Tier", before: "Tier 1", after: "Tier 2" },
    { label: "Trading", before: "Restricted", after: "Enabled" },
    { label: "Decided by", before: "Vendor (no decision)", after: "Staff override" },
  ];
}

const ENTRY_COUNT = 52;

export const AUDIT_LOG: AuditLogEntry[] = Array.from({ length: ENTRY_COUNT }).map((_, i) => {
  const staff = STAFF[i % STAFF.length];
  const { action, kind } = ACTIONS[i % ACTIONS.length];
  const user = USERS[i % USERS.length];

  const target = kind === "Staff" ? STAFF[(i + 1) % STAFF.length].name : kind === "Session" ? staff.name : user.name;
  const targetDetail = kind === "Account" ? user.email : kind === "KYC" ? `Case KYC-${4800 + i * 3}` : kind === "Transaction" ? `TRX-${90000 + i * 11}` : kind === "Staff" ? STAFF[(i + 1) % STAFF.length].role : "Web · Lagos, NG";

  return {
    id: `AUD-${12500 - i}`,
    when: timeAt(i % 30, 8 + (i % 10), (i * 13) % 60),
    staffName: staff.name,
    staffRole: staff.role,
    action,
    kind,
    target,
    targetDetail,
    detail: detailFor(kind, target),
    sessionId: kind === "Session" ? `SESS-${8000 + i}` : undefined,
    area: kind === "KYC" ? "KYC review" : kind === "Account" ? "Users" : undefined,
    caseId: kind === "KYC" ? `KYC-${4800 + i * 3}` : undefined,
    beforeAfter: beforeAfterFor(kind),
  };
});

// SEAM: replace with GET /api/admin/audit-log
export function getAuditLog() {
  return AUDIT_LOG;
}

// SEAM: replace with GET /api/admin/audit-log/:id
export function getAuditLogEntryById(id: string) {
  return AUDIT_LOG.find((e) => e.id === id);
}
