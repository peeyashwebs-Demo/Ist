// Fetch wrapper, token storage, and one typed function per endpoint for the
// real Kudimata Securities backend admin surface.
//
// Ground truth: Kudimata-Securities-Backend/docs/admin-api-reference.html
// (EP array, all 30 entries) cross-checked against
// Kudimata-Securities-Backend/src/main.ts for the base URL.
//
// This module is the shared foundation two other developers wire dashboard
// screens against, in parallel, on separate branches — it does not itself
// wire any screen. See lib/api/auth.tsx for the React session layer built
// on top of TokenStore below.

import type {
  ApiDeskOverview,
  ApiErrorEnvelope,
  ApiHolding,
  ApiKycSubmission,
  ApiOrder,
  ApiPortfolioSummary,
  ApiStaffMember,
  ApiStaffRole,
  ApiStaffSession,
  ApiTransaction,
  ApiUser,
  ApiAuditLogEntry,
  DecideKycRequest,
  DeactivateStaffMemberRequest,
  HoldTransactionRequest,
  InviteStaffMemberRequest,
  KycChecklistItem,
  ListAuditLogParams,
  ListHoldingsParams,
  ListKycSubmissionsParams,
  ListOrdersParams,
  ListStaffMembersParams,
  ListTransactionsParams,
  ListUsersParams,
  PaginatedList,
  RejectOrderRequest,
  RejectTransactionRequest,
  StaffAcceptInviteRequest,
  StaffLoginRequest,
  StaffVerifyTotpRequest,
  SaveKycReviewerChecklistRequest,
  SuspendUserRequest,
  UpdateStaffRoleRequest,
} from "./types";

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

/** The backend (src/main.ts) calls `app.listen(process.env.PORT ?? 3000)`
 * with no `setGlobalPrefix` and no versioned prefix — every path in the docs
 * (e.g. "/staff/auth/login") is served bare off the host root. The docs'
 * own BASE constant ("https://api.kudimatasecurities.com") is a placeholder
 * for its curl examples, not a real deployed host, so it isn't reused here.
 * For local dev against `npm run start:dev` in the backend repo, the
 * matching default is http://localhost:3000. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

/** What this client persists between page loads. The docs describe no
 * refresh-token endpoint anywhere (ApiStaffSession carries exactly one
 * `accessToken`, nothing else) — a session simply expires at `expiresAt`
 * (a 30-minute idle window per the product rule) and the staff member signs
 * in again from scratch. `role` is not returned by any auth response body;
 * it's decoded client-side from the access token's JWT payload — see
 * decodeAccessTokenRole below. */
export interface StoredSession {
  accessToken: string;
  staffId: string;
  role: ApiStaffRole | null;
  expiresAt: string;
}

const STORAGE_KEY = "kudimata.staff.session";

function readStorage(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeStorage(session: StoredSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage can throw (private mode, quota, disabled) — session
    // simply won't persist across reloads; nothing to recover here.
  }
}

