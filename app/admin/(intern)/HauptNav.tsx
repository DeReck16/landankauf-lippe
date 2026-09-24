"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HauptNav({ offeneVorschlaege }: { offeneVorschlaege: number }) {
  const pathname = usePathname();
  const anfragenAktiv = pathname === "/admin" || pathname.startsWith("/admin/anfrage/");
  const matchingAktiv = pathname.startsWith("/admin/matching");
  return (
    <nav className="lfa-hauptnav" aria-label="Verwaltung">
      <Link
        href="/admin"
        aria-current={anfragenAktiv ? "page" : undefined}
        title="Alle Anfragen aus dem Formular auf lippeforst.de, neueste zuerst"
      >
        Anfragen
      </Link>
      <Link
        href="/admin/matching"
        aria-current={matchingAktiv ? "page" : undefined}
        title="Passende Paare aus Flächen-Angeboten und Gesuchen — anonym anfragen, Kontakt erst nach Zustimmung beider Seiten"
      >
        Matching
        {offeneVorschlaege > 0 && (
          <span className="lfa-zaehler" title={`${offeneVorschlaege} neue Vorschläge, noch nicht angesehen`}>
            {offeneVorschlaege}
          </span>
        )}
      </Link>
    </nav>
  );
}
