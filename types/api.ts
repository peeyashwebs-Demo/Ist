// Domain types for the Kudimata admin dashboard.
// Every field here is backed by a table column or detail-view field seen in
// the approved design (design-reference/Kudimata Desk.dc.html).

export type KycStatus = "pending" | "review" | "approved" | "rejected" | "flagged" | "expired";
export type AccountStatus = "active" | "suspended";

// ---------------------------------------------------------------------------
// Users (screens 3 · Users, 4 · User detail)
// ---------------------------------------------------------------------------

export interface User {
  id: string; // "U-10482"
  name: string;
  email: string;
  phone: string;
  city: string;
  kycStatus: KycStatus;
  joinedAt: string; // "4 Nov 2024"
  accountStatus: AccountStatus;
  /** Formatted currency string, e.g. "₦2,418,650.00" */
  portfolioValue: string;
  holdings: UserHolding[];
  transactions: UserTransactionEntry[];
  kyc: UserKycFile;
}

export interface UserHolding {
  id: string;
  symbol: string;
  name: string;
  units: string;
  avgCost: string;
  lastPrice: string;
  value: string;
  /** e.g. "+2.40%" */
  todayChange: string;
  tone: "gain" | "loss";
}

export interface UserTransactionEntry {
  id: string;
  when: string;
  reference: string;
  type: "Buy" | "Sell" | "Deposit" | "Withdrawal";
  detail: string;
  /** Signed formatted currency string, e.g. "+₦120,000.00" */
  amount: string;
  status: "approved" | "review" | "rejected";
  /** Display override for the StatusPill — "Settled" / "Under review" / "Returned" */
  statusLabel: string;
}

export interface UserKycFile {
  bvn: string;
  nin: string;
  tier: string;
  submittedAt: string;
  address: string;
  nextOfKin: string;
  documents: KycDocument[];
  checks: KycCheck[];
}

export interface KycDocument {
  name: string;
  meta: string;
  status: KycStatus;
  statusLabel: string;
}

export interface KycCheck {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// KYC review queue (screen 5)
// ---------------------------------------------------------------------------

export interface KycSubmission {
  id: string; // "KYC-4821"
  userId: string;
  name: string;
  email: string;
  city: string;
  documentType: "NIN" | "Passport" | "Driver's licence" | "Re-submission";
  tier: string;
  /** Display date, e.g. "12 Mar 2026" */
  submittedAt: string;
  /** ISO date (yyyy-mm-dd) used by the queue's date-range filter. */
  submittedOn: string;
  flagReason: string;
  flagDetail: string;
  /** What the KYC vendor's automated check decided, before staff review. */
  vendorDecision: "No decision" | "Rejected" | "Approved";
  vendorDetail: string;
  /** Vendor confidence in its automated result, e.g. "62.4%". */
  confidence: string;
  status: "review" | "pending" | "approved" | "rejected";
  /** How long the case has been waiting, e.g. "4h 12m" */
  waitingFor: string;
  portfolioValue: string;
  documents: KycDocument[];
  /** Vendor result summary — BVN/liveness/document checks. */
  checks: KycCheck[];
  /** The reviewer's working checklist, saved independently of a decision via
   * PATCH /kyc-submissions/:id/reviewer-checklist. Null until a reviewer has
   * saved one for this case — matches the real KycSubmission response. */
  reviewerChecks: Array<{ label: string; checked: boolean }> | null;
  /** Staff-only note captured alongside the checklist save — never shown to
   * the investor. This is where a staff "override" justification belongs now:
   * the real decision endpoint (PATCH /kyc-submissions/:id/decision) only
   * accepts `decision` + an enum `rejectReason`, no free-text reason field. */
  internalNote: string | null;
  /** Resubmission attempts used so far. */
  attemptCount: number;
  /** Resubmission attempts allowed before the case becomes terminal — once
   * attemptCount reaches maxAttempts, status becomes the terminal "rejected"
   * and any further PATCH .../decision call returns 422 BUSINESS_RULE_REJECTED. */
  maxAttempts: number;
}

/** The real decision endpoint's reject-reason enum — required in the body
 * when decision = "reject", ignored otherwise. There is no free-text reason
 * on this call; see KycSubmission.internalNote for where staff notes live. */
export type KycRejectReason = "unreadable" | "name_mismatch" | "expired" | "liveness_inconclusive";

// ---------------------------------------------------------------------------
// Transaction / order monitor (screen 6)
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string; // reference, "TRX-90218"
  userId: string;
  userName: string;
  /** Real backend enum is fund|withdraw|buy|sell|convert; these are the
   * dashboard's display-cased equivalents. "Convert" is included for type
   * completeness only — per backend source comments, the convert flow has
   * no live implementation yet (it's flag-only in the enum, not reachable
   * by any user action), and the real Transaction's fromCurrency/toCurrency
   * fields are dead placeholders. Don't generate mock rows of this type. */
  type: "Buy" | "Sell" | "Deposit" | "Withdrawal" | "Convert";
  asset: string; // instrument symbol, or "—"
  /** Units executed for Buy/Sell orders, e.g. "500". */
  units?: string;
  /** Executed unit price, e.g. "₦44.05". */
  unitPrice?: string;
  /** Signed formatted currency string */
  amount: string;
  tone: "gain" | "loss";
  /** Real backend enum also includes "flagged" and "failed" — not modelled
   * here yet; this pass only adds "completed" per the current task scope. */
  status: "review" | "approved" | "pending" | "rejected" | "completed";
  /** Display override for the StatusPill — "Held" / "Settled" / "Pending" / "Failed" */
  statusLabel: string;
  when: string;
  /** ISO date (yyyy-mm-dd) used by the monitor's date-range filter. */
  on: string;
  /** Held-transaction detail (screen 6d) */
  counterparty?: string;
  holdingRule?: string;
  /** Related order/payment reference, shown in the transaction detail. */
  orderId?: string;
  statusHistory?: TransactionStatusEvent[];
}

