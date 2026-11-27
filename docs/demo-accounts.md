# Demo accounts

Seeded by `apps/web/prisma/seed.ts` (password `demo1234` for all three
— demo only; the stored hash is a placeholder until real auth lands
in Week 3).

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
