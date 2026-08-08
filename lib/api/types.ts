// Wire-format types for the real Kudimata Securities backend admin surface.
//
// Ground truth: Kudimata-Securities-Backend/docs/admin-api-reference.html
// (the EP array + EX_* fixtures), read in full — every one of the 30 listed
// endpoints is represented here.
//
// These are deliberately a SEPARATE module from ../../types/api.ts, which
// models the dashboard's mock/display shapes (pre-formatted currency
// strings, Title-Case enum labels for UI copy, embedded/denormalized
// fields). The two only share a type where the real backend's wire value is
// byte-for-byte identical to the mock's — see the re-exports below. Every
// other type here uses the real wire shape: integer kobo for money,
// snake_case enum values where the backend uses them (e.g.
// "compliance_officer"), ISO 8601 date/time strings, and the backend's own
// field names (fullName, not name; ticker, not symbol; etc).
//
// Do not import from ../../types/api.ts anywhere else in this module beyond
// the three re-exports below — the two type systems are intentionally kept
// apart so mock-oriented screens and real-wiring screens never silently
// share a shape that later diverges.

import type { AccountStatus, KycRejectReason, KycStatus } from "@/types/api";

// KycStatus ("pending"|"review"|"approved"|"rejected"|"flagged"|"expired"),
// AccountStatus ("active"|"suspended"), and KycRejectReason
// ("unreadable"|"name_mismatch"|"expired"|"liveness_inconclusive") are
// verified byte-for-byte against the docs' KYC/user enums and the real
// PATCH /kyc-submissions/:id/decision body — safe to reuse as-is.
export type { AccountStatus, KycRejectReason, KycStatus };

// ---------------------------------------------------------------------------
// Shared envelopes
// ---------------------------------------------------------------------------

