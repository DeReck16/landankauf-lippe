import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { datumZeit } from "@/lib/admin/format";
import { RECHTE, zugaengeListe, type ZugangInfo } from "@/lib/api/zugang";
import { site } from "@/lib/site";
import { zugangSperrenAktion } from "../../api-zugang-actions";
import ZugangFormular from "../../ZugangFormular";
import BestaetigenKnopf from "../BestaetigenKnopf";

export const metadata: Metadata = { title: "API-Zugänge" };

function stand(z: ZugangInfo): { label: string; klasse: string } {
  if (z.gesperrtAm) return { label: "Gesperrt", klasse: "lfa-badge-rot" };
  if (!z.aktiv) return { label: "Abgelaufen", klasse: "lfa-badge-keine" };
  return { label: "Aktiv", klasse: "lfa-badge-ok" };
}

export default async function ApiZugaengePage() {
  await requireAdmin();
  const zugaenge = await zugaengeListe();
  const rechte = Object.entries(RECHTE).map(([schluessel, text]) => ({ schluessel, text }));

  return (
    <>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">API-Zugänge</h1>
          <p className="lfa-unterzeile">
            Eigene Schlüssel für Skripte und Claude, um das Board ohne Anmeldung per Programm zu lesen und sicher zu ergänzen. Jeder Zugang hat feste
            Rechte und ein Ablaufdatum und lässt sich sofort sperren.
          </p>
        </div>
      </div>

      <section className="lfa-panel" id="neu">
        <h2 className="lfa-h2">Neuen Zugang anlegen</h2>
        <ZugangFormular rechte={rechte} basisUrl={site.url} />
      </section>

      <section className="lfa-panel" id="liste">
        <h2 className="lfa-h2">Vorhandene Zugänge</h2>
        {zugaenge.length === 0 ? (
          <p className="lfa-klein">Noch keiner angelegt.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="lfa-liste">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rechte</th>
                  <th title="Wann angelegt und von wem">Angelegt</th>
                  <th>Gültig bis</th>
                  <th title="Letzter Aufruf (wird höchstens alle 10 Minuten aktualisiert) und Zahl der vermerkten Nutzungen">Zuletzt genutzt</th>
                  <th>Stand</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {zugaenge.map((z) => {
                  const s = stand(z);
                  return (
                    <tr key={z.id}>
                      <td title={`Kennung ${z.id}`}>{z.name}</td>
                      <td className="lfa-klein">{z.rechte.map((r) => <div key={r} title={RECHTE[r]}><code>{r}</code></div>)}</td>
                      <td className="lfa-klein">{datumZeit(z.erstelltAm)}<br />{z.erstelltVon}</td>
                      <td className="lfa-klein">{datumZeit(z.laeuftAb)}</td>
                      <td className="lfa-klein">{z.zuletztGenutzt ? `${datumZeit(z.zuletztGenutzt)} (${z.nutzungen}×)` : "noch nie"}</td>
                      <td><span className={`lfa-badge ${s.klasse}`}>{s.label}</span>{z.gesperrtAm ? <div className="lfa-klein">{datumZeit(z.gesperrtAm)}<br />{z.gesperrtVon}</div> : null}</td>
                      <td>
                        {z.aktiv && (
                          <form action={zugangSperrenAktion}>
                            <input type="hidden" name="id" value={z.id} />
                            <BestaetigenKnopf className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" frage={`Zugang „${z.name}“ sperren?`} tipp="Der Schlüssel funktioniert sofort nicht mehr. Es geht keine E-Mail raus; ein gesperrter Zugang lässt sich nicht wieder aktivieren.">
                              Sperren
                            </BestaetigenKnopf>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="lfa-panel" id="nutzung">
        <h2 className="lfa-h2">So wird der Zugang benutzt</h2>
        <p className="lfa-klein" style={{ marginBottom: "0.5rem" }}>
          Schlüssel im Kopf mitschicken: <code>Authorization: Bearer lfk_…</code>. Prüfen, ob der Zugang gilt: <code>GET {site.url}/api/verwaltung/ich</code>.
        </p>
        <ul className="lfa-verlauf">
          <li><code>GET /api/verwaltung/board</code> — Anfragen und Paare, ohne Namen, Adressen und Telefonnummern (<code>?status=alle</code>, <code>?paare=alle</code>, <code>?anfrage=LL-…</code>)</li>
          <li><code>POST /api/verwaltung/board</code> — <code>{`{"aktion":"notiz","anfrage":"LL-…","text":"…"}`}</code>, <code>{`{"aktion":"status","anfrage":"LL-…","status":"in_arbeit"}`}</code>, <code>{`{"aktion":"paar","angebot":"LL-…","gesuch":"LL-…","status":"vorgemerkt"}`}</code></li>
        </ul>
        <p className="lfa-klein" style={{ marginTop: "0.6rem" }}>
          <strong>Nie per API:</strong> E-Mails senden, einladen, Zustimmungen und Freigabe von Kontakten, Börse veröffentlichen, Verträge, Einstellungen, Löschen. Das bleibt
          bei der Anmeldung in der Verwaltung. Jede Änderung steht mit „API: Name“ im Verlauf der Anfrage.
        </p>
      </section>
    </>
  );
}
