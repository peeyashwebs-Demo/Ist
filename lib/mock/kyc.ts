import type { KycSubmission } from "@/types/api";
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
  { decision: "Approved", detail: "Vendor cleared automatically; staff spot-check" },
];

function money(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function waiting(hours: number, minutes: number) {
  return `${hours}h ${minutes}m`;
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

  return {
    id: `KYC-${4800 + i * 3}`,
    userId: user.id,
    name: user.name,
    email: user.email,
    documentType: DOC_TYPES[i % DOC_TYPES.length],
    tier: `Tier ${1 + (i % 3)}`,
    submittedAt: user.kyc.submittedAt,
    flagReason: flag.reason,
    flagDetail: flag.detail,
    vendorDecision: vendor.decision,
    vendorDetail: vendor.detail,
    status,
    waitingFor: waiting(1 + (i % 23), (i * 7) % 60),
    portfolioValue: money(portfolio),
  };
});

// SEAM: replace with GET /api/admin/kyc
export function getKycSubmissions() {
  return KYC_SUBMISSIONS;
}

// SEAM: replace with GET /api/admin/kyc/:id
export function getKycSubmissionById(id: string) {
  return KYC_SUBMISSIONS.find((s) => s.id === id);
}
