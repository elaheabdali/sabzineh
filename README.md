# Sabzineh — سبزینه

A multi-vendor marketplace for organic and local food, with a weekly
subscription box. One Next.js App Router app serves three roles —
customer, vendor and admin — separated by route groups and server-side
RBAC guards.

This is a portfolio project built to the standard of a real product:
server-side pricing (the client never decides the final total),
a swappable payment port (Mock today, Zarinpal sandbox next),
subscription billing on both sides (buyer box + vendor plan),
and CI running typecheck, lint, Vitest and build on every push.

> **Week 4 status:** live on Vercel — https://sabzineh-web.vercel.app
> (project `sabzineh-web`, deployment for `38d3458` green, `/fa`
> returns 200). Real Zarinpal sandbox `PaymentPort` is code-complete
> (request authority → StartPay → callback → server-side verify,
> following the ela-coffee pattern verified live twice there),
> with 15 mocked-HTTP unit tests and a gated sandbox E2E spec
> (`E2E_ZARINPAL=1`, skipped in CI). The sandbox authority leg was
> verified live from this machine (real `S000…` authority from the
> test merchant id) and the gated sandbox E2E passes 6/6 (Chromium
> + Firefox); the full browser click-through still needs a
> human on the deployed site. Migrations 0001–0003 were validated
> offline (24 tables, 17 enums, 186 columns, 25 indexes — all match
> the schema) and `migration_lock.toml` was added, which
> `prisma migrate deploy` requires. No live database yet — the app
> still runs on the seed adapter; the real Prisma adapter switches
> on automatically once `DATABASE_URL` is set (see below).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router + TypeScript (strict) |
| Styling | Tailwind CSS 4, shared `@sabzineh/ui` package |
| State | Zustand (cart, UI) + TanStack Query (server state) |
| Data | Prisma 6 + PostgreSQL (Neon) |
| Forms | React Hook Form + Zod (shared schemas in `@sabzineh/types`) |
| i18n | next-intl, `fa` default, full RTL, self-hosted Vazirmatn |
| Payment | `PaymentPort` — Mock by default, Zarinpal sandbox (`docs/zarinpal-setup.md`) |
| Tests | Vitest + Testing Library; Playwright 1.65.1 (Chromium + Firefox) |

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000 → redirects to /fa
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm --filter web test:e2e   # Playwright; builds + serves prod on :3100
```

## Database (needs a Neon project)

```bash
cp .env.example apps/web/.env   # then set a real DATABASE_URL in apps/web/.env
pnpm --filter web db:generate
pnpm --filter web db:migrate   # applies migrations/0001_init + 0002_add_product_local (or: prisma migrate deploy)
pnpm --filter web db:seed
```

> The `.env` file must live in `apps/web/` — that is where the Prisma
> CLI runs and where Next.js loads env from. A `.env` at the repo root
> is NOT read, so `DATABASE_URL` there produces
> `Environment variable not found: DATABASE_URL`.

Until then the storefront renders from `apps/web/src/data/seed.json`
(the same data the seed script inserts), so the app is fully
demonstrable without a database.

### Catalog data source: seed adapter vs Prisma adapter

`src/features/catalog/repository.ts` defines one `CatalogRepository`
interface with two adapters:

- `SeedCatalogRepository` — in-memory over `seed.json`, active while
  `DATABASE_URL` is unset. Filter, sort, facet counts and pagination
  have the exact same semantics as the Prisma adapter (same Vitest
  expectations in `repository.test.ts`).
- `PrismaCatalogRepository` — real queries: `where`/`orderBy` built
  by `features/catalog/prisma.ts` (pure, unit-tested functions),
  facet counts via `groupBy`/`aggregate`, server-side pagination.
  It is selected automatically by `getCatalogRepository()` as soon
  as `DATABASE_URL` is set — no page code changes.

The migration for the Week 2 `Product.local` column
(`0002_add_product_local`) was written by hand from the schema
because no database was available to run `prisma migrate dev`
against; verify it with `prisma migrate deploy` once Neon exists.

### Auth, sessions and orders: Prisma vs memory adapter (Week 3)

The same switch applies to auth and checkout, behind two more
interfaces in `src/lib/auth/store.ts` (`UserStore`/`SessionStore`)
and `src/server/store.ts` (`DataStore`):

- `MemoryUserStore` / `MemorySessionStore` / `MemoryDataStore` —
  in-memory, active while `DATABASE_URL` is unset. Demo users are
  seeded from `seed.json` and the demo password is hashed with
  bcrypt once per server process (`hashPassword(DEMO_PASSWORD)`,
  never stored in code). The demo-customer wallet holds 150,000
  Toman; discounts come from `seed.json`. Orders, payments and
  wallet transactions live only in process memory and reset on
  restart — the same seed-JSON fallback the catalog uses.
- `PrismaUserStore` / `PrismaSessionStore` / `PrismaDataStore` —
  real Postgres rows (migration `0003_auth_sessions`: `Session`
  table + `Order.discountAmount/walletApplied/payable/addressId`).
  Selected automatically by `getUserStore()` / `getSessionStore()` /
  `getDataStore()` as soon as `DATABASE_URL` is set — no page or
  action code changes. `getAuthDataSource()` /
  `getOrderDataSource()` report which adapter is active.

Sessions are opaque random tokens stored server-side with a 7-day
expiry; the cookie (`sabzineh-session`, httpOnly, sameSite=lax,
secure in production) carries only the token. `getSession()` in
`src/lib/auth/guards.ts` resolves the token server-side and never
trusts a client-supplied role. `src/proxy.ts` redirects guests
away from `/account`, the vendor panel (`/vendor/dashboard`,
`/vendor/products`, `/vendor/settings`) and `/admin` when the cookie is
absent (fast path only — the page guards do the real check). The
public shop page (`/vendor/<shop-slug>`) is open to guests.

Checkout rules (all server-side, `src/server/orders/service.ts`):
prices and stock are re-read at order time, the same
Idempotency-Key returns the same order (no double charge, no
double wallet debit, no double stock reservation), stock is
reserved at creation and released on cancel/failed payment, and a
cancelled order refunds the wallet debit with a
`WalletTransaction` record. The cart itself is device-local
(Zustand + persist) and survives login; the order page clears it
once the order is seen as PAID.

### If `pnpm install` fails with EPERM chown on the lockfile

On this VM the workspace files are owned by `root:nogroup`, and
pnpm's atomic lockfile write chowns its temp file to the original
file's group — which the sandbox refuses (`EPERM: operation not
permitted, chown '.../pnpm-lock.yaml.<random>'`). Fix once:

```bash
chown root:root pnpm-lock.yaml node_modules/.pnpm/lock.yaml
pnpm install --frozen-lockfile
```

### If `prisma generate` cannot download engines

The Prisma CLI downloads engine binaries from `binaries.prisma.sh`.
If that host is blocked where you work (the sandbox used to build
this repo resets those connections — Node's fetch fails while
`curl` works), place the two binaries by hand:

```bash
H=c2990dca591cba766e3b7ef5d9e8a84796e47ab7   # engines version of Prisma 6.19.3
ENG="node_modules/.pnpm/@prisma+engines@6.19.3/node_modules/@prisma/engines"
curl -sL -o /tmp/schema-engine.gz "https://binaries.prisma.sh/all_commits/$H/debian-openssl-3.0.x/schema-engine.gz"
curl -sL -o /tmp/libquery_engine.so.node.gz "https://binaries.prisma.sh/all_commits/$H/debian-openssl-3.0.x/libquery_engine.so.node.gz"
gunzip -c /tmp/schema-engine.gz > "$ENG/schema-engine-debian-openssl-3.0.x"
gunzip -c /tmp/libquery_engine.so.node.gz > "$ENG/libquery_engine-debian-openssl-3.0.x.so.node"
gunzip -c /tmp/libquery_engine.so.node.gz > "node_modules/.pnpm/prisma@6.19.3_typescript@5.9.3/node_modules/prisma/libquery_engine-debian-openssl-3.0.x.so.node"
chmod +x "$ENG/schema-engine-debian-openssl-3.0.x"
pnpm --filter web db:generate
```

These files live in `node_modules` (not git), so a fresh machine
with working network needs nothing — `pnpm install` downloads them
via the normal postinstall.

### Tailwind safelist for the shared ui package

Tailwind v4 in this Turbopack setup only scans `apps/web`, so
utilities used only in `packages/ui` are never emitted (verified:
`animate-spin`, `bg-red-700`, `border-dashed` were missing from the
production CSS; `@source` does not fix it — same lesson as
ela-coffee batch 8). `apps/web/src/ui-safelist.ts` lists them as
string literals so they get emitted. After adding a ui-only
utility, run `node scripts/sync-ui-safelist.mjs` and re-check the
built CSS with `grep -o <utility> apps/web/.next/static/chunks/*.css`.

## Demo accounts (seeded, demo only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@sabzineh.ir | demo1234 |
| Vendor | vendor@sabzineh.ir | demo1234 |
| Customer | customer@sabzineh.ir | demo1234 |

See `docs/demo-accounts.md`. Week 3: bcrypt password hashes (demo
password `demo1234` hashed at seed time), httpOnly cookie sessions,
registration for customers. Demo only — never ship these accounts
to production.

## Project structure

```
sabzineh/
  apps/web/            # the Next.js app (all three roles)
    src/app/[locale]/  # (shop) (account) (vendor) (admin) route groups
    src/app/api/events # SSE channel (order status, chat, notifications)
    src/lib/payments/  # PaymentPort: createPayment / verify / refund
    src/server/        # billing (subscriptions, commission) + orders
    src/features/      # catalog: URL-synced faceted filter
    src/stores/        # cart (Zustand + persist)
    prisma/            # schema.prisma, migrations, seed.ts
  packages/ui/         # Button, Input, Modal, DataTable, Uploader, MegaMenu
  packages/types/      # shared DTOs + Zod schemas
  packages/config/     # eslint / tsconfig / prettier / tailwind presets
  docs/                # architecture, demo accounts, Zarinpal setup
```

## Week 1 done-criteria

- [x] Turborepo/pnpm skeleton per the plan (pages 5–6)
- [x] Prisma schema with all models + indexes; migration SQL generated
- [x] Seed: 3-level category tree, 12 vendors, 120 products, 3 demo accounts
- [x] Vitest + lint + typecheck green from the first commit; CI green
- [x] Deploy skeleton to Vercel (project `sabzineh-web`, live at https://sabzineh-web.vercel.app — see `docs/vercel-deploy.md`)

## Week 2 done-criteria

- [x] Catalog repository: Prisma `where`/`orderBy` builders + seed adapter behind one interface
- [x] Faceted filter + sort + search + pagination, all URL-synced (copy-paste reproduces the list)
- [x] Category page: sidebar, mobile drawer, active-filter chips, subcategories, skeleton
- [x] Search page (`/search?q=`) + smart search (`parseSmartQuery`, deterministic heuristics — synonyms, typo correction, phrase → filters; no AI call, see Week 7)
- [x] Product page: gallery, quantity, stock states, reviews, related products
- [x] Vitest 67 tests; Playwright E2E on Chromium + Firefox (filter acceptance, search, product/cart)
- [ ] Real Prisma queries against Neon (blocked on `DATABASE_URL`)

## Week 3 done-criteria

- [x] Real auth: bcrypt passwords, httpOnly cookie sessions (7-day, server-side records, logout invalidates), customer registration (Iranian mobile + password strength), one-click demo login for all 3 roles
- [x] Roles + guards: proxy redirect for guests, `requireRole` per route group, vendors see only their own data (vendorId from session), cross-user order pages return not-found
- [x] Cart: per-vendor groups, quantity controls capped at stock, persisted cart merged on login, server-side price/stock re-validation at checkout
- [x] Checkout: address book (Iranian postal code + phone), server-side discount validation (usage cap, min amount, expiry, once per user), wallet full/partial + gateway, idempotent order creation, mock gateway page, cancel/failed path keeps the cart
- [x] Vitest 104 tests; Playwright E2E on Chromium + Firefox (full purchase flow, cancelled payment, role guards, cross-user isolation)
- [ ] Real Prisma queries against Neon (password rotation declined
      by her — the leaked string in public git history stays valid,
      demo data only; `prisma migrate deploy` for 0001/0002/0003
      still to run once `DATABASE_URL` is set)

## Week 4 done-criteria

- [x] Real Zarinpal sandbox `PaymentPort`: request authority, StartPay redirect, callback, server-side verify (code 100/101 → PAID, error codes → FAILED, transport failures throw so the order stays PENDING and retryable); `ZARINPAL_BASE_URL` escape hatch; refund throws (no Zarinpal refund API — wallet credit is the refund path)
- [x] 15 mocked-HTTP unit tests for the Zarinpal port (authority, Rial conversion, error codes, amount mismatch, non-JSON/HTTP errors, sandbox/live hosts, 42-char order id, HTTP 401/-51 unpaid authority)
- [x] Gated sandbox E2E spec (`tests/e2e/zarinpal-sandbox.spec.ts`, skipped unless `E2E_ZARINPAL=1` with `PAYMENT_PROVIDER=zarinpal`): StartPay redirect with a real authority, callback NOK cancels, callback OK for an unpaid authority never marks PAID
- [x] Sandbox authority leg verified live (real `S000…` authority from the test merchant id); gated sandbox E2E passes 6/6 (Chromium + Firefox); full browser click-through still needs a human on the deployed site
- [x] Migrations validated offline against the schema (24 tables, 17 enums, 186 columns, 25 indexes — all match); `migration_lock.toml` added (required by `prisma migrate deploy`)
- [x] Vercel deploy documented (`docs/vercel-deploy.md`): project `sabzineh-web`, live URL verified 200, env-var table, post-deploy checklist
- [ ] `prisma migrate deploy` + seed against Neon (needs `DATABASE_URL`)
- [ ] Sandbox click-through on the live site (human, with the test card)

## Week 5 done-criteria

- [x] Vendor dashboard: revenue / order count / product count, top-5 products, incoming order list with fulfilment buttons (PAID → PREPARING → SHIPPED → DELIVERED, one step at a time, server-side); a PENDING vendor sees an "under review" banner
- [x] Multi-step product form (basics → images → attributes → review), per-step Zod validation on client and server; Uploader (drag-and-drop, max 4 × 1 MB, data: URLs in demo mode, `serverActions.bodySizeLimit: "5mb"`); draft vs published — drafts never appear in the public catalog (both adapters gate on `PUBLISHED`)
- [x] Product management: search + status filter, edit (same form, prefilled), publish/unpublish/archive, quick stock +/− with the catalog guard
- [x] Vendor profile/settings: shop name, city, bio, phone, logo URL, payout IBAN + account holder (stored only — migration `0004_vendor_profile_fields` — never rendered publicly); public shop page `/vendor/<slug>` for APPROVED vendors only
- [x] Vendor registration (`/auth/vendor-register`): creates a VENDOR user + PENDING profile; the vendor can draft but cannot publish until admin approval (Week 6)
- [x] Scoping: every vendor query is filtered by the session vendorId server-side; cross-vendor read/update/publish/restock/order-transition all fail (unit + E2E); the proxy now protects only the panel paths — the public shop page is open to guests
- [x] Vitest 143 tests (24 new); Playwright E2E 9 new vendor tests on Chromium + Firefox (create → publish → catalog, draft 404, edit stock, cross-vendor isolation, registration, shop page, fulfilment)
- [ ] `prisma migrate deploy` for 0004 against Neon (needs `DATABASE_URL`)

### Vendor data: Prisma vs memory adapter (Week 5)

`src/features/vendor/repository.ts` follows the Week 2 pattern:
`MemoryVendorRepository` (seed products array + module-level image/
attribute registries) vs `PrismaVendorRepository` (real `Product` /
`ProductImage` / `VendorProfile` rows), switched by
`getVendorRepository()` on `DATABASE_URL` only. Vendor-created
products are appended to the same seed `products` array the catalog
reads, so a PUBLISHED product shows up in the storefront in the same
process; uploaded images ride as data: URLs (`src/data/product-
images.ts`) and are served under the CSP `img-src 'self' data:`.
Order status is a single status per order (Week 1 schema): when a
vendor advances fulfilment the whole order flips — per-item
fulfilment is a Week 6+ concern.

## Week 6 done-criteria

- [x] Admin dashboard (`/admin/dashboard`): real stats (users, vendors, orders, revenue), recent 5 orders, low-stock alerts (≤ 5)
- [x] User management (`/admin/users`): server search + role filter, `DataTable` from `@sabzineh/ui`, detail page, suspend/activate; suspending kills all sessions and the login service blocks suspended users server-side (`loginWithCredentials` throws `suspended`); cannot suspend yourself or the last ACTIVE admin
- [x] Vendor approval queue (`/admin/vendors`): approve → APPROVED (can publish) / reject with reason (vendor sees it on their dashboard); every action audit-logged (actor, action, target, timestamp); re-approve/re-reject of a decided request is rejected
- [x] Category tree CRUD (`/admin/categories`): add/edit/rename/reorder/move with pure validation rules (`category-rules.ts`: max 3 levels, no cycles, no self-parent); delete blocked when the category has children or products (reassign products to another category first)
- [x] Discount code CRUD (`/admin/discounts`): reuses the Week 3 server-side validation; delete blocked when the code was ever used by an order
- [x] Two-sided subscriptions: (a) buyer weekly box (`/account/subscription`) — pick a plan, pay by wallet or Zarinpal sandbox, pause / skip a week / resume / cancel; a weekly box order is generated per active subscription with deterministic contents (hash-offset pick from in-stock products, priced from the plan) and an invoice; (b) vendor plan (`/vendor/subscription`) — basic 12% commission / 20 products, pro 8% / 200, enforced server-side (product cap on create, commission rate snapshotted on order items); no plan = basic terms
- [x] Payouts: per-vendor payout computed from DELIVERED order items (gross − snapshotted commission = net), REQUESTED → APPROVED → PAID, one open payout per vendor + period; vendor requests on `/vendor/subscription`, admin approves/marks paid on `/admin/payouts`; payouts are records only — no real bank transfers
- [x] Order oversight (`/admin/orders`): status/vendor filters, read-only detail with user + product titles; audit log page (`/admin/audit`)
- [x] Migration `0005_admin_subscriptions` (PayoutStatus REQUESTED/APPROVED, `VendorProfile.rejectionReason`, `BoxDelivery.orderId`); schema validated offline, client regenerated
- [x] Vitest 188 tests (45 new: approval transitions, suspend blocks login, category-tree rules, subscription lifecycle, payout arithmetic); Playwright E2E 5 new admin tests on Chromium + Firefox (approve → publish, reject with reason, suspend → login blocked, subscribe → pause → resume, sell → deliver → payout → paid)
- [ ] `prisma migrate deploy` for 0005 against Neon (needs `DATABASE_URL`) — migrations 0001–0005 still never ran against Neon, which is why category/product pages fail on the live site (see below)

### Admin / subscription / payout data: Prisma vs memory adapter (Week 6)

`src/server/billing/store.ts` follows the same pattern:
`MemoryBillingStore` (module-level maps, seeded with the demo
customer's ACTIVE box subscription) vs `PrismaBillingStore` (real
`Subscription` / `BoxDelivery` / `Invoice` / `Payout` / `AuditLog`
rows), switched by `getBillingStore()` on `DATABASE_URL` only.
Admin user/vendor/category/discount operations go through the same
`DataStore` / catalog / vendor repositories as Weeks 2–5.
**Cross-bundle fix (Week 6):** the seed arrays in `src/data/seed.ts`
and the image registry in `src/data/product-images.ts` now live on
`globalThis` — Next.js compiles route handlers into a separate bundle
from RSC pages, so a module-level array was instantiated twice and a
vendor-created product was invisible to `/api/catalog/products` (and
the cart that reads it), even though its public page rendered. The
data/billing stores already used this singleton pattern; the seed
arrays were the only ones that didn't.

## Week 7 done-criteria

- [x] Smart search upgraded from the Week 2 stub: Persian synonym expansion (incl. English → Persian), typo-tolerant matching (Levenshtein ≤ 2, corrections shown to the user, never hidden), phrase → structured filters (price below/above/between, min rating, category + vendor by name) — `features/catalog/smart-search.ts`
- [x] Personalised recommendations ("پیشنهاد برای شما", homepage + cart): deterministic scoring formula over order history + cart + views (`features/ai/recommendations.ts` — vendor affinity +6/order capped at 12, category affinity +4 capped at 8, same-vendor bundle +8, viewed +3), a "why this" line per card, best-seller fallback for guests; served by `GET /api/recommendations`
- [x] Rule-based shopping assistant (floating panel on every page, `POST /api/assistant`): product search from real catalog data, subscription plans, order status for the caller's own orders only (server-side session scoping), payment/shipping/discount FAQs, honest handoff to human support when it cannot answer; no fake "typing" claims
- [x] Vendor description/tag draft generator (button in the product form): fixed Persian/English templates + keyword extraction, editable before save, never auto-published (`features/ai/description.ts`)
- [x] Realtime SSE (`GET /api/events`): session-required, per-user stream on an in-process bus (`server/events.ts`); every event is first persisted as a Notification row (Prisma adapter when `DATABASE_URL` is set, memory adapter otherwise — `server/store.ts`, no new migration: the `Notification` table exists since 0001). Events emitted on payment verified (`order-paid`), order status change, box generated, vendor approved/rejected, payout approved/paid
- [x] Notifications center: header bell with unread count (SSE live + polling fallback with backoff), list page `/account/notifications` with mark-all-read; the bell and the page stay in sync via a `sabzineh:notifications-changed` event
- [x] Honest AI note: all three "AI" features are deterministic server-side heuristics — no external AI API, no API key, no third-party script (see `docs/architecture.md`)
- [x] Vitest 222 tests (34 new: smart search, recommendations, assistant routing, description drafts, event-bus scoping, notification store); Playwright E2E 10 new AI/realtime tests on Chromium + Firefox
- [ ] `prisma migrate deploy` for 0001–0005 against Neon (needs `DATABASE_URL`) — still never ran, which is why category/product pages fail on the live site (see below)

### Production status (2026-11-27, still open)

Homepage `/fa` loads, but category/product pages fail with a Next.js
server error on https://sabzineh-web.vercel.app. Diagnosis:
`DATABASE_URL` is set in Vercel runtime, so the catalog repository
uses the Prisma adapter, but the Neon database has no tables —
migrations 0001–0005 were never run (`prisma migrate deploy` + seed
against Neon, or temporarily remove `DATABASE_URL` from Vercel env so
the app falls back to seed data). Do not try to fix production from
this VM: there is no `DATABASE_URL` here and no Vercel API access to
the team scope.

Week 2 — full catalog: faceted filter, sort, search.
Week 3 — auth + roles + cart + checkout.
Week 4 — payments (Zarinpal sandbox), wallet, discounts; live MVP.
Week 5 — vendor panel + uploader. Week 6 — admin panel + subscriptions.
Week 7 — AI (3 features), SSE, notifications. Week 8 — polish, SEO, a11y, README.
