import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy. This is the header-based form (no per-request nonce), because a nonce would force every page,
 * including the landing page, to render dynamically on each request.
 *
 * What it stops: loading scripts, frames, plugins or form posts from anywhere that isn't listed, rewriting <base>, and
 * being embedded by other sites. What it does not stop: inline script injection, because Next.js's own hydration scripts
 * are inline and need 'unsafe-inline' without a nonce. Escaping user input remains the defence for that.
 * Allowed outside our own domain: Cloudflare Turnstile (the CAPTCHA) and Stripe (card payment redirects).
 */
const contentSecurityPolicy = (frameAncestors: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com https://connect.stripe.com",
    `frame-ancestors ${frameAncestors}`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Camera is for scanning tickets at the dock; everything else is off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // Everything is blocked from being framed, except the inquiry form: operators embed that on their own websites.
      {
        source: "/((?!inquire/).*)",
        headers: [...baseHeaders, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: contentSecurityPolicy("'none'") }],
      },
      { source: "/inquire/:path*", headers: [...baseHeaders, { key: "Content-Security-Policy", value: contentSecurityPolicy("*") }] },
    ];
  },
};

export default nextConfig;
