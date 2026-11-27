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
