"use client";

import { usePathname } from "next/navigation";

/**
 * Rendert die öffentliche Seitenhülle (Kopf, Fuß, WhatsApp, Analytics, Ads)
 * überall außer in der Verwaltung unter /admin — dort soll weder Tracking
 * laufen noch die Website-Navigation stören.
 */
export default function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  return <>{children}</>;
}
