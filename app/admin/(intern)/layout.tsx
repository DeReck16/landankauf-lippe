import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten } from "@/lib/admin/matching";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import { VORLAGEN_REIHENFOLGE, istFreigegeben } from "@/lib/vertraege/vorlagen";
import { testModus } from "@/lib/admin/config";
import { ladeDashboard } from "@/lib/portal/dashboard";
import { abmelden } from "../actions";
import HauptNav from "./HauptNav";

export default async function InternLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  const [{ leads, zustand }, portal, neu] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email)]);
  const kandidaten = findeKandidaten(leads, zustand).kandidaten.filter((k) => !k.meta);
  // Zähler fürs Dashboard (dieselbe Berechnung wie die Seite — pro Aufruf zwischengespeichert).
  let jetztDran = 0;
  let jetztNeu = 0;
  try {
    const dash = await ladeDashboard(email);
    jetztDran = dash.jetzt.length;
    jetztNeu = dash.jetzt.filter((x) => x.neu > 0).length;
  } catch (err) {
    console.error("[verwaltung] Dashboard-Zähler nicht berechenbar", err);
  }
  const z = {
    jetztDran,
    jetztNeu,
    neueAnfragen: leads.filter((l) => l.status !== "archiv" && neu.anfrage(l)).length,
    offeneVorschlaege: kandidaten.length,
    neueVorschlaege: kandidaten.filter((k) => neu.vorschlag(k.key)).length,
    neueEreignisse:
      [...portal.kunden.values()].filter((k) => neu.kunde(k).length > 0).length +
      [...portal.vorgaenge.values()].filter((v) => neu.vorgang(v).length > 0).length,
    vorlagenOffen: VORLAGEN_REIHENFOLGE.filter((id) => !istFreigegeben(portal.einstellungen, id)).length,
  };

  return (
    <>
      <header className="lfa-kopf">
        <div className="lfa-kopf-zeile">
          <Link href="/admin/dashboard" className="lfa-marke" title="Zum Dashboard: alles, was jetzt zu tun ist">
            Lippe Forst <small>Verwaltung</small>
          </Link>
          <HauptNav z={z} />
          <form action={abmelden}>
            <button
              type="submit"
              className="lfa-knopf lfa-knopf-leise lfa-knopf-klein"
              title={`Meldet ${email} auf diesem Gerät ab. Für die nächste Anmeldung ist ein neuer Link per E-Mail nötig.`}
            >
              Abmelden
            </button>
          </form>
        </div>
      </header>
      {testModus() && (
        <div className="lfa-testmodus" title="Lokal bzw. mit Daten-Präfix: Es werden keine E-Mails verschickt, sie stehen nur im Server-Log.">
          Testmodus — E-Mails werden nicht verschickt, nur protokolliert.
        </div>
      )}
      <div className="lfa-seite">{children}</div>
      <footer className="lfa-fuss">
        Angemeldet als {email} · Daten im privaten Speicher (Vercel, Frankfurt) · Ortsdaten © OpenStreetMap-Mitwirkende
      </footer>
    </>
  );
}
