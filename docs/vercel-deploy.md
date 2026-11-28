# Vercel deploy (live)

The project was imported from the Vercel dashboard (the Vercel MCP
connection has no access to the `elaheabdalis-projects` team scope —
API calls return 403 — so dashboard import is the only path).

- **Project:** `sabzineh-web` (team `elaheabdalis-projects`)
- **Live URL:** https://sabzineh-web.vercel.app
- **Verified:** 2026-11-27 — the deployment for commit `38d3458`
  (end of Week 3) reports success on GitHub, and
  `https://sabzineh-web.vercel.app/fa` returns HTTP 200.
- **Build settings (set at import):** Root Directory `apps/web`,
  Framework Next.js, Build Command `pnpm --filter web build`
  (same as ela-coffee). Every push to `main` auto-deploys.

## Environment variables (Vercel dashboard → project → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | PENDING — see below. Until set, the app renders from seed JSON (in-memory store, resets on redeploy). |
| `PAYMENT_PROVIDER` | `zarinpal` | Switches the live site from Mock to the real sandbox gateway. Keep `mock` until the sandbox click-through passes. |
| `ZARINPAL_MERCHANT_ID` | test UUID (`00000000-0000-0000-0000-000000000000` works in sandbox) | Sandbox accepts any UUID; no real money moves. The real merchant id goes here only after sandbox approval. |
| `ZARINPAL_SANDBOX` | `true` | Anything but `false` selects the sandbox. Never set `false` without the real merchant id. |
| `NEXT_PUBLIC_APP_URL` | `https://sabzineh-web.vercel.app` | Used as the Zarinpal callback base (`/api/payments/callback`). |

Never put secrets in git. `.env.local` is gitignored — and creating
it through the GitHub website bypasses `.gitignore`, which is how a
real `DATABASE_URL` was once committed to public history (since
deleted from the tree, still in history: rotate the Neon password
before any real data goes in).

## After setting env vars

Redeploy (Deployments → ⋯ → Redeploy) — env vars only apply to
new deployments.

## Post-deploy verification checklist

- [ ] `/fa` returns 200, RTL, category tree renders.
- [ ] Demo login works for all three roles
      (`admin@` / `vendor@` / `customer@sabzineh.ir`, `demo1234`).
- [ ] Full purchase flow on Mock: cart → checkout → mock pay →
      confirmation shows PAID and the cart is empty.
- [ ] With `PAYMENT_PROVIDER=zarinpal`: checkout redirects to
      `sandbox.zarinpal.com/pg/StartPay/S000…`; pay with the
      sandbox test card; the callback verifies server-side and the
      order page shows PAID; the bag/cart is empty afterwards.
      (Sandbox captcha fields are sometimes inert in cloud browsers;
      the Pay button still completes the test payment.)
- [ ] With `DATABASE_URL` set: `prisma migrate deploy` has been run
      (see README → Database) and the storefront reads from Neon
      instead of seed JSON — create an order, redeploy, and confirm
      the order is still there.

## Troubleshooting

- Build fails with `prisma` / `tsx` not found → `pnpm install`
  was not run (see README → Database); on a fresh machine the
  postinstall runs `prisma generate`.
- `Environment variable not found: DATABASE_URL` from Prisma →
  the `.env` file must live in `apps/web/` (not the repo root).
- A deploy serves stale CSS/JS → Vercel only rebuilds when
  `apps/web` changes; an empty commit is skipped as "Not affected".
