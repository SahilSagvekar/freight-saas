import type { NextConfig } from "next";

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
      { source: "/((?!inquire/).*)", headers: [...baseHeaders, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/inquire/:path*", headers: [...baseHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
};

export default nextConfig;
