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

> **Week 1 status:** monorepo skeleton, Prisma schema (23 models),
> Persian seed data (3-level category tree, 12 vendors, 120 products),
> storefront home + category + product pages, MegaMenu, cart store,
> payment port and SSE stub. No live database yet — the app renders
> from the seed JSON until `DATABASE_URL` is supplied (see below).

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
| Tests | Vitest + Testing Library; Playwright from Week 2 |

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000 → redirects to /fa
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Database (needs a Neon project)

```bash
cp .env.example .env   # then set a real DATABASE_URL
pnpm --filter web db:generate
pnpm --filter web exec prisma migrate dev --name init   # or: prisma migrate deploy
pnpm db:seed
```

Until then the storefront renders from `apps/web/src/data/seed.json`
(the same data the seed script inserts), so the app is fully
demonstrable without a database.

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

## Roadmap

Week 2 — full catalog: faceted filter, sort, search.
Week 3 — auth + roles + cart + checkout.
Week 4 — payments (Zarinpal sandbox), wallet, discounts; live MVP.
Week 5 — vendor panel + uploader. Week 6 — admin panel + subscriptions.
Week 7 — AI (3 features), SSE, notifications. Week 8 — polish, SEO, a11y, README.
