import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { LEAD_STATUS, formatGroesse } from "@/lib/admin/model";
import { ROLLE_LABEL, ROLLE_TIPP, artLabel, datumZeit } from "@/lib/admin/format";
import { kundenAus, passtZurKundenSuche, type Kunde } from "@/lib/admin/kunden";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import { STUFE_INFO, type Stufe } from "@/lib/portal/model";
import { triVorgangUrl } from "@/lib/portal/tri-uebergabe";

export const metadata: Metadata = { title: "Kunden" };

/** Mehr Zeilen erst auf Wunsch — die erste Ansicht bleibt kurz. */
const ZEILEN = 40;
const IM_BLOCK = 3;

function stufeFarbe(s: Stufe): string {
  if (s === "unterschrieben") return "lfa-badge-ok";
  if (s === "widerrufen" || s === "gesperrt" || s === "gekuendigt") return "lfa-badge-rot";
  return s === "neu" ? "lfa-badge-keine" : "lfa-badge-warn";
}

function AnfrageZeile({ l }: { l: Kunde["anfragen"][number] }) {
  return (
    <li>
      <Link href={`/admin/anfrage/${l.id}`} className="lfa-link-name" title="Anfrage öffnen: alle Angaben, Kundenakte, Bearbeitung und Weitergabe">
        {l.id}
      </Link>{" "}
      <span className={`lfa-badge lfa-badge-${l.rolle}`} title={ROLLE_TIPP[l.rolle]}>
        {ROLLE_LABEL[l.rolle]}
        {l.art ? ` · ${artLabel(l.art)}` : ""}
      </span>{" "}
      <span className="lfa-klein" title={LEAD_STATUS[l.status].tipp}>
        {[l.typ, l.rolle === "keine" ? "" : formatGroesse(l.groesseWert), l.ortText, LEAD_STATUS[l.status].label].filter(Boolean).join(" · ")}
      </span>
    </li>
  );
}

