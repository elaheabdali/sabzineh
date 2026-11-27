# Architecture

## One app, three roles

A single Next.js App Router app serves customer, vendor and admin.
Separation is by route group, not by deployment:

```
src/app/[locale]/
  (shop)/     customer storefront: home, category/[slug], product/[slug]
  (account)/  customer panel: orders, profile, addresses, subscriptions
  (vendor)/   vendor panel: dashboard, products, orders, payouts
  (admin)/    admin panel: dashboard, users, vendors, categories, reports
```

Every route group is protected twice: `src/proxy.ts` (locale + public
routes) and a server-side guard in `src/lib/auth/guards.ts`
(`requireRole`) that runs before any data is read. A vendor can only
ever see their own rows — the filter is applied server-side from the
session's `vendorId`, never by hiding UI.

## Money rules

- The client never decides a price. `server/orders` recomputes the
  total from the database at order creation; the cart is a wish list
  with prices, not an invoice.
- `PaymentPort` (`src/lib/payments/port.ts`) is the only payment
  boundary: `createPayment`, `verify`, `refund`. The Mock
  implementation is the default; Zarinpal sandbox is a second
  implementation behind `PAYMENT_PROVIDER`. No business code imports
  a gateway directly.
- Commission is snapshotted on `OrderItem.commissionRate` at order
  time, so a later plan change never rewrites history. Payouts are
  `gross − commission` per vendor per period (`server/billing`).

## Data flow

```
browser ──► Next.js (RSC + Route Handlers)
              ├─ lib/payments (PaymentPort)
              ├─ server/billing, server/orders
              ├─ features/catalog (URL-synced filter state)
              └─ Prisma ──► PostgreSQL (Neon)
SSE: /api/events pushes order status / chat / notifications;
     the client falls back to polling with backoff when SSE drops.
```

## State

- Server state: TanStack Query, keyed by the filter URL.
- Cart + UI state: Zustand (`stores/cart.ts`, persisted to
  localStorage with an SSR-safe storage shim).
- Filter state: the URL is the only source of truth
  (`features/catalog/filter.ts` parses/builds `searchParams`),
  so a filtered link is shareable and back-button safe.

## i18n

next-intl, locales `fa` (default) and `en`, full RTL.
Messages live in `src/messages/fa.json` / `en.json`.
Vazirmatn is self-hosted from `@fontsource-variable/vazirmatn` —
no Google Fonts, no CDN, no third-party scripts.

## Monorepo

Turborepo + pnpm workspaces. Shared code lives in `packages/`:
`ui` (components), `types` (DTOs + Zod schemas),
`config` (eslint / tsconfig / prettier / tailwind presets).
Apps import them as `@sabzineh/*` workspace packages.
