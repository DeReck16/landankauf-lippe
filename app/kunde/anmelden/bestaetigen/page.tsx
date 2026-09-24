import type { Metadata } from "next";
import Link from "next/link";
import { pruefeLogin, pruefeZugang } from "@/lib/portal/token";
import { anmeldungBestaetigenAktion } from "../../actions";

export const metadata: Metadata = { title: "Anmeldung bestätigen" };

// Wie bei der Verwaltung: Der Link meldet erst per Knopf an, damit Mail-Scanner
// den Einmal-Link nicht vorab verbrauchen.
export default async function KundeBestaetigenPage(props: PageProps<"/kunde/anmelden/bestaetigen">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const z = typeof sp.z === "string" ? sp.z : "";
  const v = typeof sp.v === "string" && /^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/.test(sp.v) ? sp.v : "";
  const gueltig = t ? pruefeLogin(t) : z ? pruefeZugang(z) : null;
  return (
    <div className="lfk-seite" style={{ maxWidth: "30rem" }}>
      <section className="lfk-karte">
        {gueltig ? (
          <form action={anmeldungBestaetigenAktion}>
            <h1 className="lfk-h1">Anmeldung bestätigen</h1>
            <p className="lfk-unterzeile">Mit dem Knopf öffnen Sie Ihren Kundenbereich auf diesem Gerät. Die Anmeldung gilt 14 Tage; der Link ist danach verbraucht.</p>
            {t && <input type="hidden" name="t" value={t} />}
            {z && <input type="hidden" name="z" value={z} />}
            {z && v && <input type="hidden" name="v" value={v} />}
            <button type="submit" className="btn-primary" title="Meldet dieses Gerät für 14 Tage im Kundenbereich an">
              Jetzt anmelden
            </button>
          </form>
        ) : (
          <>
            <h1 className="lfk-h1">Link ungültig</h1>
            <p className="lfk-hinweis lfk-hinweis-fehler">Der Link ist abgelaufen oder unvollständig.</p>
            <Link href="/kunde/anmelden" className="btn-primary" title="Neuen Anmeldelink anfordern">
              Neuen Link anfordern
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
