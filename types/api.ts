// Domain types for the Kudimata admin dashboard.
// Every field here is backed by a table column or detail-view field seen in
// the approved design (design-reference/Kudimata Desk.dc.html).

export type KycStatus = "pending" | "review" | "approved" | "rejected" | "expired";
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
  documentType: "NIN" | "Passport" | "Driver's licence" | "Re-submission";
  tier: string;
  submittedAt: string;
  flagReason: string;
  flagDetail: string;
  /** What the KYC vendor's automated check decided, before staff review. */
  vendorDecision: "No decision" | "Rejected" | "Approved";
  vendorDetail: string;
  status: "review" | "pending";
  /** How long the case has been waiting, e.g. "4h 12m" */
  waitingFor: string;
  portfolioValue: string;
}

// ---------------------------------------------------------------------------
// Transaction / order monitor (screen 6)
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string; // reference, "TRX-90218"
  userId: string;
  userName: string;
  type: "Buy" | "Sell" | "Deposit" | "Withdrawal";
  asset: string; // instrument symbol, or "—"
  /** Signed formatted currency string */
  amount: string;
  tone: "gain" | "loss";
  status: "review" | "approved" | "pending" | "rejected";
  /** Display override for the StatusPill — "Held" / "Settled" / "Pending" / "Failed" */
  statusLabel: string;
  when: string;
  /** Held-transaction detail (screen 6d) */
  counterparty?: string;
  holdingRule?: string;
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
  target: string;
  targetDetail: string;
  detail: string;
  /** Entry detail view (screen 7d) */
  sessionId?: string;
  area?: string;
  caseId?: string;
  beforeAfter?: AuditBeforeAfterField[];
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
