import type { NextConfig } from "next";

// Security-Header für alle Routen — Vercel liefert HSTS bereits selbst.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 Tage
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Verwaltung: nie indexieren (Seiten sind dynamisch, Next setzt no-store selbst) und nie einbetten
      // (überschreibt SAMEORIGIN; die CSP mit frame-ancestors 'none' setzt proxy.ts).
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      // Kundenbereich: ebenfalls nie indexieren (persönliche Links, Verträge) und nie einbetten.
      {
        source: "/kunde/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/kunde",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