export interface PaginatedListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** The envelope every GET-list endpoint in the docs returns (see `paged()`
 * in the reference doc's fixture helpers). */
export interface PaginatedList<T> {
  data: T[];
  meta: PaginatedListMeta;
}

/** Known error codes seen across the reference doc's per-endpoint `errors`
 * tables. Not exhaustive by construction (`string & {}` keeps the literal
 * union's autocomplete while still accepting any string the server sends),
 * since new codes can ship on the backend without this file changing. */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DEACTIVATED"
  | "INVALID_PRE_AUTH_TOKEN"
  | "INVALID_TOTP_CODE"
  | "EMAIL_OTP_NOT_FOUND"
  | "EMAIL_OTP_EXPIRED"
  | "EMAIL_OTP_MISMATCH"
  | "STAFF_NOT_FOUND"
  | "BUSINESS_RULE_REJECTED"
  | "UNKNOWN_ERROR"
  | (string & {});

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

/** The `{error:{code,message,details}}` envelope every non-2xx response
 * carries. */
export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

// ---------------------------------------------------------------------------
// Common query-parameter shapes
// ---------------------------------------------------------------------------

export interface PageParams {
  /** >= 1. Default 1. */
  page?: number;
  /** >= 1. Default 20. */
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Staff auth (cat: staff-auth) — EX_PREAUTH / EX_SESSION_FIRST_LOGIN / EX_SESSION
// ---------------------------------------------------------------------------

export interface StaffLoginRequest {
  email: string;
  password: string;
}

export interface StaffVerifyTotpRequest {
  /** From POST /staff/auth/login. */
  preAuthToken: string;
  /** Exactly 6 digits. Ignored server-side on a first-ever login (nothing
   * enrolled yet to check it against) — see ApiStaffSession.totpEnrollment. */
  code: string;
  /** Accepted for forward-compatibility with a "trust this device for 7
   * days" option; not yet enforced server-side (no device-trust cookie is
   * issued in this build). */
  trustDevice?: boolean | null;
}

export interface StaffAcceptInviteRequest {
  email: string;
  /** 6-digit code from the invite email (OTP purpose staff_invite). */
  code: string;
  /** Minimum 8 characters. */
  password: string;
}

/** POST /staff/auth/login and POST /staff/auth/accept-invite both resolve to
 * this short-lived pre-auth token — never a full session on its own. */
export interface PreAuthTokenResponse {
  preAuthToken: string;
}

/** Present only in POST /staff/auth/verify-totp's response on a first-ever
 * login (no TOTP secret enrolled yet) — render `otpauthUrl` as a QR code.
 * Every subsequent login omits this field entirely. */
export interface TotpEnrollment {
  secret: string;
  otpauthUrl: string;
}

/** POST /staff/auth/verify-totp's response shape (docs call it
 * "AuthSessionWithTokens", though there is no separate refresh token on the
 * wire — just the one accessToken below). A session simply expires at
 * `expiresAt` (30-minute idle window per the product rule) and requires a
 * fresh two-step login; there is no refresh-token endpoint in the docs. */
export interface ApiStaffSession {
  id: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  biometricEnabled: boolean | null;
  stepUpAuthEnabled: boolean;
  accessToken: string;
  staffId: string;
  /** Only present on a first-ever login. See TotpEnrollment. */
  totpEnrollment?: TotpEnrollment;
}

// ---------------------------------------------------------------------------
// Desk overview (cat: desk-overview) — EX_DESK
// ---------------------------------------------------------------------------

export interface ApiDeskTrend {
  label: string;
  tone: "gain" | "loss";
}

export interface ApiDeskQueueMixEntry {
  documentType: ApiKycDocumentType;
  count: number;
}

/** GET /desk-overview's response. Not a persisted resource — computed at
 * request time (or served from a short cache) from KycSubmission,
 * Transaction, User, and Order. */
export interface ApiDeskOverview {
  aumTotalKobo: number;
  aumChangeAbsKobo: number;
  aumChangePct: number;
  /** Short historical series, oldest -> newest (5 points in the docs'
   * example) — not an intraday per-hour series. */
  aumSeries: number[];
  /** Aliases the KYC queue count (status IN (pending, review)) — same as
   * `pendingKyc` below, not a second divergent count. */
  awaitingReviewCount: number;
  medianDecisionSeconds: number;
  withdrawalsHeldTotalKobo: number;
  withdrawalsAboveTierLimitCount: number;
  verifiedClientsCount: number;
  queueMixByDocType: ApiDeskQueueMixEntry[];
  totalUsers: number;
  totalUsersTrend: ApiDeskTrend;
  /** Formatted percentage string as the backend sends it, e.g. "87.40%". */
  kycApprovalRate: string;
  kycApprovalTrend: ApiDeskTrend;
  pendingKyc: number;
  pendingKycTrend: ApiDeskTrend;
  /** Order rows with status=pending — the same narrow "uncrossed limit
   * order" set the orders endpoints describe, not a count of all orders. */
  activeOrders: number;
  activeOrdersTrend: ApiDeskTrend;
}

// ---------------------------------------------------------------------------
// Users (cat: users) — EX_USER
// ---------------------------------------------------------------------------

export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** ISO date, e.g. "1991-04-12". */
  dob: string;
  residentialAddress: string;
  /** e.g. "tier_2" — not enumerated in the docs beyond the example value. */
  tier: string;
  /** ISO datetime. */
  memberSince: string;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  /** Integer kobo, despite the unsuffixed field name — matches
   * lib/money.ts's koboToNaira example (184250000 -> "₦1,842,500.00")
   * exactly. Use koboToNaira()/nairaToKobo() from "@/lib/money", don't
   * reformat by hand. */
  portfolioValue: number;
  cscsNumber: string | null;
  returnPct: number | null;
  returnTrend: "gain" | "loss" | null;
  city: string;
  state: string;
}

export interface ListUsersParams extends PageParams {
  kycStatus?: KycStatus;
  accountStatus?: AccountStatus;
}

export interface SuspendUserRequest {
  /** Shown in the audit trail. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Orders (cat: orders) — EX_ORDER
// ---------------------------------------------------------------------------

export type ApiOrderSide = "buy" | "sell";
export type ApiOrderType = "market" | "limit";
export type ApiOrderStatus = "pending" | "approved" | "rejected";

export interface ApiOrder {
  id: string;
  userId: string;
  clientName: string;
  ticker: string;
  side: ApiOrderSide;
  units: number;
  /** Integer kobo when populated; null in every documented example. */
  amountKobo: number | null;
  orderType: ApiOrderType;
  /** Integer kobo per unit. Null for market orders. */
  limitPrice: number | null;
  /** Integer kobo per unit — the executed/quoted price. */
  price: number;
  /** Integer kobo — total order value (units * price). */
  value: number;
  status: ApiOrderStatus;
  createdAt: string;
}

export interface ListOrdersParams extends PageParams {
  status?: ApiOrderStatus;
}

export interface RejectOrderRequest {
  reason: string;
}

// ---------------------------------------------------------------------------
// Transactions (cat: transactions) — EX_TXN
// ---------------------------------------------------------------------------

export type ApiTransactionType = "fund" | "withdraw" | "buy" | "sell" | "convert";
export type ApiTransactionStatus = "pending" | "review" | "flagged" | "approved" | "rejected" | "completed" | "failed";

export interface ApiTransactionStatusEvent {
  label: string;
  when: string;
  by: string;
}

export interface ApiTransaction {
  id: string;
  userId: string;
  title: string;
  subtitle: string;
  /** Integer kobo, signed (negative for money leaving the platform). */
  amountKobo: number;
  createdAt: string;
  type: ApiTransactionType;
  status: ApiTransactionStatus;
  incoming: boolean;
  counterparty: string | null;
  /** Populated while status=review; the reason a compliance officer's
   * PATCH .../hold gave, or the system's own auto-hold reason. */
  holdingRule: string | null;
  statusHistory: ApiTransactionStatusEvent[];
  /** e.g. "transfer" — not enumerated in the docs beyond the example value. */
  method: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  /** Reserved for the convert flow, which has no live implementation yet —
   * always null on every transaction reachable today. */
  fromCurrency: string | null;
  toCurrency: string | null;
}

export interface ListTransactionsParams extends PageParams {
  type?: ApiTransactionType;
  status?: ApiTransactionStatus;
  /** Staff-only cross-user filter. An investor token is still forced to its
   * own rows regardless of this param. */
  userId?: string;
}

export interface HoldTransactionRequest {
  /** Shown to the investor and in the audit trail. */
  reason: string;
}

export interface RejectTransactionRequest {
  reason: string;
}

// ---------------------------------------------------------------------------
// Holdings (cat: holdings) — EX_HOLDING
// ---------------------------------------------------------------------------

export interface ApiHolding {
  id: string;
  userId: string;
  ticker: string;
  units: number;
  avgPriceKobo: number;
  marketValueKobo: number;
  totalReturnKobo: number;
  returnPct: number;
  returnTrend: "gain" | "loss";
}

export type ListHoldingsParams = PageParams;

/** GET /portfolio-summary is investor-only and has no worked example in the
 * docs (only a shape name, "PortfolioSummary", and a prose field list) — the
 * nested allocation/chartSeries field shapes below are a best-effort
 * reading of that prose, not a verified wire shape. Treat this type as
 * lower-confidence than the rest of this file if it's ever needed. */
export interface ApiPortfolioAllocationEntry {
  ticker: string;
  valueKobo: number;
  pct: number;
}

export interface ApiPortfolioSummary {
  totalValueKobo: number;
  allTimeReturnKobo: number;
  allTimeReturnPct: number;
  allocation: ApiPortfolioAllocationEntry[];
  chartSeries: number[];
}

// ---------------------------------------------------------------------------
// KYC (cat: kyc) — EX_KYC
// ---------------------------------------------------------------------------

export type ApiKycDocumentType = "nin" | "passport" | "drivers_licence" | "resubmission";
/** The real backend's decision enum on the submission's own vendorDecision
 * field — lowercase, distinct from the request body's `decision` values on
 * PATCH .../decision ("approve"/"reject", no -d/-ed suffix — see
 * DecideKycRequest below). */
export type ApiKycVendorDecision = "no_decision" | "approved" | "rejected";

export interface ApiKycDocument {
  id: string;
  kycSubmissionId: string;
  objectKey: string;
  documentName: string;
  /** e.g. "nin", "liveness_selfie" — not fully enumerated in the docs. */
  documentKind: string;
  uploadedAt: string;
}

export interface ApiKycNextOfKin {
  name: string;
  relationship: string;
  phone: string;
}

/** Vendor provider-check results, e.g. {bvnLookup:"match",
 * sanctionsPep:"clear", duplicateAccount:"clear"} — key set and value enum
 * are not fully documented beyond the one example, so this stays a loose
 * string-keyed map rather than a closed type. */
export type ApiKycProviderChecks = Record<string, string>;

export interface KycChecklistItem {
  label: string;
  checked: boolean;
}

export interface ApiKycSubmission {
  id: string;
  userId: string;
  /** Masked to ***last4 for the `support` role; full value for
   * kyc_reviewer/compliance_officer/super_admin. */
  bvn: string;
  /** Same masking rule as bvn. */
  nin: string;
  tier: string;
  documentType: ApiKycDocumentType;
  documents: ApiKycDocument[];
  name: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  nextOfKin: ApiKycNextOfKin;
  vendorDecision: ApiKycVendorDecision;
  vendorDetail: string | null;
  status: KycStatus;
  flagReason: string | null;
  flagDetail: string | null;
  submittedAt: string;
  assignedTo: string | null;
  attemptCount: number;
  maxAttempts: number;
  livenessMatchPct: number;
  providerChecks: ApiKycProviderChecks;
  /** Null until a reviewer has saved a checklist via
   * PATCH .../reviewer-checklist. */
  reviewerChecks: KycChecklistItem[] | null;
  /** Staff-only — never shown to the investor. */
  internalNote: string | null;
}

export interface ListKycSubmissionsParams extends PageParams {
  status?: KycStatus;
  documentType?: ApiKycDocumentType;
  tier?: string;
  /** Staff-only cross-user filter. */
  userId?: string;
}

export interface SaveKycReviewerChecklistRequest {
  /** At least one item. */
  checklist: KycChecklistItem[];
  /** Staff-only — never shown to the investor. */
  internalNote?: string | null;
}

export interface DecideKycRequest {
  decision: "approve" | "reject";
  /** Required if decision = "reject"; ignored otherwise. There is no
   * free-text reason on this call — see ApiKycSubmission.internalNote for
   * where a reviewer's own working note lives. */
  rejectReason?: KycRejectReason;
}

// ---------------------------------------------------------------------------
// Staff management (cat: staff) — EX_STAFF
// ---------------------------------------------------------------------------

export type ApiStaffRole = "support" | "kyc_reviewer" | "compliance_officer" | "super_admin";
export type ApiStaffStatus = "approved" | "pending" | "expired";

export interface ApiStaffMember {
  id: string;
  name: string;
  email: string;
  role: ApiStaffRole;
  status: ApiStaffStatus;
  /** ISO datetime, or null if this staff member has never signed in. */
  lastSignIn: string | null;
  addedAt: string;
}

export interface ListStaffMembersParams extends PageParams {
  role?: ApiStaffRole;
  status?: ApiStaffStatus;
}

export interface InviteStaffMemberRequest {
  name: string;
  email: string;
  role: ApiStaffRole;
}

export interface UpdateStaffRoleRequest {
  role: ApiStaffRole;
}

export interface DeactivateStaffMemberRequest {
  /** Required — shown in the audit trail. No column on StaffMember itself;
   * lives only on the AuditLogEntry.detail this call writes. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Audit log (cat: audit) — EX_AUDIT / EX_AUDIT_KYC
// ---------------------------------------------------------------------------

export type ApiAuditKind = "account" | "kyc" | "transaction" | "staff" | "session";

export interface ApiAuditBeforeAfterField {
  label: string;
  before: string;
  after: string;
}

export interface ApiAuditLogEntry {
  id: string;
  when: string;
  /** Null, with staffName "System", for actions with no human actor. */
  staffId: string | null;
  staffName: string;
  staffRole: ApiStaffRole | null;
  action: string;
  kind: ApiAuditKind;
  /** The acted-on entity's own id (a User/Transaction/KycSubmission/
   * StaffMember id, depending on `kind`) — resolve against the owning list
   * for a human-readable label; there is no denormalized name field here. */
  target: string;
  targetDetail: string;
  detail: string;
  beforeAfter: ApiAuditBeforeAfterField[];
  /** Populated only on kind="kyc" entries written by the decision endpoint;
   * null for every other kind. */
  vendorFlag: string | null;
  /** Populated only on kind="kyc" entries; carries the decision's
   * rejectReason on a reject. Null for every other kind. */
  staffReasonQuote: string | null;
  /** Has no real data source yet on the backend — always null today. Not an
   * error case; don't treat a null here as missing data. */
  staffReasonTiming: string | null;
}

export interface ListAuditLogParams extends PageParams {
  kind?: ApiAuditKind;
  staffId?: string;
}
