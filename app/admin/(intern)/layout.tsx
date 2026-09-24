import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten } from "@/lib/admin/matching";
import { abmelden } from "../actions";
import HauptNav from "./HauptNav";

export default async function InternLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  const { leads, zustand } = await ladeVerwaltung();
  const offeneVorschlaege = findeKandidaten(leads, zustand).kandidaten.filter((k) => !k.meta).length;

  return (
    <>
      <header className="lfa-kopf">
        <div className="lfa-kopf-zeile">
          <Link href="/admin" className="lfa-marke" title="Zur Übersicht aller Anfragen">
            Lippe Forst <small>Verwaltung</small>
          </Link>
          <HauptNav offeneVorschlaege={offeneVorschlaege} />
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
      <div className="lfa-seite">{children}</div>
      <footer className="lfa-fuss">
        Angemeldet als {email} · Daten im privaten Speicher (Vercel, Frankfurt) · Ortsdaten © OpenStreetMap-Mitwirkende
      </footer>
    </>
  );
}
