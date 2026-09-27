import type { Metadata } from "next";
import { ladeKunde } from "@/lib/portal/speicher";
import { datumZeitDe } from "@/lib/portal/texte";
import { pruefeErklaerung } from "@/lib/portal/token";
import { FIRMA } from "@/lib/vertraege/firma";
import { erklaerungZurueckweisenAktion } from "../actions";

export const metadata: Metadata = { title: "Erklärung prüfen" };

// „Das war nicht ich“: Link aus der Bestätigung eines Widerrufs bzw. einer Kündigung, die ohne
// Anmeldung abgegeben wurde. Öffnen allein ändert nichts (Mail-Scanner) — erst der Knopf.
export default async function ErklaerungPage(props: PageProps<"/kunde/erklaerung">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const token = pruefeErklaerung(t);
  const k = token ? await ladeKunde(token.k) : null;
  const was = token?.a === "widerruf" ? "Widerruf" : "Kündigung";
  const zurueckgewiesen = sp.ok === "1" || Boolean(k?.verworfeneErklaerungen?.some((e) => e.art === token?.a && e.am === token?.am));
  const offen = Boolean(token && k?.[token.a]?.am === token.am && k?.[token.a]?.ungeprueft);
  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">{token ? `${was} vom ${datumZeitDe(token.am)}` : "Link nicht gültig"}</h1>
        {!token || !k ? (
          <p className="lfk-hinweis lfk-hinweis-fehler">
            Der Link ist abgelaufen oder unvollständig. Bitte schreiben Sie uns an <a href={`mailto:${FIRMA.email}`} title="Neue E-Mail an Lippe Forst">{FIRMA.email}</a>.
          </p>
        ) : zurueckgewiesen ? (
          <p className="lfk-hinweis lfk-hinweis-ok" role="status">
            Danke — die Erklärung ist zurückgewiesen. Ihr Vertrag mit Lippe Forst gilt unverändert weiter. Wir sehen uns den Vorgang an.
          </p>
        ) : offen ? (
          <>
            <p className="lfk-unterzeile">
              Über lippeforst.de wurde ohne Anmeldung ein {was} Ihres Vertrags (Vorgang {k.id}) abgegeben. Haben Sie das selbst getan, müssen Sie nichts weiter tun. Stammt die Erklärung nicht von Ihnen, weisen Sie sie hier zurück — dann gilt Ihr Vertrag unverändert weiter.
            </p>
            {sp.fehler === "stand" && <p className="lfk-hinweis lfk-hinweis-fehler">Das ging gerade nicht — bitte schreiben Sie uns kurz per E-Mail.</p>}
            <form action={erklaerungZurueckweisenAktion}>
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="btn-primary" title={`Weist den ${was} zurück — Ihr Vertrag gilt weiter, Lippe Forst wird informiert`}>
                Das war nicht ich — {was} zurückweisen
              </button>
            </form>
          </>
        ) : (
          <p className="lfk-hinweis">Zu dieser Erklärung ist nichts mehr zu tun. Bei Fragen schreiben Sie uns an {FIRMA.email}.</p>
        )}
      </section>
    </div>
  );
}
