import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { menueZahlen } from "@/lib/admin/menue";
import { testModus } from "@/lib/admin/config";
import { abmelden } from "../actions";
import HauptNav, { type NavZahlen } from "./HauptNav";

export default async function InternLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  // Zwischengespeicherte Menü-Zähler (lib/admin/menue.ts) — kein Neuberechnen des Dashboards je Seite.
  let z: NavZahlen = { aufgaben: 0, dringend: 0, aufgabenNeu: 0, neueAnfragen: 0, offeneVorschlaege: 0, neueVorschlaege: 0, neueEreignisse: 0, vorlagenOffen: 0 };
  try {
    z = await menueZahlen(email);
  } catch (err) {
    console.error("[verwaltung] Menü-Zähler nicht berechenbar", err);
  }

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
