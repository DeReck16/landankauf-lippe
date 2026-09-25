import type { Metadata } from "next";
import Link from "next/link";
import { ladeKundenSitzung } from "@/lib/portal/sitzung";
import { abmeldenAktion } from "./actions";
import "../vertrag.css";
import "./kunde.css";

// Kundenbereich: Kopf und Fuß der Website bleiben (components/PublicOnly),
// Tracking (GA4, Google Ads) läuft hier nicht (components/TrackingOnly).

export const metadata: Metadata = {
  title: { default: "Kundenbereich", template: "%s · Kundenbereich Lippe Forst" },
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
  // Links mit persönlichem Token (Einladung, Antwort-Link) nie als Referrer weitergeben —
  // sonst stünde die volle Adresse auf der nächsten Website-Seite in GA (page_referrer).
  referrer: "origin",
};

export default async function KundeLayout({ children }: { children: React.ReactNode }) {
  const sitzung = await ladeKundenSitzung();
  return (
    <div className="lfk">
      <div className="lfk-seite lfk-breit">
        <div className="lfk-leiste">
          <Link href="/kunde" className="lfk-leiste-titel" title="Zur Übersicht Ihres Kundenbereichs">
            Lippe Forst <small>Kundenbereich</small>
          </Link>
          <nav className="lfk-leiste-links" aria-label="Kundenbereich">
            {sitzung ? (
              <>
                <Link href="/kunde" title="Übersicht: Vertrag, Vorschläge, Kontakte und Dokumente">Übersicht</Link>
                <Link href="/kunde/widerruf" title="Widerrufsfunktion: einen Vertrag innerhalb der Widerrufsfrist online widerrufen">Vertrag widerrufen</Link>
                <Link href="/kunde/kuendigung" title="Einen Vertrag mit Lippe Forst online kündigen">Verträge hier kündigen</Link>
                <form action={abmeldenAktion}>
                  <button type="submit" className="lfk-link-knopf" title={`Meldet ${sitzung.email} auf diesem Gerät ab`}>
                    Abmelden
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/kunde/anmelden" title="Anmeldelink an Ihre E-Mail-Adresse schicken lassen">Anmelden</Link>
                <Link href="/kunde/widerruf" title="Widerrufsfunktion: einen Vertrag innerhalb der Widerrufsfrist online widerrufen">Vertrag widerrufen</Link>
                <Link href="/kunde/kuendigung" title="Einen Vertrag mit Lippe Forst online kündigen">Verträge hier kündigen</Link>
              </>
            )}
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
