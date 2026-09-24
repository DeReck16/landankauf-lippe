"use client";

import { usePathname } from "next/navigation";

/**
 * Rendert Tracking und Kontakt-Widgets (GA4, Google-Ads-Tags und -Conversions,
 * WhatsApp-Knopf) nur auf der öffentlichen Website — nicht in der Verwaltung
 * (/admin) und nicht im Kundenbereich (/kunde). Kopf und Fuß der Website regelt
 * weiterhin components/PublicOnly.
 */
export default function TrackingOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  if (pathname === "/kunde" || pathname?.startsWith("/kunde/")) return null;
  return <>{children}</>;
}
