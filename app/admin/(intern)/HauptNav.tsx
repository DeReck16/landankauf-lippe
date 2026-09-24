"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavZahlen = {
  /** Vorgänge, bei denen die Verwaltung am Zug ist (Dashboard „Jetzt dran“). */
  jetztDran: number;
  /** Davon mit Neuem seit dem letzten Besuch (nur dann pulsiert der Zähler). */
  jetztNeu: number;
  neueAnfragen: number;
  offeneVorschlaege: number;
  neueVorschlaege: number;
  neueEreignisse: number;
  vorlagenOffen: number;
};

function Zaehler({ n, puls, tipp }: { n: number; puls: boolean; tipp: string }) {
  if (n <= 0) return null;
  return (
    <span className={`lfa-zaehler ${puls ? "lfa-puls-ring" : ""}`} title={tipp}>
      {n}
    </span>
  );
}

export default function HauptNav({ z }: { z: NavZahlen }) {
  const pathname = usePathname();
  const dashboardAktiv = pathname.startsWith("/admin/dashboard");
  const anfragenAktiv = pathname === "/admin" || pathname.startsWith("/admin/anfrage/");
  const matchingAktiv = pathname.startsWith("/admin/matching");
  const vorgaengeAktiv = pathname.startsWith("/admin/vorgaenge") || pathname.startsWith("/admin/vorgang/");
  const vorlagenAktiv = pathname.startsWith("/admin/vorlagen");
  return (
    <nav className="lfa-hauptnav" aria-label="Verwaltung">
      <Link
        href="/admin/dashboard"
        aria-current={dashboardAktiv ? "page" : undefined}
        title="Alles, was jetzt zu tun ist — je Vorgang ein Knopf: einladen, anonym anfragen, freigeben, Verträge, Erinnerungen, Provision"
      >
        Dashboard
        <Zaehler
          n={z.jetztDran}
          puls={z.jetztNeu > 0}
          tipp={`${z.jetztDran} Vorgänge, bei denen Sie jetzt dran sind${z.jetztNeu ? `, davon ${z.jetztNeu} mit Neuem seit Ihrem letzten Besuch` : ""}`}
        />
      </Link>
      <Link href="/admin" aria-current={anfragenAktiv ? "page" : undefined} title="Alle Anfragen aus dem Formular auf lippeforst.de, neueste zuerst">
        Anfragen
        <Zaehler n={z.neueAnfragen} puls tipp={`${z.neueAnfragen} neue Anfragen, noch nicht geöffnet`} />
      </Link>
      <Link
        href="/admin/matching"
        aria-current={matchingAktiv ? "page" : undefined}
        title="Passende Paare aus Flächen-Angeboten und Gesuchen — anonym anfragen, Kontakt erst nach Unterschrift und Zustimmung beider Seiten"
      >
        Matching
        <Zaehler
          n={z.offeneVorschlaege}
          puls={z.neueVorschlaege > 0}
          tipp={`${z.offeneVorschlaege} Vorschläge noch nicht bearbeitet${z.neueVorschlaege ? `, davon ${z.neueVorschlaege} noch nie angesehen` : ""}`}
        />
      </Link>
      <Link
        href="/admin/vorgaenge"
        aria-current={vorgaengeAktiv ? "page" : undefined}
        title="Onboarding, Freigaben, Verträge, Provisionen und Gutscheine — mit allen neuen Kundenereignissen"
      >
        Vorgänge
        <Zaehler n={z.neueEreignisse} puls tipp={`${z.neueEreignisse} Kundenakten oder Vorgänge mit neuen Ereignissen`} />
      </Link>
      <Link
        href="/admin/vorlagen"
        aria-current={vorlagenAktiv ? "page" : undefined}
        title="Vertragsvorlagen prüfen und freigeben, Provisionskonditionen, Bewertungsbitte und Treue-Gutschein einstellen"
      >
        Vorlagen
        {z.vorlagenOffen > 0 && (
          <span className="lfa-zaehler lfa-zaehler-warn" title={`${z.vorlagenOffen} Vorlagen noch nicht freigegeben — ohne Freigabe kann niemand unterschreiben`}>
            !
          </span>
        )}
      </Link>
    </nav>
  );
}
