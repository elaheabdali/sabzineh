# Demo accounts

Seeded by `apps/web/prisma/seed.ts` (password `demo1234` for all three
— demo only; stored as a real bcrypt hash since Week 3, and hashed
in-memory in seed mode).

| Role | Email | Shop / note |
|---|---|---|
| Admin | admin@sabzineh.ir | Full admin panel, approves vendors/products |
| Vendor | vendor@sabzineh.ir | Owns «باغ سبز کرج» (vendor `v01`), 10 products |
| Customer | customer@sabzineh.ir | Has an active weekly box subscription (seeded) |

## Seed data at a glance

- 6 top-level categories, 3 levels deep (29 leaf categories)
- 12 vendors (farmers, local producers, organic shops)
- 120 products with Persian titles, Toman prices, stock and flags
  (`organic`, `glutenFree`), ratings and descriptions
- 4 plans: 2 box plans (weekly / biweekly) + 2 vendor plans
  (basic / pro, different commission rates and product caps)
- 3 discount codes: `SABZ10` (10%), `BOX20` (box only), `WELCOME`
- 2 banners on the home page

Without a database the storefront renders the same data from
`apps/web/src/data/seed.json`.

## Vendor registration (Week 5)

Anyone can request a vendor account at `/auth/vendor-register`
(name, email, Iranian mobile, password, shop name, city). The request
creates a VENDOR user and a PENDING vendor profile: the new vendor
can log in and save product drafts, but cannot publish until an admin
approves (`/admin/vendors` — approve/reject with reason, audit-logged).
The vendor dashboard shows the request as "under review".

Vendor panel (`/vendor/dashboard`, `/vendor/products`,
`/vendor/products/new`, `/vendor/settings`) is scoped to the signed-in
vendor's own data; the public shop page is `/vendor/<shop-slug>`
(e.g. `/vendor/bagh-sabz-karaj`).
