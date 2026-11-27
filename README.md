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

> **Week 2 status:** full catalog — URL-synced faceted filter
> (category, price, vendor, organic / gluten-free / local, rating,
> in-stock, sort, search, pagination), category page with sidebar +
> mobile drawer + active-filter chips, search page, smart-search
> stub (keyword matcher, no AI call yet), complete product page
> (gallery, quantity, reviews, related), and Playwright E2E on
> Chromium + Firefox. No live database yet — the catalog runs on the
> seed adapter; the real Prisma adapter is implemented and switches
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

See `docs/demo-accounts.md`. Real authentication lands in Week 3;
the seeded password hashes are placeholders, not real credentials.

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
- [ ] Deploy skeleton to Vercel at end of Week 1 (needs her Vercel project)

## Week 2 done-criteria

- [x] Catalog repository: Prisma `where`/`orderBy` builders + seed adapter behind one interface
- [x] Faceted filter + sort + search + pagination, all URL-synced (copy-paste reproduces the list)
- [x] Category page: sidebar, mobile drawer, active-filter chips, subcategories, skeleton
- [x] Search page (`/search?q=`) + smart-search stub (`parseSmartQuery`, no AI call)
- [x] Product page: gallery, quantity, stock states, reviews, related products
- [x] Vitest 67 tests; Playwright E2E on Chromium + Firefox (filter acceptance, search, product/cart)
- [ ] Real Prisma queries against Neon (blocked on `DATABASE_URL`)

## Roadmap

Week 2 — full catalog: faceted filter, sort, search.
Week 3 — auth + roles + cart + checkout.
Week 4 — payments (Zarinpal sandbox), wallet, discounts; live MVP.
Week 5 — vendor panel + uploader. Week 6 — admin panel + subscriptions.
Week 7 — AI (3 features), SSE, notifications. Week 8 — polish, SEO, a11y, README.
