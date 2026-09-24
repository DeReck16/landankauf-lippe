import type { Metadata } from "next";
import Link from "next/link";
import * as M from "@/lib/portal/model";
import { kundenUebersicht, type KundenVorgang } from "@/lib/portal/sicht";
import { requireKunde } from "@/lib/portal/sitzung";
import { datumDe, datumZeitDe, suchprofilText, angebotText, tagDe } from "@/lib/portal/texte";
import { gutscheinBedingungen } from "@/lib/portal/vorgang";
import { beginnwunschAktion } from "./actions";
import DankeDialog from "./DankeDialog";

export const metadata: Metadata = { title: "Übersicht" };

function Hinweis({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const m = typeof sp.m === "string" ? sp.m.slice(0, 400) : "";
  if (!m) return null;
  return (
    <p className={`lfk-hinweis ${sp.mt === "fehler" ? "lfk-hinweis-fehler" : "lfk-hinweis-ok"}`} role="status">
      {m}
    </p>
  );
}

function VorgangZeile({ v, kundeId }: { v: KundenVorgang; kundeId: string }) {
  let stand: { text: string; klasse: string };
  if (v.abschluss) stand = { text: "Vertrag geschlossen", klasse: "lfk-badge-ok" };
  else if (v.pacht?.status === "zur_unterschrift") stand = { text: v.pacht.meine ? "Sie haben unterschrieben" : "Pachtvertrag zur Unterschrift", klasse: v.pacht.meine ? "lfk-badge-ok" : "lfk-badge-warn" };
  else if (v.kauf?.status === "zur_bestaetigung") stand = { text: v.kauf.meine ? "Eckdaten bestätigt" : "Eckdaten bestätigen", klasse: v.kauf.meine ? "lfk-badge-ok" : "lfk-badge-warn" };
  else if (v.freigegeben) stand = { text: "Kontakt freigegeben", klasse: "lfk-badge-ok" };
  else if (v.abgelehnt) stand = { text: "kein Interesse gemeldet", klasse: "" };
  else if (v.meineZustimmung) stand = { text: "Sie haben zugestimmt", klasse: "lfk-badge-ok" };
  else stand = { text: "Ihre Rückmeldung fehlt", klasse: "lfk-badge-warn" };
  return (
    <li>
      <div style={{ minWidth: 0 }}>
        <strong>
          {v.freigegeben && v.kontakt ? v.kontakt.name : `${v.anonym.typ}, ${v.anonym.groesse}`}
        </strong>
        <div className="lfk-klein">
          {v.freigegeben ? `${v.anonym.typ}, ${v.anonym.groesse} · ${v.anonym.lage}` : `Raum ${v.anonym.lage} · ${v.anonym.art}`}
        </div>
      </div>
      <span className={`lfk-badge ${stand.klasse}`}>{stand.text}</span>
      <Link href={`/kunde/vorgang/${v.key}?k=${kundeId}`} className="btn-secondary lfk-knopf-klein" title="Details öffnen: Eckdaten, Zustimmung, Kontaktdaten nach Freigabe, Vertrag und Dokumente">
        Öffnen
      </Link>
    </li>
  );
}

export default async function KundePage(props: PageProps<"/kunde">) {
  const sitzung = await requireKunde();
  const sp = await props.searchParams;
  const { liste, bewertungsUrl } = await kundenUebersicht(sitzung.kunden);
  const danke = bewertungsUrl ? liste.flatMap((x) => x.vorgaenge.filter((v) => v.danke).map((v) => ({ k: x.kunde.id, v }))).at(0) : undefined;
  const gutscheine = liste.flatMap((x) => x.vorgaenge.filter((v) => v.gutschein).map((v) => v.gutschein!));

  return (
    <>
      {danke && bewertungsUrl && <DankeDialog kundeId={danke.k} vorgang={danke.v.key} url={bewertungsUrl} art={danke.v.art} />}
      <h1 className="lfk-h1">Ihr Kundenbereich</h1>
      <p className="lfk-unterzeile">Angemeldet als {sitzung.email}. Hier sehen Sie Ihren Vertrag mit Lippe Forst, passende Vorschläge und — nach der Freigabe — die Kontaktdaten Ihres Gegenübers.</p>
      <Hinweis sp={sp} />

      {liste.map(({ kunde: k, lead, vorgaenge }) => {
        const stufe = M.stufe(k);
        const widerruf = M.widerrufMoeglich(k);
        const vertragDok = k.vertrag ? k.dokumente.find((d) => d.id === k.vertrag!.dokumentId) : undefined;
        const schritte = [
          { text: "Angaben", stand: k.stammdaten ? "fertig" : "jetzt" },
          { text: k.rolle === "anbieter" ? "Vereinbarung bestätigen" : "Vertrag unterschreiben", stand: k.vertrag ? "fertig" : k.stammdaten ? "jetzt" : "offen" },
          { text: "Vorschläge und Kontakt", stand: k.vertrag ? (vorgaenge.some((v) => v.freigegeben) ? "fertig" : "jetzt") : "offen" },
        ];
        return (
          <section key={k.id} className={`lfk-karte ${stufe !== "unterschrieben" && stufe !== "widerrufen" && stufe !== "gekuendigt" ? "lfk-karte-hervor" : ""}`}>
            <h2 className="lfk-h2">{k.rolle === "anbieter" ? "Ihre Fläche" : "Ihr Gesuch"}</h2>
            {lead && <p className="lfk-klein" style={{ marginTop: "-0.3rem", marginBottom: "0.8rem" }}>{k.rolle === "anbieter" ? angebotText(lead) : suchprofilText(lead)} · Vorgang {k.id}</p>}
            <ol className="lfk-schritte">
              {schritte.map((s) => (
                <li key={s.text} data-stand={s.stand}>{s.text}</li>
              ))}
            </ol>

            {!k.stammdaten && (
              <div className="lfk-knopfreihe">
                <Link href={`/kunde/angaben?k=${k.id}`} className="btn-primary" title="Name, Anschrift und — bei Anbietern — die Flurstücke ergänzen">
                  Angaben ergänzen
                </Link>
              </div>
            )}
            {k.stammdaten && !k.vertrag && stufe !== "gesperrt" && (
              <div className="lfk-knopfreihe">
                <Link href={`/kunde/vertrag?k=${k.id}`} className="btn-primary" title="Den vollständigen Vertrag lesen und online unterschreiben">
                  {k.rolle === "anbieter" ? "Vereinbarung lesen und bestätigen" : "Vertrag lesen und unterschreiben"}
                </Link>
                <Link href={`/kunde/angaben?k=${k.id}`} className="btn-secondary lfk-knopf-klein" title="Ihre Angaben ändern">
                  Angaben ändern
                </Link>
              </div>
            )}

            {k.vertrag && (
              <>
                <dl className="lfk-daten">
                  <dt>Vertrag</dt>
                  <dd>{k.vertrag.titel}</dd>
                  <dt>Unterschrieben</dt>
                  <dd>{datumZeitDe(k.vertrag.signatur.am)} von {k.vertrag.signatur.name}</dd>
                  {k.widerruf && (
                    <>
                      <dt>Widerrufen</dt>
                      <dd>{datumZeitDe(k.widerruf.am)}</dd>
                    </>
                  )}
                  {k.kuendigung && (
                    <>
                      <dt>Gekündigt</dt>
                      <dd>{datumZeitDe(k.kuendigung.am)}</dd>
                    </>
                  )}
                </dl>
                <div className="lfk-knopfreihe" style={{ marginTop: "0.8rem" }}>
                  {vertragDok && (
                    <a href={`/kunde/dokument/${vertragDok.id}?k=${k.id}`} target="_blank" rel="noopener" className="btn-secondary lfk-knopf-klein" title="Öffnet Ihren unterschriebenen Vertrag mit Unterschriftsprotokoll als PDF">
                      Vertrag als PDF
                    </a>
                  )}
                  <Link href={`/kunde/angaben?k=${k.id}`} className="btn-secondary lfk-knopf-klein" title="Anschrift oder Telefonnummer aktualisieren (der unterschriebene Vertrag bleibt unverändert)">
                    Angaben ändern
                  </Link>
                </div>
              </>
            )}

            {widerruf && k.vertrag && (
              <div className="lfk-hinweis" style={{ marginTop: "1rem", marginBottom: 0 }}>
                <p style={{ marginBottom: "0.6rem" }}>
                  <strong>Widerrufsrecht:</strong> Sie können diesen Vertrag bis zum {datumDe(k.vertrag.widerrufsfristEnde)} ohne Angabe von Gründen widerrufen.
                </p>
                <Link href={`/kunde/widerruf?k=${k.id}`} className="lfk-knopf-warn" title="Widerrufsfunktion: öffnet die Widerrufserklärung — dort bestätigen Sie den Widerruf">
                  Vertrag widerrufen
                </Link>
                {!k.vertrag.beginnwunschAm && (
                  <details style={{ marginTop: "0.8rem" }}>
                    <summary style={{ cursor: "pointer" }} title="Nur nötig, wenn Kontakte schon vor Ablauf der Widerrufsfrist freigegeben werden sollen">
                      Kontakte schon vor Ablauf der Widerrufsfrist erhalten?
                    </summary>
                    <form action={beginnwunschAktion} className="lfk-form" style={{ marginTop: "0.6rem" }}>
                      <input type="hidden" name="k" value={k.id} />
                      <label className="lfk-check" title="Freiwillig: Nur ankreuzen, wenn Sie Kontakte schon vor Ende der Widerrufsfrist erhalten möchten">
                        <input type="checkbox" name="bestaetigt" value="1" required />
                        <span>
                          Ich verlange ausdrücklich, dass Lippe Forst schon vor Ablauf der Widerrufsfrist mit der Leistung beginnt, mir also passende Flächen vorstellt und Kontakte freigibt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlen muss und dass mein Widerrufsrecht erlischt, sobald Lippe Forst die Leistung vollständig erbracht hat.
                        </span>
                      </label>
                      <div className="lfk-knopfreihe">
                        <button type="submit" className="btn-secondary lfk-knopf-klein" title="Erklärt den ausdrücklichen Wunsch auf Beginn vor Fristende — freiwillig">
                          Beginn jetzt verlangen
                        </button>
                      </div>
                    </form>
                  </details>
                )}
              </div>
            )}

            {k.vertrag && !k.widerruf && (
              <div style={{ marginTop: "1.2rem" }}>
                <h3 className="lfk-h2" style={{ fontSize: "1.05rem" }}>{k.rolle === "anbieter" ? "Interessenten für Ihre Fläche" : "Passende Flächen"}</h3>
                {vorgaenge.length === 0 ? (
                  <p className="lfk-klein">
                    {k.rolle === "anbieter"
                      ? "Sobald wir einen passenden Interessenten haben, stellen wir ihn Ihnen hier anonym vor."
                      : "Sobald uns eine passende Fläche angeboten wird, stellen wir sie Ihnen hier anonym vor."}
                  </p>
                ) : (
                  <ul className="lfk-liste">
                    {vorgaenge.map((v) => (
                      <VorgangZeile key={v.key} v={v} kundeId={k.id} />
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!k.vertrag && vorgaenge.length > 0 && (
              <p className="lfk-hinweis" style={{ marginTop: "1rem", marginBottom: 0 }}>
                Wir haben {vorgaenge.length === 1 ? "einen passenden Vorschlag" : `${vorgaenge.length} passende Vorschläge`} für Sie. Bitte {k.rolle === "anbieter" ? "bestätigen Sie zuerst die Vereinbarung" : "unterschreiben Sie zuerst den Vertrag"}, dann sehen Sie die Einzelheiten.
              </p>
            )}
          </section>
        );
      })}

      {gutscheine.length > 0 && (
        <section className="lfk-gutschein" aria-label="Treue-Gutschein">
          <h2 className="lfk-h2" style={{ fontSize: "1.1rem" }}>Ihr Treue-Gutschein</h2>
          {gutscheine.map((g) => (
            <div key={g.code} style={{ marginBottom: "0.6rem" }}>
              <p>
                <span className="lfk-gutschein-code">{g.code}</span> · {M.euro(g.betrag)} für Ihr nächstes Geschäft · gültig bis {tagDe(g.gueltigBis)}
                {g.eingeloest ? " · bereits eingelöst" : ""}
              </p>
              <p className="lfk-klein">{gutscheinBedingungen(g)}</p>
            </div>
          ))}
        </section>
      )}

      <p className="lfk-klein">
        Fragen? Antworten Sie einfach auf eine unserer E-Mails oder rufen Sie uns an. <Link href="/datenschutz" style={{ textDecoration: "underline" }} title="Wie wir Ihre Daten im Kundenbereich verarbeiten">Datenschutz</Link>
      </p>
    </>
  );
}
