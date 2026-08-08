import type { KycCheck, KycDocument, KycRejectReason, KycStatus, KycSubmission } from "@/types/api";
import { USERS } from "@/lib/mock/users";

const FLAG_REASONS: Array<{ reason: string; detail: string }> = [
  { reason: "Document mismatch", detail: "Name on NIN slip differs from BVN record" },
  { reason: "Liveness confidence low", detail: "Selfie match score below 90% threshold" },
  { reason: "Duplicate BVN", detail: "BVN already linked to another account" },
  { reason: "Document expired", detail: "International passport expired 2025-11-02" },
  { reason: "Sanctions possible hit", detail: "Partial name match on watchlist screen" },
  { reason: "Manual review requested", detail: "Vendor confidence below auto-approve bar" },
];

const DOC_TYPES: KycSubmission["documentType"][] = ["NIN", "Passport", "Driver's licence", "Re-submission"];

const VENDOR_DECISIONS: Array<{ decision: KycSubmission["vendorDecision"]; detail: string }> = [
  { decision: "No decision", detail: "Vendor could not reach a confident result" },
  { decision: "Rejected", detail: "Vendor flagged a document/selfie mismatch" },
  { decision: "Approved", detail: "Vendor cleared the checks; staff spot-check" },
];

function money(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function waiting(hours: number, minutes: number) {
  return `${hours}h ${minutes}m`;
}

/** The desk's "today", consistent with the rest of the mock (14 Mar 2026). */
function dateAt(dayOffset: number) {
  const base = new Date(Date.UTC(2026, 2, 14));
  base.setUTCDate(base.getUTCDate() - dayOffset);
  return base.toISOString().slice(0, 10);
}

function displayDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Per-flag documents — the document that tripped the flag carries the
 * non-verified status; the rest read as verified. */
function makeDocuments(flag: string, seed: number): KycDocument[] {
  const docs: Array<{ name: string; meta: string }> = [
    { name: "NIN slip", meta: "Uploaded · front and back" },
    { name: "Proof of address", meta: "Utility bill · issued Jan 2026" },
    { name: "Selfie liveness", meta: "Liveness capture · 14 Mar 2026" },
  ];

  return docs.map((d, i) => {
    let status: KycStatus = "approved";
    let statusLabel = "Verified";
    if (flag === "Document mismatch" && i === 0) {
      status = "rejected";
      statusLabel = "Mismatch";
    } else if (flag === "Liveness confidence low" && i === 2) {
      status = "review";
      statusLabel = "Recheck";
    } else if (flag === "Document expired" && i === 0) {
      status = "expired";
      statusLabel = "Expired";
    } else if (flag === "Duplicate BVN" && i === 0) {
      status = "review";
      statusLabel = "Recheck";
    } else if (flag === "Sanctions possible hit" && i === 0) {
      status = "review";
      statusLabel = "Recheck";
    }
    // Deterministic variety — a couple of rows have a second weak doc.
    if (status === "approved" && i === 2 && seed % 9 === 0) {
      status = "review";
      statusLabel = "Recheck";
    }
    return { name: d.name, meta: d.meta, status, statusLabel };
  });
}

function makeChecks(flag: string, vendorDecision: KycSubmission["vendorDecision"], seed: number): KycCheck[] {
  const faceScore = vendorDecision === "Approved" ? 94 + (seed % 4) : 58 + (seed % 28);
  const bvnMatch = flag === "Document mismatch" ? "Mismatch" : flag === "Duplicate BVN" ? "Duplicate" : "Match";
  const liveness =
    flag === "Liveness confidence low" ? "Inconclusive" : vendorDecision === "Approved" ? "Passed" : seed % 3 === 0 ? "Inconclusive" : "Passed";
  const watchlist = flag === "Sanctions possible hit" ? "Possible hit" : "No hits";

  return [
    { label: "Name matches BVN", value: bvnMatch },
    { label: "Face match score", value: `${faceScore}.${seed % 10}%` },
    { label: "Liveness check", value: liveness },
    { label: "Sanctions / PEP screen", value: watchlist },
  ];
}

const SUBMISSION_COUNT = 34;

// Every pending/review user in USERS gets a queue case — plus a handful more
// so the queue outnumbers the KYC-flagged user pool, like a real backlog.
const candidateUsers = USERS.filter((u) => u.kycStatus === "review" || u.kycStatus === "pending");
const fallbackUsers = USERS.filter((u) => !candidateUsers.includes(u));

export const KYC_SUBMISSIONS: KycSubmission[] = Array.from({ length: SUBMISSION_COUNT }).map((_, i) => {
  const user = candidateUsers[i % candidateUsers.length] ?? fallbackUsers[i % fallbackUsers.length];
  const flag = FLAG_REASONS[i % FLAG_REASONS.length];
  const vendor = VENDOR_DECISIONS[i % VENDOR_DECISIONS.length];
  const status: KycSubmission["status"] = i % 5 === 0 ? "pending" : "review";
  const portfolio = 90000 + ((i * 63211) % 3100000);
  const submittedOn = dateAt(i % 13);
  const confidence =
    vendor.decision === "Approved" ? 84 + (i % 9) : vendor.decision === "Rejected" ? 41 + (i % 22) : 52 + (i % 19);

  return {
    id: `KYC-${4800 + i * 3}`,
    userId: user.id,
    name: user.name,
    email: user.email,
    city: user.city,
    documentType: DOC_TYPES[i % DOC_TYPES.length],
    tier: `Tier ${1 + (i % 3)}`,
    submittedAt: displayDate(submittedOn),
    submittedOn,
    flagReason: flag.reason,
    flagDetail: flag.detail,
    vendorDecision: vendor.decision,
    vendorDetail: vendor.detail,
    confidence: `${confidence}.${i % 10}%`,
    status,
    waitingFor: waiting(1 + (i % 23), (i * 7) % 60),
    portfolioValue: money(portfolio),
    documents: makeDocuments(flag.reason, i),
    checks: makeChecks(flag.reason, vendor.decision, i),
    // Nobody has saved a checklist against a case still sitting in the
    // queue — reviewerChecks/internalNote only populate once a reviewer
    // calls saveKycReviewerChecklist below, matching the real API.
    reviewerChecks: null,
    internalNote: null,
    attemptCount: i % 3,
    maxAttempts: 3,
  };
});

// SEAM: replace with GET /kyc-submissions?status=pending (plus a second
// GET /kyc-submissions?status=review call, merged client-side) — the real
// endpoint's `status` query param takes exactly one enum value per call,
// not a comma list, so this "pending or review" queue is two requests, not
// one. Exceptions queue only — submissions the vendor couldn't confidently
// decide. Decided cases (approved/rejected) drop out of the queue on staff
// action.
export function getKycSubmissions() {
  return KYC_SUBMISSIONS.filter((s) => s.status === "review" || s.status === "pending");
}

// SEAM: replace with GET /kyc-submissions/:id
export function getKycSubmissionById(id: string) {
  return KYC_SUBMISSIONS.find((s) => s.id === id);
}

// SEAM: replace with PATCH /kyc-submissions/:id/reviewer-checklist
// { checklist: Array<{label, checked}>, internalNote? }
// Persists the reviewer's working checklist and an optional staff-only note
// ahead of a final decision — does NOT change status or attemptCount. This
// is where a staff "override" note belongs now (see decideKycSubmission's
// comment below) — it is saved here, independently, before the decision
// call, not bundled into it.
export function saveKycReviewerChecklist(
  id: string,
  checklist: Array<{ label: string; checked: boolean }>,
  internalNote?: string | null,
) {
  const submission = KYC_SUBMISSIONS.find((s) => s.id === id);
  if (!submission) return undefined;
  submission.reviewerChecks = checklist;
  submission.internalNote = internalNote ?? null;
  return submission;
}

// SEAM: replace with PATCH /kyc-submissions/:id/decision
// { decision: "approve" | "reject", rejectReason? }
// The real body is decision + an enum rejectReason (required only when
// rejecting) — there is no free-text reason field on this call. Any
// staff-authored justification belongs on the checklist save's
// internalNote (see saveKycReviewerChecklist above), not here.
// Approving marks the case decided (and, on the real backend, flips the
// investor's User.kycStatus to approved). Rejecting increments
// attemptCount: while attempts remain, status returns to "pending" for a
// resubmission; once maxAttempts is reached, status becomes the terminal
// "rejected" and any further decision call 422s (BUSINESS_RULE_REJECTED).
export function decideKycSubmission(id: string, decision: "approved" | "rejected", rejectReason?: KycRejectReason) {
  const submission = KYC_SUBMISSIONS.find((s) => s.id === id);
  if (!submission) return undefined;
  if (decision === "approved") {
    submission.status = "approved";
    submission.vendorDecision = "Approved";
    submission.vendorDetail = "Vendor cleared the checks; approved by staff override.";
  } else {
    submission.attemptCount += 1;
    submission.status = submission.attemptCount >= submission.maxAttempts ? "rejected" : "pending";
    submission.vendorDecision = "Rejected";
    submission.vendorDetail = rejectReason
      ? `Vendor flagged the checks; rejected by staff override (${rejectReason}).`
      : "Vendor flagged the checks; rejected by staff override.";
  }
  return submission;
}
