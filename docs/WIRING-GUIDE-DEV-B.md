# Dev B — KYC, Transactions, Audit Log, Staff

**Read `docs/WIRING-README.md` first.** Branch: `wiring/dev-b-kyc-transactions-audit-staff`.

## Your files (exclusive — don't touch anything outside this list)

- `app/kyc/page.tsx`
- `app/kyc/[id]/page.tsx`
- `app/transactions/page.tsx`
- `app/transactions/[id]/page.tsx`
- `app/audit-log/page.tsx`
- `app/audit-log/[id]/page.tsx`
- `app/staff/page.tsx`

## Your endpoints (`lib/api/client.ts`)

| Screen | Function | Real endpoint |
|---|---|---|
| KYC queue | `listKycSubmissions({page, pageSize, status?, documentType?, tier?})` | `GET /kyc-submissions` |
| KYC case detail | `getKycSubmission(id)` | `GET /kyc-submissions/:id` |
| KYC case detail | `saveKycReviewerChecklist(id, checklist, internalNote?)` | `PATCH /kyc-submissions/:id/reviewer-checklist` |
| KYC case detail | `decideKyc(id, decision, rejectReason?)` | `PATCH /kyc-submissions/:id/decision` |
| Transactions | `listTransactions({page, pageSize, type?, status?})` | `GET /transactions` |
| Transaction detail | `getTransaction(id)` | `GET /transactions/:id` |
| Transaction detail | `holdTransaction(id, reason)` | `PATCH /transactions/:id/hold` |
| Transaction detail | `releaseTransaction(id)` | `PATCH /transactions/:id/release` |
| Transaction detail | `rejectTransaction(id, reason)` | `PATCH /transactions/:id/reject` |
| Audit log | `listAuditLog({page, pageSize, kind?, staffId?})` | `GET /audit-log` |
| Staff | `listStaffMembers({page, pageSize, role?, status?})` | `GET /staff-members` |
| Staff | `inviteStaffMember(name, email, role)` | `POST /staff-members` |
| Staff | `updateStaffRole(id, role)` | `PATCH /staff-members/:id/role` |
| Staff | `deactivateStaffMember(id, reason)` | `PATCH /staff-members/:id/deactivate` |

## Screen-by-screen notes

### KYC queue + case detail (`app/kyc/page.tsx`, `app/kyc/[id]/page.tsx`)
This is your most complex pair — the case-detail screen was rebuilt this session with a real reviewer
checklist + attempt-limit UI already matching the real endpoints' shapes closely:
`reviewerChecks`/`internalNote`/`attemptCount`/`maxAttempts` on `ApiKycSubmission` should map directly
onto what the screen already renders. Two things to get right:
1. **The override note lives on the checklist call, not the decision call.** `decideKyc(id, decision,
   rejectReason?)` takes NO free-text field — the screen's "save checklist" action
   (`saveKycReviewerChecklist`) is what carries `internalNote`. The screen already gates
   approve/reject on a saved note existing — just point both calls at the real functions.
2. **`decideKyc`'s `rejectReason` is a fixed enum** (`unreadable | name_mismatch | expired |
   liveness_inconclusive`) — the screen's reject-reason radio options already map to this enum by
   value (check the `REJECT_REASONS` constant in `app/kyc/[id]/page.tsx`), just confirm the values you
   send match exactly.

BVN/NIN masking is server-side and role-based (`support` gets `***last4`, `kyc_reviewer`+ gets the
full value) — don't build client-side masking, just render whatever the API returns.

### Transactions + detail (`app/transactions/page.tsx`, `app/transactions/[id]/page.tsx`)
`ApiTransaction`'s `type` is lowercase (`fund|withdraw|buy|sell|convert`) and `status` has 7 values
(`pending|review|flagged|approved|rejected|completed|failed`) — both wider than the mock's Title-Case,
4-value versions. `convert` has no live backend flow (dead fields, per the docs) — don't build UI
expecting real convert rows, just don't crash if one somehow appears. Money fields are kobo — use
`lib/money.ts`. The held-transaction detail screen's release flow maps directly to
`releaseTransaction(id)` (no body) — the screen's existing reason-input UI on that action should
either move to become informational-only or get dropped, since the real endpoint doesn't accept a
reason on release (only `hold`/`reject` take one).

### Audit log + entry detail (`app/audit-log/page.tsx`, `app/audit-log/[id]/page.tsx`)
Two real fields need attention:
1. **`target` is a raw entity id, not a display name**, and — important — **the real API does not
   resolve it to a name for you** (there's no `targetName` field on the wire; that split was a
   mock-only convenience added this session to model what the UI needs). You'll need to resolve
   `target`→display name yourself based on `kind`: `kind:'account'` → look up via `getUser(target)`,
   `kind:'kyc'` → `getKycSubmission(target)`, `kind:'staff'` → look it up in your already-fetched
   `listStaffMembers()` page or call it directly if not present, `kind:'transaction'` → `getTransaction(target)`.
   Consider a small resolve-and-cache helper local to these two files rather than N+1 fetching per row —
   e.g. batch-resolve only the ids visible on the current page.
2. **`vendorFlag`/`staffReasonQuote`/`staffReasonTiming` are real now**, but only populated on
   `kind:'kyc'` entries written by a decision call — every other kind always has them `null`. The
   screen's existing conditional rendering (only show the vendor-flag/staff-reason cards when present)
   already handles this correctly, just confirm it treats `null` the same as the old mock's `undefined`.

This screen is read-only/export-only by design (matches the real API — there's no write endpoint on
this controller at all) — don't add any mutation UI here.

### Staff (`app/staff/page.tsx`)
Straightforward — field names/enum values on `ApiStaffMember` already match what the screen expects
almost exactly (just snake_case roles: `super_admin`/`compliance_officer`/`kyc_reviewer`/`support`
instead of the mock's Title Case — check any string-literal comparisons in the screen's filter/display
logic). `deactivateStaffMember(id, reason)` now requires `reason` — the screen already has a reason
dropdown built for this, wire its value straight through. There's no backend field for a *reason
options list* — the dropdown's options are a dashboard-side convenience list, keep them as free text
sent as `reason` (or keep the fixed list, backend just stores whatever string you send).

## Manual test checklist before opening your PR

- [ ] KYC queue loads real submissions; open a case, save a checklist note, approve one, reject one (confirm the attempt-limit terminal state on a 3rd reject if you can seed for it).
- [ ] Transactions list + a held transaction's detail; hold, then release it, confirm status changes.
- [ ] Audit log shows entries with resolved names (not raw UUIDs) for every kind; open an entry, confirm vendor-flag/staff-reason cards only appear on KYC-kind entries.
- [ ] Staff: invite, change a role, deactivate with a reason — confirm each shows up in the audit log.