export default async function KundenPage(props: PageProps<"/admin/kunden">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rolle = typeof sp.rolle === "string" && ["angebot", "gesuch", "keine"].includes(sp.rolle) ? sp.rolle : "alle";
  const alle = sp.alle === "1";

  const [{ leads }, portal, neu] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email)]);
  const kunden = kundenAus(leads, portal.kunden);
  const archiviert = leads.filter((l) => l.status === "archiv").length;

  const sichtbar = kunden.filter((k) => (rolle === "alle" || k.anfragen.some((l) => l.rolle === rolle)) && (!q || passtZurKundenSuche(k, q)));
  const angezeigt = alle ? sichtbar : sichtbar.slice(0, ZEILEN);
  const anfragenSumme = sichtbar.reduce((n, k) => n + k.anfragen.length, 0);
  const weiter = `/admin/kunden?${new URLSearchParams({ ...(q ? { q } : {}), ...(rolle !== "alle" ? { rolle } : {}), alle: "1" }).toString()}`;

  return (
    <>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Kunden</h1>
          <p className="lfa-unterzeile">Alle Personen hinter den Anfragen — mit Kontakt, ihren Flächen und dem Stand im Kundenbereich. Der Name öffnet die neueste Anfrage.</p>
        </div>
      </div>

      <form className="lfa-filter" method="get">
        <label className="lfa-filter-suche">
          Suche
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, Betrieb, E-Mail, Telefon, Ort, Flurstück, Nummer …"
            className="field-input"
            title="Sucht in Name, Betrieb, E-Mail, Telefon, Anschrift, Ort, Flurstück und Vorgangsnummern (LL-… bzw. TRI-…). Mehrere Wörter müssen alle vorkommen."
          />
        </label>
        <label>
          Anliegen
          <select name="rolle" defaultValue={rolle} className="field-select" title="Nur Personen, die mindestens eine Anfrage dieser Art haben">
            <option value="alle">Alle</option>
            <option value="angebot">Anbieter (verkaufen/verpachten)</option>
            <option value="gesuch">Suchende</option>
            <option value="keine">Auskunft / Sonstige</option>
          </select>
        </label>
        <button type="submit" className="lfa-knopf" title="Liste mit diesen Angaben neu laden">Filtern</button>
        <Link href="/admin/kunden" className="lfa-knopf lfa-knopf-leise" title="Suche und Auswahl zurücksetzen">Zurücksetzen</Link>
      </form>

      {sichtbar.length === 0 ? (
        <div className="lfa-panel lfa-leer">Keine Kunden für diese Auswahl.</div>
      ) : (
        <table className="lfa-liste">
          <thead>
            <tr>
              <th title="Name (öffnet die neueste Anfrage); Betrieb und weitere Namen zur selben E-Mail-Adresse stehen darunter">Kunde</th>
              <th title="E-Mail und Telefon starten direkt Mail bzw. Anruf; die Anschrift stammt aus den Angaben im Kundenbereich">Kontakt</th>
              <th title="Alle Anfragen dieser Person, neueste zuerst — die Nummer öffnet die Anfrage">Anfragen</th>
              <th title="Stand im Kundenbereich: nicht eingeladen → eingeladen → Link geöffnet → Angaben gemacht → unterschrieben">Konto</th>
              <th title="Wurde mindestens eine Fläche an die Verwaltung von TR Immobilien weitergegeben (von dort ggf. an KurtInvest)? Der Link öffnet den Vorgang dort.">TR Immobilien</th>
              <th title="Letzter Eingang einer Anfrage, letzte gesendete Mail oder letztes Ereignis im Kundenbereich">Letzter Kontakt</th>
            </tr>
          </thead>
          <tbody>
            {angezeigt.map((k) => {
              const neuEreignisse = k.akten.flatMap((a) => neu.kunde(a));
              const erste = k.anfragen.slice(0, IM_BLOCK);
              const weitere = k.anfragen.slice(IM_BLOCK);
              return (
                <tr key={k.key}>
                  <td data-label="Kunde" className="lfa-kontakt">
                    <Link href={`/admin/anfrage/${k.anfragen[0].id}`} className="lfa-link-name" title="Neueste Anfrage dieser Person öffnen">
                      {neuEreignisse.length > 0 && <span className="lfa-puls" title={`${neuEreignisse.length} neue Ereignisse im Kundenbereich`} />}
                      {k.name}
                    </Link>
                    {k.betrieb && <div className="lfa-klein" title="Betrieb laut Angaben im Kundenbereich">{k.betrieb}</div>}
                    {k.weitereNamen.length > 0 && (
                      <div className="lfa-klein" title="Weitere Namen zur selben E-Mail-Adresse, z. B. ein Eigentümer, für den diese Person anfragt">
                        auch: {k.weitereNamen.join(", ")}
                      </div>
                    )}
                    {neuEreignisse.length > 0 && <div className="lfa-neu-text">{neuEreignisse[0].text}</div>}
                  </td>
                  <td data-label="Kontakt" className="lfa-kontakt">
                    {k.email ? (
                      <div>
                        <a href={`mailto:${k.email}`} title="Öffnet eine neue E-Mail an diese Adresse im Mailprogramm">{k.email}</a>
                      </div>
                    ) : (
                      <div className="lfa-klein">keine E-Mail-Adresse</div>
                    )}
                    {k.telefon && (
                      <div>
                        <a href={`tel:${k.telefon.replace(/[^\d+]/g, "")}`} title="Ruft die Nummer an (auf Handy oder mit Telefon-App)">{k.telefon}</a>
                      </div>
                    )}
                    {k.anschrift && <div className="lfa-klein" title="Anschrift laut Angaben im Kundenbereich">{k.anschrift}</div>}
                  </td>
                  <td data-label="Anfragen">
                    <ul className="lfa-protokoll" style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                      {erste.map((l) => (
                        <AnfrageZeile key={l.id} l={l} />
                      ))}
                    </ul>
                    {weitere.length > 0 && (
                      <details>
                        <summary className="lfa-klein" title="Die übrigen Anfragen dieser Person aufklappen">+ {weitere.length} weitere</summary>
                        <ul className="lfa-protokoll" style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                          {weitere.map((l) => (
                            <AnfrageZeile key={l.id} l={l} />
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td data-label="Konto">
                    <span className={`lfa-badge ${stufeFarbe(k.stufe)}`} title={STUFE_INFO[k.stufe].tipp}>
                      {STUFE_INFO[k.stufe].label}
                    </span>
                  </td>
                  <td data-label="TR Immobilien">
                    {k.triIds.length > 0 ? (
                      k.triIds.map((id) => (
                        <div key={id}>
                          <a href={triVorgangUrl(id)} target="_blank" rel="noreferrer" className="lfa-badge lfa-badge-ok" title="Weitergegeben an die Verwaltung von TR Immobilien — Vorgang dort öffnen (Anmeldung nötig)">
                            {id}
                          </a>
                        </div>
                      ))
                    ) : (
                      <span className="lfa-klein" title="Noch nichts weitergegeben. Das geht in der Anfrage, Kasten „An TR Immobilien weitergeben“.">—</span>
                    )}
                  </td>
                  <td data-label="Letzter Kontakt">{k.letzte ? datumZeit(k.letzte) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} title="Summen der gerade angezeigten Auswahl (alle Treffer, nicht nur die sichtbaren Zeilen)">
                <strong>
                  Summe: {sichtbar.length} {sichtbar.length === 1 ? "Kunde" : "Kunden"} · {anfragenSumme} Anfragen · {sichtbar.filter((k) => k.stufe === "unterschrieben").length} mit unterschriebener Vereinbarung ·{" "}
                  {sichtbar.filter((k) => k.triIds.length > 0).length} an TR Immobilien weitergegeben
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      {sichtbar.length > angezeigt.length && (
        <p style={{ marginTop: "0.75rem" }}>
          <Link href={weiter} className="lfa-knopf lfa-knopf-leise" title={`Alle ${sichtbar.length} Kunden dieser Auswahl untereinander anzeigen`}>
            Alle {sichtbar.length} anzeigen
          </Link>
        </p>
      )}
      <p className="lfa-klein" style={{ marginTop: "0.75rem" }} title="Archivierte Anfragen sind Tests, Spam, Dubletten oder Löschwünsche; eigene Flächen der Geschäftsführung gehören nicht zu den Kunden.">
        Nicht enthalten: {archiviert} archivierte Anfragen (Tests, Spam, Dubletten, Löschwünsche) und die eigenen Flächen der Geschäftsführung.
      </p>
    </>
  );
}
