import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import VertragsText from "@/components/vertrag/VertragsText";
import { erklaerungenKaufabsicht, erklaerungenPachtvertrag } from "@/lib/portal/erklaerungen";
import * as M from "@/lib/portal/model";
import { kundenUebersicht } from "@/lib/portal/sicht";
import { requireKundeId } from "@/lib/portal/sitzung";
import { datumDe, datumZeitDe, tagDe } from "@/lib/portal/texte";
import { gutscheinBedingungen, kaufDokument, ladeVorgangKontext, pachtDokument } from "@/lib/portal/vorgang";
import { ablehnenAktion, kaufBestaetigenAktion, meldungAktion, pachtUnterschreibenAktion, zustimmenAktion } from "../../actions";
import DankeDialog from "../../DankeDialog";
import UnterschriftFormular from "../../UnterschriftFormular";

export const metadata: Metadata = { title: "Vorschlag" };

function groesse(b: number): string {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default async function KundeVorgangPage(props: PageProps<"/kunde/vorgang/[key]">) {
  const sp = await props.searchParams;
  const { key: roh } = await props.params;
  const key = decodeURIComponent(roh);
  const id = typeof sp.k === "string" ? sp.k : "";
  const { kunde } = await requireKundeId(id);
  const { liste, bewertungsUrl } = await kundenUebersicht([kunde], key);
  const v = liste[0]?.vorgaenge[0];
  if (!v) redirect("/kunde");
  const m = typeof sp.m === "string" ? sp.m.slice(0, 400) : "";
  const anbieter = kunde.rolle === "anbieter";
  // Deklination: „der Eigentümer / des Eigentümers“, aber „der Interessent / des Interessenten“.
  const gegen = v.gegenueberRolle === "anbieter"
    ? { nom: "Eigentümer", gen: "Eigentümers", dat: "Eigentümer", akk: "Eigentümer" }
    : { nom: "Interessent", gen: "Interessenten", dat: "Interessenten", akk: "Interessenten" };
  const unterschrieben = Boolean(kunde.vertrag) && !kunde.widerruf;
  const beendet = Boolean(kunde.widerruf || kunde.kuendigung);

  // Vertragstexte nur nach der Freigabe laden (sie enthalten Namen und Anschriften).
  const ctx = v.freigegeben && (v.pacht || v.kauf) ? await ladeVorgangKontext(key) : null;
  const pv = ctx?.vorgang?.pachtvertrag;
  const kauf = ctx?.vorgang?.kauf;
  // Transparenz für den Pächter: Mit seiner Unterschrift wird die Provision aus dem Nachweisvertrag fällig.
  const konditionen = kunde.vertrag?.konditionen ?? null;
  const pachtProvision = (() => {
    if (anbieter || !pv || !konditionen) return null;
    const p = M.provisionBerechnen("pacht", M.massgeblicheJahrespacht(pv.daten), konditionen);
    if (p.brutto == null) return null;
    return `${M.euro(p.brutto)} einschließlich ${M.zahlDe(konditionen.ustProzent)} % USt (${M.euro(p.netto)} netto) — wird nach Ihrem Nachweisvertrag mit Abschluss dieses Pachtvertrags fällig`;
  })();

  return (
    <>
      {v.danke && bewertungsUrl && <DankeDialog kundeId={kunde.id} vorgang={key} url={bewertungsUrl} art={v.art} />}
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/kunde" className="lfk-klein" title="Zurück zur Übersicht">← Übersicht</Link>
      </p>
      {m && <p className={`lfk-hinweis ${sp.mt === "fehler" ? "lfk-hinweis-fehler" : "lfk-hinweis-ok"}`} role="status">{m}</p>}

      <section className="lfk-karte">
        <h1 className="lfk-h1">{v.freigegeben && v.kontakt ? `Ihr Kontakt: ${v.kontakt.name}` : anbieter ? "Ein Interessent für Ihre Fläche" : "Eine passende Fläche"}</h1>
        <dl className="lfk-daten" style={{ marginTop: "0.6rem" }}>
          <dt>{anbieter ? "Gesucht wird" : "Angeboten wird"}</dt>
          <dd>{v.anonym.typ}, {v.anonym.groesse}</dd>
          <dt>Lage</dt>
          <dd>Raum {v.anonym.lage}</dd>
          <dt>Art</dt>
          <dd>{v.anonym.art}</dd>
        </dl>

        {!unterschrieben && !beendet && (
          <p className="lfk-hinweis" style={{ marginTop: "1rem", marginBottom: 0 }}>
            Bitte {anbieter ? "bestätigen Sie zuerst die kostenlose Vereinbarung" : "unterschreiben Sie zuerst den Nachweisvertrag"} — erst dann dürfen wir Kontaktdaten weitergeben.{" "}
            <Link href={kunde.stammdaten ? `/kunde/vertrag?k=${kunde.id}` : `/kunde/angaben?k=${kunde.id}`} style={{ textDecoration: "underline" }} title="Weiter zum Vertrag">
              Jetzt erledigen
            </Link>
          </p>
        )}

        {!v.freigegeben && !beendet && (
          <div style={{ marginTop: "1rem" }}>
            {v.meineZustimmung ? (
              <p className="lfk-hinweis lfk-hinweis-ok" style={{ marginBottom: 0 }}>
                Sie haben dem Kontakt am {datumDe(v.meineZustimmung)} zugestimmt.{" "}
                {!v.andereZustimmung
                  ? `Wir warten noch auf die Rückmeldung des ${gegen.gen}.`
                  : v.freigabe?.moeglich
                    ? `Der ${gegen.nom} ist ebenfalls einverstanden — wir geben die Kontaktdaten in Kürze frei.`
                    : v.freigabe?.eigeneFristBis
                      ? `Der ${gegen.nom} ist ebenfalls einverstanden. Die Kontaktdaten geben wir nach Ablauf Ihrer Widerrufsfrist frei (ab ${v.freigabe.eigeneFristBis}) — oder schon früher, wenn Sie das in Ihrer Übersicht ausdrücklich wünschen.`
                      : `Der ${gegen.nom} ist ebenfalls einverstanden. Die Kontaktdaten geben wir frei, sobald alle Voraussetzungen erfüllt sind — wir melden uns dann per E-Mail.`}
              </p>
            ) : v.abgelehnt ? (
              <p className="lfk-hinweis" style={{ marginBottom: 0 }}>Sie haben „kein Interesse“ gemeldet. Falls Sie es sich anders überlegen, stimmen Sie einfach unten zu.</p>
            ) : (
              <p className="lfk-klein" style={{ marginBottom: "0.6rem" }}>
                Möchten Sie mit dem {gegen.dat} in Kontakt kommen? Namen und Kontaktdaten geben wir erst frei, wenn beide Seiten zugestimmt haben.
              </p>
            )}
            {!v.meineZustimmung && (
              <div className="lfk-knopfreihe" style={{ marginTop: "0.6rem" }}>
                <form action={zustimmenAktion}>
                  <input type="hidden" name="k" value={kunde.id} />
                  <input type="hidden" name="key" value={key} />
                  <button type="submit" className="btn-primary" title={`Sie stimmen zu, dass Lippe Forst Ihre Kontaktdaten an diesen ${gegen.akk} weitergibt, sobald auch er zugestimmt hat`}>
                    Ja, Kontakt herstellen
                  </button>
                </form>
                {!v.abgelehnt && (
                  <details>
                    <summary className="btn-secondary lfk-knopf-klein" style={{ listStyle: "none" }} title="Dieser Vorschlag passt nicht — wir stellen ihn Ihnen nicht weiter vor">
                      Kein Interesse
                    </summary>
                    <form action={ablehnenAktion} className="lfk-form" style={{ marginTop: "0.6rem" }}>
                      <input type="hidden" name="k" value={kunde.id} />
                      <input type="hidden" name="key" value={key} />
                      <label>
                        <span className="field-label">Grund (freiwillig)</span>
                        <input name="grund" className="field-input" title="Hilft uns, bessere Vorschläge zu machen" />
                      </label>
                      <button type="submit" className="btn-secondary lfk-knopf-klein" title="Meldet „kein Interesse“ an Lippe Forst">
                        Absenden
                      </button>
                    </form>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {v.freigegeben && v.kontakt && (
        <section className="lfk-karte lfk-karte-hervor">
          <h2 className="lfk-h2">Kontaktdaten des {gegen.gen}</h2>
          <p className="lfk-klein" style={{ marginBottom: "0.6rem" }}>Freigegeben am {datumDe(v.freigabeAm)}. Bitte nehmen Sie direkt Kontakt auf und behandeln Sie die Daten vertraulich.</p>
          <dl className="lfk-daten">
            <dt>Name</dt>
            <dd>{v.kontakt.name}{v.kontakt.betrieb ? ` · ${v.kontakt.betrieb}` : ""}</dd>
            {v.kontakt.anschrift && (
              <>
                <dt>Anschrift</dt>
                <dd>{v.kontakt.anschrift}</dd>
              </>
            )}
            {v.kontakt.telefon && (
              <>
                <dt>Telefon</dt>
                <dd>
                  <a href={`tel:${v.kontakt.telefon.replace(/[^\d+]/g, "")}`} title="Nummer anrufen" style={{ textDecoration: "underline" }}>{v.kontakt.telefon}</a>
                </dd>
              </>
            )}
            <dt>E-Mail</dt>
            <dd>
              <a href={`mailto:${v.kontakt.email}`} title="Neue E-Mail schreiben" style={{ textDecoration: "underline" }}>{v.kontakt.email}</a>
            </dd>
            {v.kontakt.flaechen.length > 0 && (
              <>
                <dt>Flurstücke</dt>
                <dd>{v.kontakt.flaechen.map((f, i) => <div key={i}>{f}</div>)}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {pv && pv.status === "zur_unterschrift" && v.pacht && (
        <section className="lfk-karte" id="pachtvertrag">
          <h2 className="lfk-h2">Landpachtvertrag</h2>
          <p className="lfk-klein" style={{ marginBottom: "0.8rem" }}>
            Der Vertrag wird zwischen Verpächter und Pächter geschlossen; Lippe Forst ist nicht Vertragspartei. Er kommt in Textform zustande, sobald beide Seiten unterschrieben haben. Änderungswünsche schicken Sie uns bitte unten über „Rückfrage“ — dann passen wir den Entwurf an.
          </p>
          {v.pacht.meine ? (
            <p className="lfk-hinweis lfk-hinweis-ok">
              Sie haben den Pachtvertrag am {datumDe(v.pacht.meine)} unterschrieben. {v.pacht.andere ? "" : "Die Unterschrift der anderen Seite steht noch aus."}
            </p>
          ) : null}
          <div className="lfk-vertrag" tabIndex={0} aria-label="Text des Landpachtvertrags">
            <VertragsText dok={pachtDokument(key, pv.daten)} />
          </div>
          {!v.pacht.meine && pv.textHash && kunde.stammdaten && (
            <div style={{ marginTop: "1rem" }}>
              <UnterschriftFormular
                aktion={pachtUnterschreibenAktion}
                hidden={{ k: kunde.id, key, hash: pv.textHash }}
                erklaerungen={erklaerungenPachtvertrag(kunde.rolle)}
                nameErwartet={kunde.stammdaten.name}
                knopf={anbieter ? "Pachtvertrag verbindlich abschließen" : "Pachtvertrag zahlungspflichtig abschließen"}
                knopfTipp={anbieter ? "Unterschreibt den Pachtvertrag als Verpächter" : "Unterschreibt den Pachtvertrag als Pächter — damit verpflichten Sie sich zur Zahlung der Pacht"}
                zusammenfassung={
                  <div className="lfk-zusammenfassung">
                    <dl>
                      <dt>Pachtfläche</dt>
                      <dd>{pv.daten.flaechen.length} Flurstück{pv.daten.flaechen.length === 1 ? "" : "e"}, {M.summeHa(pv.daten.flaechen)?.toLocaleString("de-DE") ?? "?"} ha</dd>
                      <dt>Pachtbeginn</dt>
                      <dd>{tagDe(pv.daten.pachtBeginn)}</dd>
                      <dt>Laufzeit</dt>
                      <dd>{pv.daten.laufzeitJahre ? `${pv.daten.laufzeitJahre} Pachtjahre` : "unbestimmte Zeit"}</dd>
                      <dt>Volle Jahrespacht</dt>
                      <dd>{M.euro(M.jahrespacht(pv.daten))}{pv.daten.umsatzsteuer === "zuzueglich" ? " zzgl. USt" : ""}</dd>
                      {pachtProvision && (
                        <>
                          <dt>Provision an Lippe Forst</dt>
                          <dd>{pachtProvision}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                }
              />
            </div>
          )}
        </section>
      )}

      {kauf && kauf.status === "zur_bestaetigung" && v.kauf && ctx && (
        <section className="lfk-karte" id="kauf">
          <h2 className="lfk-h2">Eckdaten für den Notar (unverbindlich)</h2>
          {v.kauf.meine ? (
            <p className="lfk-hinweis lfk-hinweis-ok">Sie haben die Eckdaten am {datumDe(v.kauf.meine)} bestätigt.</p>
          ) : null}
          <div className="lfk-vertrag" tabIndex={0} aria-label="Kaufabsicht und Eckdaten">
            <VertragsText dok={kaufDokument(key, kauf.daten, ctx.suchender?.vertrag?.konditionen ?? null)} />
          </div>
          {!v.kauf.meine && kauf.textHash && kunde.stammdaten && (
            <div style={{ marginTop: "1rem" }}>
              <UnterschriftFormular
                aktion={kaufBestaetigenAktion}
                hidden={{ k: kunde.id, key, hash: kauf.textHash }}
                erklaerungen={erklaerungenKaufabsicht()}
                nameErwartet={kunde.stammdaten.name}
                knopf="Eckdaten bestätigen (unverbindlich)"
                knopfTipp="Bestätigt nur die Eckdaten für den Notar — ein Kaufvertrag entsteht erst bei der notariellen Beurkundung"
              />
            </div>
          )}
        </section>
      )}

      {v.dokumente.length > 0 && (
        <section className="lfk-karte">
          <h2 className="lfk-h2">Dokumente</h2>
          <ul className="lfk-liste">
            {v.dokumente.map((d) => (
              <li key={d.id}>
                <div style={{ minWidth: 0 }}>
                  <strong>{d.titel}</strong>
                  <div className="lfk-klein">{datumZeitDe(d.erstelltAm)} · {groesse(d.groesse)}</div>
                </div>
                <a href={`/kunde/dokument/${d.id}?k=${kunde.id}&v=${encodeURIComponent(key)}`} target="_blank" rel="noopener" className="btn-secondary lfk-knopf-klein" title="Dokument öffnen (PDF bzw. Bild)">
                  Öffnen
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.gutschein && (
        <section className="lfk-gutschein" aria-label="Treue-Gutschein">
          <h2 className="lfk-h2" style={{ fontSize: "1.1rem" }}>Ihr Treue-Gutschein</h2>
          <p>
            <span className="lfk-gutschein-code">{v.gutschein.code}</span> · {M.euro(v.gutschein.betrag)} für Ihr nächstes Geschäft mit Lippe Forst
          </p>
          <p className="lfk-klein">{gutscheinBedingungen(v.gutschein)}</p>
        </section>
      )}

      {v.freigegeben && !beendet && (
        <section className="lfk-karte">
          <h2 className="lfk-h2">Nachricht an Lippe Forst</h2>
          {!v.abschluss && (
            <details style={{ marginBottom: "0.8rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }} title="Teilen Sie uns mit, dass Sie einen Vertrag geschlossen haben (Mitteilungspflicht aus Ihrem Vertrag)">
                Vertragsschluss melden
              </summary>
              <form action={meldungAktion} className="lfk-form" style={{ marginTop: "0.6rem" }}>
                <input type="hidden" name="k" value={kunde.id} />
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="typ" value="abschluss" />
                <div className="lfk-raster">
                  <label>
                    <span className="field-label">Art</span>
                    <select name="vertragsart" defaultValue={v.art} className="field-select" title="Pacht- oder Kaufvertrag">
                      <option value="pacht">Pachtvertrag</option>
                      <option value="kauf">Kaufvertrag</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Datum</span>
                    <input name="datum" type="date" className="field-input" title="Datum des Vertragsschlusses" />
                  </label>
                  <label>
                    <span className="field-label">Fläche (ha)</span>
                    <input name="flaeche" inputMode="decimal" className="field-input" title="Vertragsfläche in Hektar" />
                  </label>
                  <label>
                    <span className="field-label">{v.art === "kauf" ? "Kaufpreis (€)" : "Jahrespacht (€)"}</span>
                    <input name="betrag" inputMode="decimal" className="field-input" title="Volle Jahrespacht bzw. Kaufpreis" />
                  </label>
                  <label className="lfk-voll">
                    <span className="field-label">Laufzeit / Anmerkung</span>
                    <input name="laufzeit" className="field-input" title="z. B. 10 Jahre ab 01.10.2026" />
                  </label>
                </div>
                <label>
                  <span className="field-label">Nachricht (freiwillig)</span>
                  <textarea name="text" className="field-textarea" style={{ minHeight: "4rem" }} title="Weitere Angaben" />
                </label>
                <button type="submit" className="btn-primary lfk-knopf-klein" title="Schickt die Mitteilung an Lippe Forst">
                  Mitteilung senden
                </button>
              </form>
            </details>
          )}
          <form action={meldungAktion} className="lfk-form">
            <input type="hidden" name="k" value={kunde.id} />
            <input type="hidden" name="key" value={key} />
            <input type="hidden" name="typ" value="rueckfrage" />
            <label>
              <span className="field-label">Rückfrage oder Änderungswunsch</span>
              <textarea name="text" required className="field-textarea" style={{ minHeight: "4rem" }} title="z. B. Änderungswunsch zum Pachtvertrag oder eine Frage an uns" />
            </label>
            <div>
              <button type="submit" className="btn-secondary lfk-knopf-klein" title="Schickt Ihre Nachricht an Lippe Forst">
                Rückfrage senden
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
