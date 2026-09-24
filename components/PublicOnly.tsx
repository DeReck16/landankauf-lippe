"use client";

import { usePathname } from "next/navigation";

/**
 * Rendert die öffentliche Seitenhülle (Kopf, Fuß, strukturierte Daten)
 * überall außer in der Verwaltung unter /admin — dort soll die Website-
 * Navigation nicht stören. Der Kundenbereich (/kunde) behält Kopf und Fuß.
 * Tracking und WhatsApp-Knopf regelt components/TrackingOnly (auch ohne /kunde).
 */
export default function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  return <>{children}</>;
}
