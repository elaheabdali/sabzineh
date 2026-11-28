import { NextResponse, type NextRequest } from "next/server";
import { failPaymentByAuthority, finalizePayment } from "@/server/orders/service";
import { getDataStore } from "@/server/store";

/**
 * Redirects with a RELATIVE Location header. The request's origin
 * cannot be trusted here: `new URL(target, request.url)` absolutises
 * against whatever host the request arrived with, and in some
 * environments (the dev VM's network layer rewrites Host to
 * `localhost`) that host differs from the one the browser is on —
 * the session cookie is host-scoped, so an absolute redirect to a
 * different host drops the session and the proxy bounces the user
 * to login. A relative Location keeps the browser on its own host.
 */
function redirectRelative(request: NextRequest, target: string): NextResponse {
  const response = NextResponse.redirect(new URL(target, request.url));
  response.headers.set("Location", target);
  return response;
}

/**
 * GET /api/payments/callback?Authority=…&Status=OK|NOK
 *
 * The single payment callback for both providers. Zarinpal redirects
 * the browser here after StartPay; the mock payment page links here
 * too (Pay → Status=OK, Cancel → Status=NOK).
 *
 * The authority token is the credential: only a PENDING payment
 * transitions, so replaying the callback is a no-op. The result is
 * always read back from the order afterwards — never trusted from
 * the query string.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const authority = params.get("Authority") ?? params.get("authority") ?? "";
  const status = params.get("Status") ?? params.get("status") ?? "";
  const locale = params.get("locale") ?? "fa";
  const base = `/${locale}/account/orders`;

  if (!authority) {
    return redirectRelative(request, `${base}?payment=missing-authority`);
  }

  try {
    if (status !== "OK") {
      const order = await failPaymentByAuthority(authority);
      const target = order ? `${base}/${order.id}?payment=cancelled` : `${base}?payment=cancelled`;
      return redirectRelative(request, target);
    }
    const order = await finalizePayment(authority);
    return redirectRelative(request, `${base}/${order.id}?payment=success`);
  } catch {
    // Unknown authority (or a gateway error): send the customer to
    // their orders list instead of failing the redirect.
    const store = getDataStore();
    const payment = await store.getPaymentByAuthority(authority).catch(() => null);
    const target = payment ? `${base}/${payment.orderId}?payment=error` : `${base}?payment=error`;
    return redirectRelative(request, target);
  }
}
