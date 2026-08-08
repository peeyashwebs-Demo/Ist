# Dev A — Overview, Users, Orders

**Read `docs/WIRING-README.md` first.** Branch: `wiring/dev-a-overview-users-orders`.

## Your files (exclusive — don't touch anything outside this list)

- `app/overview/page.tsx`
- `app/users/page.tsx`
- `app/users/[id]/page.tsx`
- `app/orders/page.tsx`

## Your endpoints (`lib/api/client.ts`)

| Screen | Function | Real endpoint |
|---|---|---|
| Overview | `getDeskOverview()` | `GET /desk-overview` |
| Users list | `listUsers({page, pageSize, kycStatus?, accountStatus?})` | `GET /users` |
| User detail | `getUser(id)` | `GET /users/:id` |
| User detail | `suspendUser(id, reason)` | `PATCH /users/:id/suspend` |
| User detail | `reactivateUser(id)` | `PATCH /users/:id/reactivate` |
| User detail — holdings | `getUserHoldings(userId, {page, pageSize})` | `GET /users/:id/holdings` (new, staff-only) |
| User detail — transactions | `listTransactions({userId, page, pageSize})` | `GET /transactions?userId=` |
| User detail — KYC file | `listKycSubmissions({userId, page, pageSize})` | `GET /kyc-submissions?userId=` |
| Orders | `listOrders({page, pageSize, status?})` | `GET /orders` |
| Orders | `getOrder(id)` | `GET /orders/:id` |
| Orders | `approveOrder(id)` | `PATCH /orders/:id/approve` |
| Orders | `rejectOrder(id, reason)` | `PATCH /orders/:id/reject` |

## Screen-by-screen notes

### Overview (`app/overview/page.tsx`)
Straightforward swap — `getDeskOverview()` returns both the AUM fields the screen doesn't currently
use and the `totalUsers`/`totalUsersTrend`/`kycApprovalRate`/`kycApprovalTrend`/`pendingKyc`/
`pendingKycTrend`/`activeOrders`/`activeOrdersTrend` fields the screen's KPI cards already expect —
these are now real, computed server-side, not mock. Trend shape is `{label: string, tone: 'gain'|'loss'}`,
matching what the screen already renders. The "Needs attention" and "Flagged transactions" panels on
this screen pull from KYC/Transactions data — either call `listKycSubmissions({status:'review'})` /
`listTransactions({status:'flagged'})` directly here, or leave those two panels reading from mock a
little longer if you want to land Overview's KPI section first — your call, they're independent pieces
of the same file.

### Users list (`app/users/page.tsx`)
`listUsers` returns `ApiUser[]` — field names/casing differ from the mock `User` type (`fullName` not
`name`, `kycStatus`/`accountStatus` enums match already, `portfolioValue` is kobo — use
`koboToNaira()`). No `city`/`state` mapping surprises, they're present on `ApiUser` directly. Filter
dropdowns map straight to `kycStatus`/`accountStatus` query params — no client-side filtering needed
anymore, pass the selected filter straight to `listUsers`.

### User detail (`app/users/[id]/page.tsx`)
This is the composed screen — **there is still no single backend call that returns a user with their
holdings/transactions/KYC nested**. You make four calls: `getUser(id)`, `getUserHoldings(id)`,
`listTransactions({userId: id})`, `listKycSubmissions({userId: id})`. The KYC one returns a *list* —
in practice a user has at most one submission, but treat it as a list (take `data[0]`, handle the
empty case — a user can genuinely have zero submissions pre-onboarding). Suspend/reactivate already
have matching mock functions with the same signature shape (`reason` string) — should be a clean swap.

### Orders (`app/orders/page.tsx`)
This screen was built directly against the mock's `Order` type (defined locally in
`lib/mock/orders.ts`, not in `types/api.ts`) — swap it for `ApiOrder` from `lib/api/types.ts`. Field
names mostly match (`id, userId, clientName, ticker, side, units, orderType, limitPrice, status,
createdAt`); `price`/`value`/`amountKobo` are kobo integers on the real API (the mock may have used
different formatting — check). The screen's default filter to `status:'pending'` should become
`listOrders({status: 'pending'})` server-side instead of client-side filtering.

## Manual test checklist before opening your PR

- [ ] Sign in through the real Login flow, land on `/overview` with real KPI numbers.
- [ ] Users list: filters, pagination, and search (client-side search is fine, filters should hit the API).
- [ ] Open a user, see real holdings/transactions/KYC sections (or their real empty states if the seeded user has none).
- [ ] Suspend a user, confirm the audit log shows the entry (read-only check via `listAuditLog` or ask Dev B once Audit Log is wired).
- [ ] Orders: the pending queue shows real data or a real empty state; approve/reject actually mutate server-side (verify by re-fetching).