export interface TransactionStatusEvent {
  label: string;
  when: string;
  by?: string;
}

/** The "Flagged transactions" panel on Overview — a lighter summary shape,
 * not the full Transaction record. */
export interface FlaggedTransaction {
  client: string;
  /** e.g. "TRX-90218 · Withdrawal · 10:42" */
  meta: string;
  amount: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Audit log (screen 7)
// ---------------------------------------------------------------------------

export type AuditKind = "Account" | "KYC" | "Transaction" | "Staff" | "Session";

export interface AuditLogEntry {
  id: string;
  when: string;
  staffName: string;
  staffRole: string;
  /** e.g. "Account suspended", "KYC approved · override", "Role changed" */
  action: string;
  kind: AuditKind;
  /** The acted-on entity's real id — a User id, Transaction id, KYC
   * submission id, or StaffMember id depending on `kind` — matching the real
   * API's bare `target` field exactly (see admin-api-reference EX_AUDIT,
   * where target is literally the transaction's own id). Resolve this
   * against the owning list to look up the live record; use `targetName`
   * for what a screen should actually display next to it. */
  target: string;
  /** Human-readable label for `target` (the client's name, the staff
   * member's name, etc.) — what this dashboard previously stored directly
   * in `target`. Not a field on the real API response; a consuming screen
   * resolves it client-side (or a future backend change could denormalize
   * it server-side) by looking `target` up against the relevant resource. */
  targetName: string;
  targetDetail: string;
  detail: string;
  /** Entry detail view (screen 7d) — dashboard-only convenience fields with
   * no equivalent on the real AuditLogEntry response. */
  sessionId?: string;
  area?: string;
  caseId?: string;
  beforeAfter?: AuditBeforeAfterField[];
  /** What the KYC vendor flagged, verbatim — entry detail's "Vendor flag"
   * card. Nullable on the real API; populated only when kind === "KYC". */
  vendorFlag: string | null;
  /** The staff member's own override justification, shown as a quoted card.
   * Nullable on the real API; populated only when kind === "KYC". */
  staffReasonQuote: string | null;
  /** How long the staff member had the case open before confirming, e.g.
   * "3 seconds". Nullable on the real API; populated only when kind === "KYC". */
  staffReasonTiming: string | null;
}

export interface AuditBeforeAfterField {
  label: string;
  before: string;
  after: string;
}

// ---------------------------------------------------------------------------
// Desk overview (screen 2)
// ---------------------------------------------------------------------------

export interface DeskTrend {
  label: string;
  tone: "gain" | "loss";
}

export interface DeskSummary {
  totalUsers: number;
  totalUsersTrend: DeskTrend;
  kycApprovalRate: string; // "94.2%"
  kycApprovalTrend: DeskTrend;
  pendingKyc: number;
  pendingKycTrend: DeskTrend;
  activeOrders: number;
  activeOrdersTrend: DeskTrend;
}

/** Today's intraday transaction volume — a desk-level rollup, not summed
 * client-side from the transaction log (see SEAM in lib/mock/overview.ts). */
export interface TodayVolume {
  amount: string;
  change: DeskTrend;
  /** Oldest → newest, one point per trading hour, for the BalancePanel sparkline. */
  series: number[];
}

/** A bounded preview of a longer list, plus the true total count — mirrors
 * how a paginated endpoint reports its own count via response metadata. */
export interface OverviewPanel<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Staff and roles (screen 8)
// ---------------------------------------------------------------------------

export type StaffRole = "Super admin" | "Compliance officer" | "KYC reviewer" | "Support";
export type StaffStatus = "approved" | "pending" | "expired";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  /** Display override for the StatusPill — "Active" / "Invited" / "Deactivated" */
  statusLabel: string;
  lastSignIn: string; // or "Never"
  addedAt: string;
}
