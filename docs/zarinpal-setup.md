# Zarinpal setup (sandbox)

Payments go through `PaymentPort` (`src/lib/payments/port.ts`).
`PAYMENT_PROVIDER=mock` is the default and needs no credentials;
`PAYMENT_PROVIDER=zarinpal` selects the sandbox implementation.

## Sandbox (no real money)

1. Create a sandbox merchant at the Zarinpal sandbox panel and copy
   the test merchant UUID.
2. In `.env.local` (never in git):

```bash
PAYMENT_PROVIDER=zarinpal
ZARINPAL_MERCHANT_ID=<test uuid>
ZARINPAL_SANDBOX=true
```

3. Restart the dev server and complete a checkout. The flow is the
   real one — create authority, redirect to
   `sandbox.zarinpal.com/pg/StartPay/<authority>`, callback, verify —
   only no real money moves.

## Going live (later, after sandbox approval)

1. Replace the merchant id with the real 36-character id from the
   Zarinpal panel.
2. Set `ZARINPAL_SANDBOX=false`.
3. Set both values in Vercel environment variables, never in the repo.

## Troubleshooting

- `PAYMENT_PROVIDER=zarinpal` with an empty merchant id throws at
  startup on purpose — a misconfigured gateway must fail loudly,
  not silently take mock payments.
- Sandbox captcha fields are sometimes inert in cloud browsers; the
  Pay button still completes the test payment.
- Every payment is verified server-side in the callback; the result
  page shows the order's stored status, never the client's claim.

## Week 4 notes

- `verify` throws on transport failures (HTTP error with no
  parseable error code, non-JSON body, network error) so the order
  stays PENDING and the customer can retry via "continue payment";
  it returns FAILED only on a definitive gateway error. Code 101
  (already verified) counts as PAID.
- **Unpaid-authority verify is HTTP 401, not 200.** The sandbox
  answers verify for an authority that was never paid with
  HTTP 401 + `errors.code` -51 ("Session is not valid, session is
  not active paid try."). `postJson` throws `ZarinpalGatewayError`
  for such definitive errors, and `verify` maps that to FAILED —
  otherwise the order would stay PENDING forever. A plain
  transport failure still throws and keeps the order PENDING.
- **No `metadata.order_id`.** Zarinpal rejects order ids longer
  than 40 chars in `metadata.order_id`, and Sabzineh order ids are
  `order-<uuid>` = 42 chars (ela-coffee sends a bare 36-char uuid,
  which is why the same field works there). The order id is in
  `description` instead. Sending it broke every checkout with
  "The metadata.order id must not be greater than 40 characters."
- Unit tests (`src/lib/payments/zarinpal.test.ts`, 15 tests) mock
  `fetch` — the real sandbox is never hit from Vitest.
- Gated E2E (`tests/e2e/zarinpal-sandbox.spec.ts`) runs only with
  `E2E_ZARINPAL=1` and `PAYMENT_PROVIDER=zarinpal`, and only that
  file — the rest of the suite assumes the Mock gateway. Run it
  with `pnpm exec` (the `test:e2e -- <file>` form does NOT filter —
  pnpm's `--` swallows the file argument and the whole suite runs):

```bash
E2E_ZARINPAL=1 PAYMENT_PROVIDER=zarinpal \
  ZARINPAL_MERCHANT_ID=<test uuid> \
  pnpm --filter web exec playwright test tests/e2e/zarinpal-sandbox.spec.ts
```

- **This VM cannot load StartPay in a browser.** The egress
  proxy refuses the tunnel to `sandbox.zarinpal.com`
  (`ERR_TUNNEL_CONNECTION_FAILED`); Node `fetch` and `curl`
  reach the sandbox fine. The E2E therefore captures the
  StartPay navigation *request* URL instead of waiting for the
  page. The human click-through (captcha + test card) still has
  to happen in a normal browser or on the deployed site.
