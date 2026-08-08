# Wiring the dashboard to the real backend

Read this first — both dev guides assume it. It covers what's already done, what the shared
foundation gives you, and the conventions to follow so your two branches merge cleanly.

## What's already done

- **Every screen's UI is fully built.** All 8 screens (Login, Overview, Users + detail, KYC + case
  detail, Transactions + detail, Orders, Audit Log + entry detail, Staff) exist, are design-fidelity
  checked against the approved source, and currently run on mock data (`lib/mock/*.ts`). Wiring means
  replacing the mock data calls with real API calls and adapting render logic to the real response
  shapes — not building new UI.
- **Login is fully wired for real.** `app/login/page.tsx` does the real two-step flow
  (`POST /staff/auth/login` → `POST /staff/auth/verify-totp`), including first-login TOTP enrollment
  and the "forgot password" honest-gap state (there's no backend route for self-service reset).
  Neither dev touches this file.
- **The shared API client is built** (`lib/api/`) — this is what makes the two guides below fully
  independent of each other. See below.
- **Backend additions have landed** (see `Kudimata-Securities-Backend` `docs/admin-api-reference.html`
  for the full 30-endpoint reference): `userId` filters on transactions/kyc-submissions, a staff-only
  `GET /users/:id/holdings` route, a required `reason` on staff deactivate, and real `totalUsers` /
  `kycApprovalRate` / `pendingKyc` / `activeOrders` fields on `GET /desk-overview`.

## The shared foundation (`lib/api/`) — read this before writing any wiring code

- **`lib/api/types.ts`** — every request/response shape for all 30 real endpoints, in the backend's
  actual wire format: money as integer **kobo** (not formatted strings), snake_case enum values where
  the backend uses them (e.g. `compliance_officer`), lowercase `kind` on audit entries, etc. These are
  named `Api*` (`ApiUser`, `ApiOrder`, `ApiTransaction`, `ApiKycSubmission`, `ApiStaffMember`,
  `ApiAuditLogEntry`, `ApiDeskOverview`, `ApiHolding`...) to avoid clashing with the mock-oriented types
  already in `types/api.ts` — **don't edit `types/api.ts` or import mock types into wired code**, use
  the `Api*` types instead.
- **`lib/api/client.ts`** — one typed function per endpoint (`listUsers`, `getUser`, `suspendUser`,
  `listOrders`, `approveOrder`, `listTransactions`, `holdTransaction`, `listKycSubmissions`,
  `decideKyc`, `getUserHoldings`, `listStaffMembers`, `inviteStaffMember`, `listAuditLog`, etc. — 30
  total, one per real endpoint, fully typed params/return). Every non-2xx response throws `ApiError`
  (`{status, code, message, details}`) — never a bare `Error`. Import functions from here, never
  hand-write a `fetch` call or a response shape.
- **`lib/api/auth.tsx`** — `AuthProvider` (already mounted in `app/layout.tsx`, don't touch it again)
  and `useAuth()`. Use `useAuth().session` to read the current staff id/role, `useAuth().isAuthenticated`
  to guard a page. Session persistence is handled for you — you never touch `localStorage` directly.
- **`lib/money.ts`** — `koboToNaira(kobo)` / `signedKoboToNaira(kobo)` / `nairaToKobo(string)`. Use
  these for every money field coming off the real API instead of the mock's pre-formatted strings.

## Conventions for your branch

1. **Don't touch `types/api.ts` or `lib/mock/*.ts`.** They stay as-is — reference material for the
   original design intent, and other screens (not yet on your branch) may still depend on them.
2. **Don't touch any screen file outside your guide's list.** That's how the two branches merge
   without conflicts. If you find a shared component (`components/ui/*`, `components/shell/*`) needs a
   change, make it additive (new prop, new optional field) — never change an existing prop's meaning,
   since the other dev's branch depends on the same component.
3. **Every list call is paginated.** All list endpoints return `{data, meta:{page, pageSize, total,
   totalPages}}` — reuse the existing `Pagination` component and its `onChange` prop the way each
   screen already does for its mock data.
4. **Handle three states per data surface: loading, error, empty.** Each screen already has a loading
   skeleton (`useMockLoading` was the old mock-timer hook — replace it with real `useState`/`useEffect`
   around your API call, or a small `useEffect`-based fetch hook if you prefer). For errors, catch
   `ApiError` and show its `.message`. For empty, most screens already have an empty-state component
   (`EmptyStateCard`, the KYC "all clear" state, etc.) — reuse it for a real zero-result response, don't
   build a new one.
5. **There's a live backend to test against — no local Postgres needed.**
   `https://kudimata-securities-backend-production.up.railway.app` (verified live: matches the
   documented error envelope exactly, CORS is open to any origin). Copy `.env.local.example` to
   `.env.local` — it already points `NEXT_PUBLIC_API_BASE_URL` at this URL. You can still run against a
   local backend instead (`npm run start:dev` in `Kudimata-Securities-Backend` + your own Postgres) by
   overriding the var in your own `.env.local` — just don't commit a change to the example file's
   default.

   **Sign-in credentials for the live deployment:** the bootstrap super_admin is seeded —
   `admin@kudimata.internal` / `SmokeTest123!`. Verified: `POST /staff/auth/login` with these succeeds
   and returns a real `preAuthToken`. **Missing piece: the TOTP secret.** It's generated fresh on each
   `prisma/seed.ts` run and only ever printed to that run's stdout (`Seeded bootstrap super_admin
   StaffMember: ... totpSecret=...`) — never stored anywhere retrievable via the API, by design (a
   checked-in secret would be a real credential leak). Pull it from the Railway deploy/seed logs, or
   ask whoever has Railway dashboard access to grab it, then load it into an authenticator app
   (manual key entry) to get 6-digit codes for `POST /staff/auth/verify-totp`. Until then you can
   verify `staffLogin()` works but not the full sign-in flow end-to-end — build against the documented
   contract in the meantime, per the docs' `EX_SESSION`/`EX_SESSION_FIRST_LOGIN` fixtures.
6. **Branch off `main` after both this foundation and Login are merged** (they already are). Name your
   branch per your guide below. Open your PR against `main` when your screens pass their own manual
   test pass — don't wait for the other dev's branch.
