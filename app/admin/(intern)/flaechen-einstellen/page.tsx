import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import FlaechenEinstellen from "./FlaechenEinstellen";

export const metadata: Metadata = { title: "Flächen einstellen" };

// Kataster-Abfragen (ALKIS/BORIS NRW) brauchen je Fläche einige Sekunden — parallel, aber mit Luft.
export const maxDuration = 60;

// Eigene bzw. telefonisch/per E-Mail angebotene Flächen direkt in die Flächenbörse stellen
// (lib/portal/eigene-flaechen.ts) — ohne Umweg über das Formular der Website.
export default async function FlaechenEinstellenPage() {
  const { email } = await requireAdmin();
  return (
    <>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/admin/dashboard#boerse" className="lfa-klein" title="Zurück zum Dashboard, Abschnitt Flächenbörse">
          ← Dashboard · Flächenbörse
        </Link>
      </p>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Flächen einstellen</h1>
          <p className="lfa-unterzeile">
            Flurstücke eingeben — Größe, Nutzung und grobe Lage kommen aus dem Kataster NRW. Jede Fläche wird ein eigenes, anonymes Angebot in der Flächenbörse (Einwilligung des Eigentümers wird dabei vermerkt).
          </p>
        </div>
      </div>
      <FlaechenEinstellen typen={FLAECHENTYPEN} standardEmail={email} />
    </>
  );
}
