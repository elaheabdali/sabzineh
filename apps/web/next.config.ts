import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Security headers. Static CSP (no nonce): Next.js emits inline
 * bootstrap scripts on statically rendered pages, and inline styles
 * are used by components — a nonce cannot be attached to either.
 * Everything else is locked down: no objects, no framing, no
 * third-party sources of any kind (no Google Fonts/CDN by design).
 */
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Vendor product images arrive as data: URLs (max 4 × 1 MB) — the
  // default 1 MB server-action body limit is too small (Week 5).
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Workspace packages ship TypeScript source; Next transpiles them.
  transpilePackages: ["@sabzineh/ui", "@sabzineh/types"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
