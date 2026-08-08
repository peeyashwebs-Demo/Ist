import type { AuditBeforeAfterField, AuditKind, AuditLogEntry } from "@/types/api";
import { USERS } from "@/lib/mock/users";
import { STAFF_MEMBERS } from "@/lib/mock/staff";
import { TRANSACTIONS } from "@/lib/mock/transactions";
import { KYC_SUBMISSIONS } from "@/lib/mock/kyc";

// Acting staff cycle — real StaffMember rows (id/name/role) from lib/mock/staff.ts,
// so both the acting staff member and the "Staff" kind's target resolve to a
// real id, matching how the real API's staffId/target fields are entity ids.
const STAFF = STAFF_MEMBERS;

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

/** Takes the human-readable targetName (never the raw target id) — the
 * sentence is for a person to read. */
function detailFor(kind: AuditKind, targetName: string) {
  switch (kind) {
    case "Account":
      return `${targetName} — reason logged, client notified by email.`;
    case "KYC":
      return `${targetName} — staff decision recorded against the vendor's automated result.`;
    case "Transaction":
      return `${targetName} — held funds released to the client's verified bank account.`;
    case "Staff":
      return `${targetName} — desk access updated.`;
    case "Session":
    default:
      return `${targetName} — session started from a trusted device.`;
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

// What the KYC vendor's automated check originally flagged, verbatim — shown
// on the entry detail's "Vendor flag" card. Cycled across KYC entries so the
// detail view reads as a real per-case record rather than one canned string.
const VENDOR_FLAGS = [
  "No auto-decision · liveness confidence 0.61 against a 0.80 threshold. BVN, name, document authenticity, sanctions and duplicate checks all passed.",
  "Auto-rejected · document image quality below threshold. NIN slip glare flagged by the vendor's OCR pass.",
  "No auto-decision · possible duplicate BVN against an existing profile, held for manual review.",
  "Auto-rejected · date of birth mismatch between the NIN record and the submitted form.",
  "No auto-decision · liveness capture timed out twice before a still frame was accepted.",
];

// The staff member's own first-person override justification — shown as a
// quoted card next to the vendor flag it responds to.
const STAFF_REASON_QUOTES = [
  "Capture is dark but the face is clearly the same as the NIN photo. Client asked to re-take the capture at next sign-in.",
  "Compared the flagged document against the BVN record myself — details match, the mismatch was a data-entry typo on our side.",
  "Confirmed with the client's existing account that this is the same duplicate identity, not fraud. Old profile has already been closed.",
  "Reviewed the document manually — the expiry date was misread by the OCR pass, the physical document is still valid.",
  "Re-ran the liveness check manually against the submitted selfie. Clear match — the vendor timeout was a connectivity issue on their end.",
];

const STAFF_REASON_TIMINGS = ["3 seconds", "5 seconds", "8 seconds", "2 seconds", "12 seconds"];

// vendorFlag/staffReasonQuote/staffReasonTiming are nullable on the real API
// and populated only when kind === "KYC" (matching the backend PR that adds
// them to AuditLogEntry) — every other kind gets null, not undefined.
function vendorFlagFor(kind: AuditKind, i: number): string | null {
  if (kind !== "KYC") return null;
  return VENDOR_FLAGS[i % VENDOR_FLAGS.length];
}

function staffReasonQuoteFor(kind: AuditKind, i: number): string | null {
  if (kind !== "KYC") return null;
  return STAFF_REASON_QUOTES[i % STAFF_REASON_QUOTES.length];
}

function staffReasonTimingFor(kind: AuditKind, i: number): string | null {
  if (kind !== "KYC") return null;
  return STAFF_REASON_TIMINGS[i % STAFF_REASON_TIMINGS.length];
}

const ENTRY_COUNT = 52;

export const AUDIT_LOG: AuditLogEntry[] = Array.from({ length: ENTRY_COUNT }).map((_, i) => {
  const staff = STAFF[i % STAFF.length];
  const { action, kind } = ACTIONS[i % ACTIONS.length];
  const user = USERS[i % USERS.length];
  const txn = TRANSACTIONS[i % TRANSACTIONS.length];
  const kycCase = KYC_SUBMISSIONS[i % KYC_SUBMISSIONS.length];
  const otherStaff = STAFF[(i + 1) % STAFF.length];

  // `target` is the acted-on entity's real id (a User/Transaction/KYC
  // submission/StaffMember id) — matches the real API's bare `target` field.
  // `targetName` is what this dashboard displays for it.
  let target: string;
  let targetName: string;
  let targetDetail: string;
  switch (kind) {
    case "Account":
      target = user.id;
      targetName = user.name;
      targetDetail = user.email;
      break;
    case "KYC":
      target = kycCase.id;
      targetName = kycCase.name;
      targetDetail = `Case ${kycCase.id}`;
      break;
    case "Transaction":
      target = txn.id;
      targetName = txn.userName;
      // Mirrors the real API's targetDetail convention seen on the docs'
      // EX_AUDIT fixture: "user:" + the owning user's id.
      targetDetail = `user:${txn.userId}`;
      break;
    case "Staff":
      target = otherStaff.id;
      targetName = otherStaff.name;
      targetDetail = otherStaff.role;
      break;
    case "Session":
    default:
      target = staff.id;
      targetName = staff.name;
      targetDetail = "Web · Lagos, NG";
      break;
  }

  return {
    id: `AUD-${12500 - i}`,
    when: timeAt(i % 30, 8 + (i % 10), (i * 13) % 60),
    staffName: staff.name,
    staffRole: staff.role,
    action,
    kind,
    target,
    targetName,
    targetDetail,
    detail: detailFor(kind, targetName),
    sessionId: kind === "Session" ? `SESS-${8000 + i}` : undefined,
    area: kind === "KYC" ? "KYC review" : kind === "Account" ? "Users" : undefined,
    caseId: kind === "KYC" ? kycCase.id : undefined,
    beforeAfter: beforeAfterFor(kind),
    vendorFlag: vendorFlagFor(kind, i),
    staffReasonQuote: staffReasonQuoteFor(kind, i),
    staffReasonTiming: staffReasonTimingFor(kind, i),
  };
});

// SEAM: replace with GET /audit-log
export function getAuditLog() {
  return AUDIT_LOG;
}

// SEAM: no single-entry fetch endpoint exists on the real API — only
// GET /audit-log (a paginated list, optionally filtered by kind/staffId)
// is documented. Find client-side from a fetched page, or flag this as a
// gap (mirrors the staff-get gap noted in lib/mock/staff.ts).
export function getAuditLogEntryById(id: string) {
  return AUDIT_LOG.find((e) => e.id === id);
}

// SEAM: this is NOT a real endpoint and never will be — the real API has no
// POST /audit-log route at all. Every audit entry is a side effect written
// by the mutating endpoint it documents (PATCH /kyc-submissions/:id/decision,
// PATCH /users/:id/suspend, PATCH /transactions/:id/hold, etc.) — there is
// no direct "write an audit entry" call for a wiring dev to hit. Once the
// KYC decision screen is wired to the real PATCH /kyc-submissions/:id/decision
// call, that call's response (plus a subsequent GET /audit-log read) is what
// should back this UI, and this function's callers should be redirected
// there — the override *reason* itself no longer belongs on the decision
// call in the first place (see KycSubmission.internalNote and
// saveKycReviewerChecklist in lib/mock/kyc.ts). This function is kept for
// now only so existing mock callers keep compiling; another agent will
// retire it when the KYC screen is rewired.
export function recordKycOverride(input: {
  submissionId: string;
  clientName: string;
  decision: "approved" | "rejected";
  reason: string;
  staffName?: string;
  staffRole?: string;
}) {
  const now = new Date();
  const action = input.decision === "approved" ? "KYC approved · override" : "KYC rejected · override";
  const staffName = input.staffName ?? STAFF[0].name;
  const staffRole = input.staffRole ?? STAFF[0].role;
  AUDIT_LOG.unshift({
    id: `AUD-${12500 + AUDIT_LOG.length + 1}`,
    when: timeAt(0, now.getHours(), now.getMinutes()),
    staffName,
    staffRole,
    action,
    kind: "KYC",
    target: input.submissionId,
    targetName: input.clientName,
    targetDetail: `Case ${input.submissionId}`,
    detail: `${input.clientName} — ${input.decision === "approved" ? "approved" : "rejected"} by staff override. Reason: ${input.reason}.`,
    area: "KYC review",
    caseId: input.submissionId,
    beforeAfter: [
      { label: "KYC status", before: "Under review", after: input.decision === "approved" ? "Approved" : "Rejected" },
      { label: "Decided by", before: "Vendor (no decision)", after: "Staff override" },
      { label: "Override reason", before: "—", after: input.reason },
    ],
    vendorFlag: VENDOR_FLAGS[AUDIT_LOG.length % VENDOR_FLAGS.length],
    staffReasonQuote: `"${input.reason}"`,
    staffReasonTiming: STAFF_REASON_TIMINGS[AUDIT_LOG.length % STAFF_REASON_TIMINGS.length],
  });
  return AUDIT_LOG[0];
}