// In-memory cache backing TokenStore.get(), so it returns a referentially
// stable value between calls (required for useSyncExternalStore in
// lib/api/auth.tsx — a fresh object per call would loop it forever) instead
// of re-parsing localStorage's JSON on every read. Lazily hydrated from
// localStorage on first client-side access; always null on the server
// (`window` doesn't exist there), which is the correct SSR snapshot anyway
// since a real session can only ever have been set from the browser.
let cachedSession: StoredSession | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  cachedSession = readStorage();
  hydrated = true;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** localStorage-backed, SSR-safe (every method no-ops to `null`/void on the
 * server, where `window` doesn't exist). Holds the current staff session's
 * access token — see StoredSession for why there is no separate refresh
 * token. Doubles as the external store lib/api/auth.tsx subscribes to via
 * useSyncExternalStore; most consumers should go through useAuth() instead
 * of calling this directly. Note: does not sync across browser tabs (no
 * `storage` event listener) — out of scope for this foundation. */
export const TokenStore = {
  get(): StoredSession | null {
    ensureHydrated();
    return cachedSession;
  },
  set(session: StoredSession): void {
    cachedSession = session;
    hydrated = true;
    writeStorage(session);
    notify();
  },
  clear(): void {
    cachedSession = null;
    hydrated = true;
    writeStorage(null);
    notify();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Best-effort, non-verifying decode of a JWT's payload segment — used only
 * to read the `role` claim the docs' example access token embeds (see
 * EX_SESSION_FIRST_LOGIN.accessToken's decoded comment in the reference
 * doc). This is a client-side convenience for driving UI (which nav items
 * to show, etc.) only — it is never a substitute for server-side
 * authorization, which every endpoint enforces on its own regardless of
 * what this decodes. Returns null if the token isn't a well-formed JWT or
 * carries no `role` claim. */
export function decodeAccessTokenRole(accessToken: string): ApiStaffRole | null {
  const segments = accessToken.split(".");
  if (segments.length < 2) return null;
  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = typeof window === "undefined" ? Buffer.from(padded, "base64").toString("utf-8") : window.atob(padded);
    const payload: unknown = JSON.parse(json);
    if (payload && typeof payload === "object" && "role" in payload) {
      const role = (payload as { role?: unknown }).role;
      return typeof role === "string" ? (role as ApiStaffRole) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Builds the StoredSession this module persists from a raw
 * ApiStaffSession — decodes `role` from the access token since no auth
 * response body carries it directly. Exported so lib/api/auth.tsx (and any
 * screen driving the login flow directly) can build the same shape without
 * duplicating the JWT-decode step. */
export function toStoredSession(session: ApiStaffSession): StoredSession {
  return {
    accessToken: session.accessToken,
    staffId: session.staffId,
    role: decodeAccessTokenRole(session.accessToken),
    expiresAt: session.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// ApiError + apiFetch
// ---------------------------------------------------------------------------

/** Thrown by apiFetch for every non-2xx response — never a bare Error.
 * Carries the parsed `{error:{code,message,details}}` envelope plus the
 * HTTP status. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildQuery(params?: object): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Substitutes a `:id`-style path param, URI-encoding the value. */
function withParam(path: string, token: string, value: string): string {
  return path.replace(token, encodeURIComponent(value));
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/** The one fetch wrapper every endpoint function below goes through.
 * Attaches `Authorization: Bearer <token>` when a session is stored, sets
 * `Content-Type: application/json` whenever a body is present, and throws a
 * typed ApiError (never a generic Error) on any non-2xx response. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers: headersInit, ...rest } = options;
  const headers = new Headers(headersInit);

  const session = TokenStore.get();
  if (session?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: requestBody,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const envelope = payload as Partial<ApiErrorEnvelope> | null;
    const errorBody = envelope?.error;
    throw new ApiError(
      res.status,
      errorBody?.code ?? "UNKNOWN_ERROR",
      errorBody?.message ?? res.statusText ?? "Request failed",
      errorBody?.details,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Staff auth — POST /staff/auth/*
// ---------------------------------------------------------------------------

/** POST /staff/auth/login — email + password only (2026-08-08 product
 * decision: no TOTP step). Returns a full session directly. */
export function staffLogin(email: string, password: string): Promise<ApiStaffSession> {
  const body: StaffLoginRequest = { email, password };
  return apiFetch<ApiStaffSession>("/staff/auth/login", { method: "POST", body });
}

/** POST /staff/auth/verify-totp — DORMANT. The backend still deploys this
 * route, but staffLogin()/staffAcceptInvite() no longer produce a
 * preAuthToken to exchange here, so nothing in the dashboard calls this.
 * Kept only so re-enabling TOTP later is a routing change, not a rebuild. */
export function staffVerifyTotp(preAuthToken: string, code: string, trustDevice?: boolean | null): Promise<ApiStaffSession> {
  const body: StaffVerifyTotpRequest = { preAuthToken, code, trustDevice };
  return apiFetch<ApiStaffSession>("/staff/auth/verify-totp", { method: "POST", body });
}

/** POST /staff/auth/accept-invite — redeems an invite code emailed by
 * POST /staff-members and sets the invitee's real password. Same 2026-08-08
 * decision as staffLogin(): returns a full session directly. */
export function staffAcceptInvite(email: string, code: string, password: string): Promise<ApiStaffSession> {
  const body: StaffAcceptInviteRequest = { email, code, password };
  return apiFetch<ApiStaffSession>("/staff/auth/accept-invite", { method: "POST", body });
}

// ---------------------------------------------------------------------------
// Desk overview — GET /desk-overview
// ---------------------------------------------------------------------------

/** GET /desk-overview — the single computed snapshot backing the dashboard
 * home screen. Roles: any authenticated staff role. */
export function getDeskOverview(): Promise<ApiDeskOverview> {
  return apiFetch<ApiDeskOverview>("/desk-overview");
}

// ---------------------------------------------------------------------------
// Users — /users
// ---------------------------------------------------------------------------

/** GET /users — list investor accounts, most recent join first (sort is not
 * client-selectable). Roles: any authenticated staff role. */
export function listUsers(params?: ListUsersParams): Promise<PaginatedList<ApiUser>> {
  return apiFetch<PaginatedList<ApiUser>>(`/users${buildQuery(params)}`);
}

/** GET /users/:id — a single investor account. Does not nest holdings,
 * transactions, or the KYC submission — see getUserHoldings,
 * listTransactions({userId}), listKycSubmissions({userId}). */
export function getUser(id: string): Promise<ApiUser> {
  return apiFetch<ApiUser>(withParam("/users/:id", ":id", id));
}

/** PATCH /users/:id/suspend — freezes the account (accountStatus ->
 * suspended). Roles: compliance_officer, super_admin. */
export function suspendUser(id: string, reason: string): Promise<ApiUser> {
  const body: SuspendUserRequest = { reason };
  return apiFetch<ApiUser>(withParam("/users/:id/suspend", ":id", id), { method: "PATCH", body });
}

/** PATCH /users/:id/reactivate — sets accountStatus -> active. No request
 * body. Roles: compliance_officer, super_admin. */
export function reactivateUser(id: string): Promise<ApiUser> {
  return apiFetch<ApiUser>(withParam("/users/:id/reactivate", ":id", id), { method: "PATCH" });
}

// ---------------------------------------------------------------------------
// Orders — /orders
// ---------------------------------------------------------------------------

/** GET /orders — the order queue. In practice almost entirely status=approved
 * (market orders and crossing limit orders auto-fill); filter
 * status=pending client-side for an actionable queue. Roles: any
 * authenticated staff role. */
export function listOrders(params?: ListOrdersParams): Promise<PaginatedList<ApiOrder>> {
  return apiFetch<PaginatedList<ApiOrder>>(`/orders${buildQuery(params)}`);
}

/** GET /orders/:id — also reachable by the investor who placed it (their
 * own order only). Roles: any authenticated staff role. */
export function getOrder(id: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(withParam("/orders/:id", ":id", id));
}

/** PATCH /orders/:id/approve — marks the order approved and applies its
 * holding/portfolio side effect. Roles: compliance_officer, super_admin. */
export function approveOrder(id: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(withParam("/orders/:id/approve", ":id", id), { method: "PATCH" });
}

/** PATCH /orders/:id/reject — marks the order rejected, no side effect.
 * Roles: compliance_officer, super_admin. */
export function rejectOrder(id: string, reason: string): Promise<ApiOrder> {
  const body: RejectOrderRequest = { reason };
  return apiFetch<ApiOrder>(withParam("/orders/:id/reject", ":id", id), { method: "PATCH", body });
}

// ---------------------------------------------------------------------------
// Transactions — /transactions
// ---------------------------------------------------------------------------

/** GET /transactions — an investor token is forced to only its own rows;
 * any staff role sees every investor's transactions. `userId` is a
 * staff-only cross-user filter. Roles: any authenticated staff role
 * (shared with the investor realm). */
export function listTransactions(params?: ListTransactionsParams): Promise<PaginatedList<ApiTransaction>> {
  return apiFetch<PaginatedList<ApiTransaction>>(`/transactions${buildQuery(params)}`);
}

/** GET /transactions/:id — same forced-ownership rule as the list endpoint.
 * Roles: any authenticated staff role (shared with the investor realm). */
export function getTransaction(id: string): Promise<ApiTransaction> {
  return apiFetch<ApiTransaction>(withParam("/transactions/:id", ":id", id));
}

/** PATCH /transactions/:id/hold — moves the transaction into compliance
 * review (status -> review), stamps holdingRule, notifies the investor.
 * Roles: compliance_officer, super_admin. */
export function holdTransaction(id: string, reason: string): Promise<ApiTransaction> {
  const body: HoldTransactionRequest = { reason };
  return apiFetch<ApiTransaction>(withParam("/transactions/:id/hold", ":id", id), { method: "PATCH", body });
}

/** PATCH /transactions/:id/release — releases a held transaction. For a
 * withdrawal auto-held for exceeding the tier limit, this also fires the
 * deferred Flutterwave transfer (landing on pending/completed/failed
 * instead of a bare approved). No request body. Roles: compliance_officer,
 * super_admin. */
export function releaseTransaction(id: string): Promise<ApiTransaction> {
  return apiFetch<ApiTransaction>(withParam("/transactions/:id/release", ":id", id), { method: "PATCH" });
}

/** PATCH /transactions/:id/reject — marks the transaction rejected
 * (terminal) and reverses any pending balance hold. Roles:
 * compliance_officer, super_admin. */
export function rejectTransaction(id: string, reason: string): Promise<ApiTransaction> {
  const body: RejectTransactionRequest = { reason };
  return apiFetch<ApiTransaction>(withParam("/transactions/:id/reject", ":id", id), { method: "PATCH", body });
}

// ---------------------------------------------------------------------------
// KYC — /kyc-submissions
// ---------------------------------------------------------------------------

/** GET /kyc-submissions — the onboarding review queue, most recent
 * submission first. BVN/NIN are masked to ***last4 for the `support` role.
 * `userId` is a staff-only cross-user filter. Roles: any authenticated
 * staff role. */
export function listKycSubmissions(params?: ListKycSubmissionsParams): Promise<PaginatedList<ApiKycSubmission>> {
  return apiFetch<PaginatedList<ApiKycSubmission>>(`/kyc-submissions${buildQuery(params)}`);
}

/** GET /kyc-submissions/:id — full submission including documents,
 * next-of-kin, provider checks, and reviewer checklist. Roles: any
 * authenticated staff role. */
export function getKycSubmission(id: string): Promise<ApiKycSubmission> {
  return apiFetch<ApiKycSubmission>(withParam("/kyc-submissions/:id", ":id", id));
}

/** PATCH /kyc-submissions/:id/reviewer-checklist — persists the reviewer's
 * working checklist and an optional internal note ahead of a final
 * decision. Does not change status or attemptCount. Roles: kyc_reviewer,
 * compliance_officer, super_admin. */
export function saveKycReviewerChecklist(
  id: string,
  checklist: KycChecklistItem[],
  internalNote?: string | null,
): Promise<ApiKycSubmission> {
  const body: SaveKycReviewerChecklistRequest = { checklist, internalNote };
  return apiFetch<ApiKycSubmission>(withParam("/kyc-submissions/:id/reviewer-checklist", ":id", id), {
    method: "PATCH",
    body,
  });
}

/** PATCH /kyc-submissions/:id/decision — approve flips User.kycStatus to
 * approved (unlocks trading); reject increments attemptCount and returns to
 * pending until maxAttempts is exhausted, then becomes terminal. Throws
 * ApiError with code BUSINESS_RULE_REJECTED (422) once attempts are
 * exhausted. Roles: kyc_reviewer, compliance_officer, super_admin. */
export function decideKyc(id: string, decision: "approve" | "reject", rejectReason?: DecideKycRequest["rejectReason"]): Promise<ApiKycSubmission> {
  const body: DecideKycRequest = { decision, rejectReason };
  return apiFetch<ApiKycSubmission>(withParam("/kyc-submissions/:id/decision", ":id", id), { method: "PATCH", body });
}

// ---------------------------------------------------------------------------
// Holdings — /holdings, /portfolio-summary, /users/:id/holdings
// ---------------------------------------------------------------------------

/** GET /holdings — investor-only (@Roles('investor'), scoped to the
 * caller's own JWT). Any staff token gets 403 FORBIDDEN here. Included for
 * completeness of the documented surface; the admin dashboard should use
 * getUserHoldings below instead. */
export function listMyHoldings(params?: ListHoldingsParams): Promise<PaginatedList<ApiHolding>> {
  return apiFetch<PaginatedList<ApiHolding>>(`/holdings${buildQuery(params)}`);
}

/** GET /holdings/:ticker — investor-only, same scoping as listMyHoldings.
 * The identifier is the ticker symbol, not a holding id. Any staff token
 * gets 403 FORBIDDEN. */
export function getMyHoldingByTicker(ticker: string): Promise<ApiHolding> {
  return apiFetch<ApiHolding>(withParam("/holdings/:ticker", ":ticker", ticker));
}

/** GET /portfolio-summary — investor-only aggregate (totalValueKobo,
 * allTimeReturnKobo/Pct, allocation, chartSeries) for the caller's own
 * portfolio. Any staff token gets 403 FORBIDDEN — not usable for an admin
 * "client portfolio" view. */
export function getMyPortfolioSummary(): Promise<ApiPortfolioSummary> {
  return apiFetch<ApiPortfolioSummary>("/portfolio-summary");
}

/** GET /users/:id/holdings — the staff-only equivalent of GET /holdings for
 * a given investor (same response shape as listMyHoldings). This is how a
 * User Detail screen gets a client's holdings. Roles: any authenticated
 * staff role. */
export function getUserHoldings(userId: string, params?: ListHoldingsParams): Promise<PaginatedList<ApiHolding>> {
  return apiFetch<PaginatedList<ApiHolding>>(`${withParam("/users/:id/holdings", ":id", userId)}${buildQuery(params)}`);
}

// ---------------------------------------------------------------------------
// Staff management — /staff-members
// ---------------------------------------------------------------------------

/** GET /staff-members — list staff accounts, most recently added first.
 * Roles: compliance_officer, super_admin. */
export function listStaffMembers(params?: ListStaffMembersParams): Promise<PaginatedList<ApiStaffMember>> {
  return apiFetch<PaginatedList<ApiStaffMember>>(`/staff-members${buildQuery(params)}`);
}

/** POST /staff-members — the only way a staff account comes into existence.
 * Creates a `status: pending` row and emails a 6-digit invite code redeemed
 * at staffAcceptInvite. Roles: super_admin. */
export function inviteStaffMember(name: string, email: string, role: ApiStaffRole): Promise<ApiStaffMember> {
  const body: InviteStaffMemberRequest = { name, email, role };
  return apiFetch<ApiStaffMember>("/staff-members", { method: "POST", body });
}

/** PATCH /staff-members/:id/role — changes a staff member's role, writes an
 * audit-log entry with a before/after snapshot. Roles: super_admin. */
export function updateStaffRole(id: string, role: ApiStaffRole): Promise<ApiStaffMember> {
  const body: UpdateStaffRoleRequest = { role };
  return apiFetch<ApiStaffMember>(withParam("/staff-members/:id/role", ":id", id), { method: "PATCH", body });
}

/** PATCH /staff-members/:id/deactivate — sets status -> expired; a
 * deactivated staff member is refused at either staffLogin or
 * staffVerifyTotp with 403 ACCOUNT_DEACTIVATED from then on. Roles:
 * super_admin. */
export function deactivateStaffMember(id: string, reason: string): Promise<ApiStaffMember> {
  const body: DeactivateStaffMemberRequest = { reason };
  return apiFetch<ApiStaffMember>(withParam("/staff-members/:id/deactivate", ":id", id), { method: "PATCH", body });
}

// ---------------------------------------------------------------------------
// Audit log — /audit-log
// ---------------------------------------------------------------------------

/** GET /audit-log — append-only. Every mutating endpoint above writes its
 * own entry as a side effect; nothing on this route writes to the log
 * itself. Roles: compliance_officer, super_admin. */
export function listAuditLog(params?: ListAuditLogParams): Promise<PaginatedList<ApiAuditLogEntry>> {
  return apiFetch<PaginatedList<ApiAuditLogEntry>>(`/audit-log${buildQuery(params)}`);
}
