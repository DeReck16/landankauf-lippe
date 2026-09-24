import type { Metadata } from "next";
import Link from "next/link";
import { verifyLoginToken } from "@/lib/admin/token";
import { anmeldungBestaetigen } from "../../actions";

export const metadata: Metadata = { title: "Anmeldung bestätigen" };

// Der Link aus der Mail meldet NICHT sofort an: Mail-Scanner (Outlook, t-online)
// rufen Links vorab auf und würden den Einmal-Link sonst verbrauchen. Erst der
// Klick auf den Knopf löst die Anmeldung aus.
export default async function BestaetigenPage(props: PageProps<"/admin/anmelden/bestaetigen">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const weiter = typeof sp.weiter === "string" ? sp.weiter : "";
  const gueltig = verifyLoginToken(t);

  return (
    <div className="lfa-anmeldung">
      <p className="lfa-marke" style={{ marginBottom: "1rem" }}>
        Lippe Forst <small>Verwaltung</small>
      </p>
      <div className="lfa-panel">
        {gueltig ? (
          <form action={anmeldungBestaetigen}>
            <h1 className="lfa-h2">Anmeldung bestätigen</h1>
            <p className="lfa-unterzeile" style={{ marginBottom: "1.2rem" }}>
              Angemeldet wird <strong>{gueltig.e}</strong>. Die Anmeldung gilt 30 Tage auf diesem Gerät.
            </p>
            <input type="hidden" name="t" value={t} />
            {weiter && <input type="hidden" name="weiter" value={weiter} />}
            <button
              type="submit"
              className="lfa-knopf"
              style={{ width: "100%" }}
              title="Meldet dieses Gerät für 30 Tage an. Der Link aus der Mail ist danach verbraucht."
            >
              Jetzt anmelden
            </button>
          </form>
        ) : (
          <>
            <h1 className="lfa-h2">Link ungültig</h1>
            <p className="lfa-hinweis lfa-hinweis-fehler">
              Der Anmeldelink ist abgelaufen oder unvollständig. Links gelten 20 Minuten.
            </p>
            <Link href="/admin/anmelden" className="lfa-knopf" title="Zur Anmeldeseite, dort einen neuen Link anfordern">
              Neuen Link anfordern
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
