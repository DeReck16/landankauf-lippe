import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten, punkteFuer } from "@/lib/admin/matching";
import { LEAD_STATUS, MATCH_STATUS, ableitenAusAnliegen, formatGroesse, parseGroesse, type LeadStatus } from "@/lib/admin/model";
import { ROLLE_LABEL, ROLLE_TIPP, artLabel, datumZeit } from "@/lib/admin/format";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { einladungsLink } from "@/lib/portal/ablauf";
import { entwuerfeKunde } from "@/lib/portal/entwuerfe";
import { mailKey } from "@/lib/portal/postfach";
import * as M from "@/lib/portal/model";
import { basisUrl } from "@/lib/portal/sitzung";
import { anschrift, datumDe, flaecheZeile, rolleVonLead } from "@/lib/portal/texte";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";
import { BERATUNG_THEMEN, RUECKMELDUNG_NAME, antwortGruppe, antwortOptionen, istBeratungThema, istRueckmeldungArt, themaVorschlag } from "@/lib/portal/rueckmeldung-typen";
import { anfrageSpeichern, ortNeuSuchen, postfachFormular, rueckmeldungErfassen } from "../../../actions";
import {
  bestaetigungSendenAktion,
  bewertungsWiderspruchAktion,
  einladungErstellenAktion,
  einladungZurueckziehenAktion,
  kuendigungErfassenAktion,
  widerrufErfassenAktion,
  zugangSperrenAktion,
} from "../../../portal-actions";
import BestaetigenKnopf from "../../BestaetigenKnopf";
import GesehenMarker from "../../GesehenMarker";
import LinkKopieren from "../../LinkKopieren";
import MailEntwurf from "../../MailEntwurf";
import { DokumentListe, KundenStand, Meldung, Puls, Verlauf, VorgangLink } from "../../teile";
import BoersePanel, { BoerseHerkunft } from "./BoersePanel";

export const metadata: Metadata = { title: "Anfrage" };

function zahlFeld(v: number | null | undefined): string {
  return v == null ? "" : String(v).replace(".", ",");
}

export default async function AnfragePage(props: PageProps<"/admin/anfrage/[id]">) {
  const { email } = await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [{ leads, zustand }, portal, neu] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email)]);
  const l = leads.find((x) => x.id === id);
  if (!l) notFound();

  const kunde = portal.kunden.get(l.id) ?? null;
  const rr = rolleVonLead(l);
  const basis = await basisUrl();
  const abgeleitet = ableitenAusAnliegen(l.intent);
  const geparst = parseGroesse(l.groesse);
  const orte = punkteFuer(l, zustand.orte);
  const eigeneKandidaten = findeKandidaten(leads, zustand).kandidaten.filter((k) => k.angebot.id === l.id || k.gesuch.id === l.id);
  const verlauf = zustand.protokoll.filter((p) => p.ref === l.id || p.ref?.split("~").includes(l.id)).slice(0, 30);
  const einzel = l.rolle !== "gesuch";
  const minAlt = zahlFeld(l.groesseWert.minHa);
  const maxAlt = einzel ? minAlt : zahlFeld(l.groesseWert.maxHa);
  const zurueck = `/admin/anfrage/${l.id}`;

  const neueEreignisse = neu.kunde(kunde);
  const neuIds = new Set(neueEreignisse.map((e) => e.id));
  const vorlage = rr ? kundenVorlage(rr.rolle, rr.art) : null;
  const vorlageFrei = vorlage ? istFreigegeben(portal.einstellungen, vorlage) : false;
  const link = kunde ? einladungsLink(kunde, basis) : null;
  const entwuerfe = entwuerfeKunde({ lead: l, kunde, einstellungen: portal.einstellungen, basis });
  const rm = l.meta.rueckmeldung;
  // Vorbelegung per Link (z. B. von Claude aus einer E-Mail-Antwort vorbereitet): ?rm=<Antwort>&rmNotiz=…&rmThema=… —
  // gespeichert wird trotzdem erst per Knopf.
  const optionen = antwortOptionen(antwortGruppe(l.rolle), l.art, true);
  const rmVor = typeof sp.rm === "string" && istRueckmeldungArt(sp.rm) && optionen.includes(sp.rm) ? sp.rm : "";
  const rmNotizVor = typeof sp.rmNotiz === "string" ? sp.rmNotiz.slice(0, 1500) : "";
  const rmThemaVor = typeof sp.rmThema === "string" && istBeratungThema(sp.rmThema) ? sp.rmThema : "";

  return (
    <>
      <GesehenMarker keys={[`anfrage:${l.id}`, `kunde:${l.id}`]} />
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/admin" className="lfa-klein" title="Zurück zur Liste aller Anfragen">← Alle Anfragen</Link>
      </p>
      <Meldung sp={sp} />
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">
            <Puls an={neu.anfrage(l)} tipp="Neue Anfrage — wird ab jetzt als angesehen vermerkt" />
            {l.name}
          </h1>
          <div className="lfa-knopfreihe" style={{ marginTop: "0.4rem" }}>
            <span className={`lfa-badge lfa-badge-${l.rolle}`} title={ROLLE_TIPP[l.rolle]}>
              {ROLLE_LABEL[l.rolle]}
              {l.art ? ` · ${artLabel(l.art)}` : ""}
            </span>
            <span className={`lfa-badge lfa-badge-status-${l.status}`} title={LEAD_STATUS[l.status].tipp}>
              {LEAD_STATUS[l.status].label}
            </span>
            {l.ausAds && <span className="lfa-badge lfa-badge-ads" title="Kam über eine Google-Anzeige (gclid vorhanden)">Google Ads</span>}
            <span className="lfa-klein">{l.id} · eingegangen {datumZeit(l.receivedAt)}</span>
          </div>
        </div>
        <div className="lfa-knopfreihe">
          {l.email !== "—" && (
            <a
              href={`mailto:${l.email}?subject=${encodeURIComponent("Ihre Anfrage bei Lippe Forst")}`}
              className="lfa-knopf"
              title="Öffnet eine neue E-Mail an den Interessenten im Mailprogramm (nichts wird automatisch gesendet)"
            >
              E-Mail schreiben
            </a>
          )}
          {l.phone !== "—" && (
            <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="lfa-knopf lfa-knopf-hell" title="Ruft die angegebene Nummer an">
              Anrufen
            </a>
          )}
        </div>
      </div>

      {rm && (
        <div className="lfa-hinweis lfa-hinweis-ok lfa-rueckmeldung-box" title="Neueste Antwort auf die Nachfass-Mail — frühere stehen im Verlauf der Anfrage">
          <strong>
            Rückmeldung vom {datumZeit(rm.am)}: {RUECKMELDUNG_NAME[rm.art]}
            {rm.thema ? ` – ${rm.thema}` : ""}
          </strong>
          <span className="lfa-klein">
            {" "}
            ({rm.quelle === "link" ? "selbst über den Antwort-Link" : rm.quelle === "email" ? `aus der E-Mail übernommen von ${rm.von ?? "der Verwaltung"}` : `erfasst von ${rm.von ?? "der Verwaltung"}`})
          </span>
          {(rm.text || rm.notiz) && (
            <div className="lfa-nachricht lfa-ticket-text" title={rm.text ? "Nachricht des Kunden" : "Interne Notiz — nie für den Kunden sichtbar"}>
              {rm.text ?? `Notiz: ${rm.notiz}`}
            </div>
          )}
          {rm.art !== "kein-interesse" && l.status === "neu" && (
            <div className="lfa-klein">
              Offenes Ticket — steht im{" "}
              <Link href="/admin/dashboard#rueckmeldungen" title="Zum Dashboard, Abschnitt „Rückmeldungen“">
                Dashboard unter „Rückmeldungen“
              </Link>
              , bis die Anfrage bearbeitet ist (Einladung gesendet oder als beantwortet markiert).
            </div>
          )}
        </div>
      )}

      <div className="lfa-raster">
        <div>
          <section className="lfa-panel">
            <h2 className="lfa-h2">Angaben aus dem Formular</h2>
            <dl className="lfa-daten">
              <dt>Anliegen</dt><dd>{l.intent}</dd>
              <dt>Flächentyp</dt><dd>{l.flaechentyp}</dd>
              <dt>Größe</dt>
              <dd>
                {l.groesse}
                {l.groesse !== "—" && (
                  <span className="lfa-klein"> → gelesen: {formatGroesse(geparst)}{geparst.unsicher ? " (unsicher)" : ""}</span>
                )}
              </dd>
              <dt>Ort / Gemarkung</dt><dd>{l.ort}</dd>
              <dt>Flur / Flurstück</dt><dd>{l.flurstueck}</dd>
              {l.meta.kataster && (
                <>
                  <dt title="Automatisch abgefragt: ALKIS NRW (Flurstück) und BORIS NRW (Bodenrichtwert)">Kataster (amtlich)</dt>
                  <dd title={`Abgefragt am ${datumZeit(l.meta.kataster.am)}`}>
                    {l.meta.kataster.flurstueck ? (
                      <>
                        {l.meta.kataster.flurstueck.gemarkung}, Flur {l.meta.kataster.flurstueck.flur}, Flurstück {l.meta.kataster.flurstueck.nummer} ·{" "}
                        {l.meta.kataster.flurstueck.flaecheM2.toLocaleString("de-DE")} m² · {l.meta.kataster.flurstueck.nutzung}
                        {l.meta.kataster.flurstueck.lage ? ` · „${l.meta.kataster.flurstueck.lage}“` : ""} · Kreis {l.meta.kataster.flurstueck.kreis}
                        {l.meta.kataster.brw && (
                          <span className="lfa-klein">
                            {" "}
                            — Bodenrichtwert {l.meta.kataster.brw.wert.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €/m² (
                            {l.meta.kataster.brw.art === "forstwirtschaft" ? "Forst, ohne Aufwuchs" : l.meta.kataster.brw.art === "wohnbau" ? "Wohnbau" : "Landwirtschaft"}, Stichtag{" "}
                            {l.meta.kataster.brw.stichtag.split("-").reverse().join(".")}, Zone {l.meta.kataster.brw.zone})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="lfa-klein">{l.meta.kataster.hinweis ?? "nicht gefunden"}</span>
                    )}
                  </dd>
                </>
              )}
              <dt>Name</dt><dd>{l.name}</dd>
              <dt>E-Mail</dt>
              <dd className="lfa-kontakt">{l.email !== "—" ? <a href={`mailto:${l.email}`} title="Neue E-Mail an diese Adresse">{l.email}</a> : "—"}</dd>
              <dt>Telefon</dt>
              <dd className="lfa-kontakt">{l.phone !== "—" ? <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} title="Nummer anrufen">{l.phone}</a> : "—"}</dd>
              <dt>Quelle</dt><dd title="Seite, auf der das Formular abgeschickt wurde">{l.source}</dd>
              <dt>Google Ads</dt><dd title="Google-Klick-ID — vorhanden, wenn die Anfrage über eine Anzeige kam">{l.ausAds ? l.gclid : "nein (organisch/direkt)"}</dd>
              <dt>Einwilligung</dt><dd title="Datenschutz-Checkbox im Formular">{l.consent === "on" ? "erteilt" : l.consent}</dd>
            </dl>
            <h3 className="lfa-h2" style={{ marginTop: "1.1rem", fontSize: "1rem" }}>Nachricht</h3>
            <div className="lfa-nachricht">{l.message !== "—" ? l.message : "Keine Nachricht."}</div>
          </section>

          <BoerseHerkunft l={l} zustand={zustand} />
          <BoersePanel l={l} zustand={zustand} />

          <section className="lfa-panel" id="kundenbereich">
            <h2 className="lfa-h2">
              Kundenbereich &amp; Onboarding
              {neueEreignisse.length > 0 && <span className="lfa-neu-text" style={{ marginLeft: "0.5rem" }}><span className="lfa-puls" />{neueEreignisse.length} neu</span>}
            </h2>
            {!rr ? (
              <p className="lfa-klein">
                Onboarding gibt es nur für Angebote und Gesuche mit Kauf oder Pacht. Rechts unter „Angaben fürs Matching“ lässt sich die Anfrage einordnen.
              </p>
            ) : (
              <>
                <KundenStand k={kunde} rolle={rr.rolle} />
                <p className="lfa-klein" style={{ margin: "0.5rem 0" }}>
                  Vertrag: <strong>{VORLAGEN[vorlage!].titel}</strong>
                  {vorlageFrei ? " — Vorlage freigegeben." : " — Vorlage noch NICHT freigegeben (Verwaltung → Vorlagen)."}
                </p>

                {kunde?.stammdaten && (
                  <dl className="lfa-daten" style={{ marginBottom: "0.75rem" }}>
                    <dt>Name (Angaben)</dt><dd>{kunde.stammdaten.name}{kunde.stammdaten.betrieb ? ` · ${kunde.stammdaten.betrieb}` : ""}</dd>
                    <dt>Anschrift</dt><dd>{anschrift(kunde.stammdaten) || "—"}</dd>
                    <dt>Telefon</dt><dd>{kunde.stammdaten.telefon || "—"}</dd>
                    <dt>Handelt als</dt><dd>{kunde.stammdaten.eigenschaft === "verbraucher" ? "Verbraucher (§ 13 BGB)" : "Unternehmer (§ 14 BGB)"}</dd>
                    {kunde.flaechen?.length ? (
                      <>
                        <dt>Flächen</dt>
                        <dd>{kunde.flaechen.map((f, i) => <div key={i}>{flaecheZeile(f)}</div>)}</dd>
                      </>
                    ) : null}
                  </dl>
                )}

                {!kunde?.vertrag && (
                  <div className="lfa-abschnitt">
                    <h3 className="lfa-h3">Einladung</h3>
                    {kunde?.einladung ? (
                      <p className="lfa-klein">
                        Erstellt {datumZeit(kunde.einladung.erstelltAm)} · gültig bis {datumDe(kunde.einladung.bis)}
                        {kunde.einladung.gesendetAm ? ` · per Mail gesendet ${datumZeit(kunde.einladung.gesendetAm)}` : " · noch nicht gesendet"}
                        {kunde.einladung.angenommenAm ? ` · geöffnet ${datumZeit(kunde.einladung.angenommenAm)}` : ""}
                      </p>
                    ) : (
                      <p className="lfa-klein">Noch keine Einladung. Der persönliche Link ist 30 Tage gültig und an diese Anfrage und Rolle gebunden.</p>
                    )}
                    {link && <LinkKopieren link={link} tipp="Kopiert den persönlichen Einladungslink — z. B. für eine eigene Mail oder WhatsApp" />}
                    <div className="lfa-knopfreihe" style={{ marginTop: "0.5rem" }}>
                      <form action={einladungErstellenAktion}>
                        <input type="hidden" name="kunde" value={l.id} />
                        <input type="hidden" name="zurueck" value={zurueck} />
                        <button
                          type="submit"
                          className="lfa-knopf lfa-knopf-klein"
                          disabled={!vorlageFrei || l.email === "—"}
                          title={
                            !vorlageFrei
                              ? "Erst möglich, wenn die Vertragsvorlage unter „Vorlagen“ freigegeben ist"
                              : kunde?.einladung
                                ? "Erstellt einen neuen Link — der bisherige wird damit ungültig. Gesendet wird noch nichts."
                                : "Erstellt den persönlichen Einladungslink und legt die Kundenakte an. Gesendet wird noch nichts — der Entwurf erscheint unten."
                          }
                        >
                          {kunde?.einladung ? "Neuen Link erstellen" : "Einladung erstellen"}
                        </button>
                      </form>
                      {kunde?.einladung && (
                        <form action={einladungZurueckziehenAktion}>
                          <input type="hidden" name="kunde" value={l.id} />
                          <input type="hidden" name="zurueck" value={zurueck} />
                          <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Einladungslink ungültig machen? Der Kunde kann ihn danach nicht mehr benutzen." tipp="Macht den Einladungslink sofort ungültig (z. B. falsch verschickt)">
                            Link ungültig machen
                          </BestaetigenKnopf>
                        </form>
                      )}
                    </div>
                  </div>
                )}

                {kunde && (
                  <div className="lfa-abschnitt">
                    <h3 className="lfa-h3">Dokumente</h3>
                    <DokumentListe dokumente={kunde.dokumente} quelle={{ k: kunde.id }} neu={(dokId) => neu.dokumentNeu(kunde, dokId)} />
                  </div>
                )}

                {kunde?.vertrag && (
                  <div className="lfa-abschnitt">
                    <h3 className="lfa-h3">Vertrag verwalten</h3>
                    <div className="lfa-knopfreihe">
                      <form action={bestaetigungSendenAktion}>
                        <input type="hidden" name="kunde" value={kunde.id} />
                        <input type="hidden" name="zurueck" value={zurueck} />
                        <BestaetigenKnopf className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" frage={`Vertragsbestätigung mit PDF erneut an ${kunde.email} senden?`} tipp="Sendet die Vertragsbestätigung mit dem PDF erneut an den Kunden (dauerhafter Datenträger, § 312f BGB)">
                          Bestätigung erneut senden
                        </BestaetigenKnopf>
                      </form>
                      {M.bewertungsmailErlaubt(kunde) && (
                        <form action={bewertungsWiderspruchAktion}>
                          <input type="hidden" name="kunde" value={kunde.id} />
                          <input type="hidden" name="zurueck" value={zurueck} />
                          <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Widerspruch gegen Bewertungs-E-Mails vermerken? Danach wird keine Bitte um eine Bewertung mehr per E-Mail vorgeschlagen oder automatisch gesendet." tipp="Der Kunde möchte keine Bitte um eine Bewertung per E-Mail (Einwilligung widerrufen)">
                            Keine Bewertungs-Mails
                          </BestaetigenKnopf>
                        </form>
                      )}
                      <form action={zugangSperrenAktion}>
                        <input type="hidden" name="kunde" value={kunde.id} />
                        <input type="hidden" name="zurueck" value={zurueck} />
                        <input type="hidden" name="sperren" value={kunde.gesperrt ? "0" : "1"} />
                        <BestaetigenKnopf
                          className="lfa-knopf lfa-knopf-leise lfa-knopf-klein"
                          frage={kunde.gesperrt ? "Zugang zum Kundenbereich wieder freigeben?" : "Zugang zum Kundenbereich sperren? Alle Sitzungen des Kunden enden sofort."}
                          tipp={kunde.gesperrt ? "Gibt den Kundenbereich wieder frei (neue Anmeldung per Link nötig)" : "Sperrt den Kundenbereich für diesen Kunden sofort (alle Sitzungen enden)"}
                        >
                          {kunde.gesperrt ? "Zugang entsperren" : "Zugang sperren"}
                        </BestaetigenKnopf>
                      </form>
                    </div>
                    {!kunde.widerruf && (
                      <details className="lfa-details" style={{ marginTop: "0.6rem" }}>
                        <summary title="Einen per E-Mail, Post oder Telefon eingegangenen Widerruf bzw. eine Kündigung erfassen">Widerruf oder Kündigung erfassen</summary>
                        <div className="lfa-knopfreihe" style={{ alignItems: "flex-start" }}>
                          {M.hatWiderrufsrecht(kunde) && (
                            <form action={widerrufErfassenAktion} className="lfa-inline" style={{ flex: "1 1 18rem" }}>
                              <input type="hidden" name="kunde" value={kunde.id} />
                              <input type="hidden" name="zurueck" value={zurueck} />
                              <label>
                                Eingang
                                <select name="eingang" className="field-select" title="Wie der Widerruf eingegangen ist">
                                  <option value="email">per E-Mail</option>
                                  <option value="post">per Post</option>
                                  <option value="telefon">telefonisch</option>
                                  <option value="sonstig">sonstig</option>
                                </select>
                              </label>
                              <label>
                                Notiz
                                <input name="notiz" className="field-input" title="z. B. Datum des Schreibens" />
                              </label>
                              <BestaetigenKnopf className="lfa-knopf lfa-knopf-klein" frage="Widerruf erfassen? Danach sind keine Freigaben mehr möglich." tipp="Erfasst den Widerruf; die Verwaltung wird benachrichtigt">
                                Widerruf erfassen
                              </BestaetigenKnopf>
                            </form>
                          )}
                          {!kunde.kuendigung && (
                            <form action={kuendigungErfassenAktion} className="lfa-inline" style={{ flex: "1 1 18rem" }}>
                              <input type="hidden" name="kunde" value={kunde.id} />
                              <input type="hidden" name="zurueck" value={zurueck} />
                              <label>
                                Eingang
                                <select name="eingang" className="field-select" title="Wie die Kündigung eingegangen ist">
                                  <option value="email">per E-Mail</option>
                                  <option value="post">per Post</option>
                                  <option value="telefon">telefonisch</option>
                                  <option value="sonstig">sonstig</option>
                                </select>
                              </label>
                              <label>
                                Notiz
                                <input name="notiz" className="field-input" title="z. B. Grund der Kündigung" />
                              </label>
                              <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Kündigung erfassen? Es werden keine neuen Flächen/Interessenten mehr vorgestellt." tipp="Erfasst die Kündigung; bereits nachgewiesene Flächen bleiben provisionsgeschützt">
                                Kündigung erfassen
                              </BestaetigenKnopf>
                            </form>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {kunde && (
                  <div className="lfa-abschnitt">
                    <h3 className="lfa-h3">Verlauf der Kundenakte</h3>
                    <Verlauf ereignisse={kunde.ereignisse} mails={kunde.mails} neuIds={neuIds} />
                  </div>
                )}
              </>
            )}
          </section>

          {entwuerfe.length > 0 && (
            <section className="lfa-panel" id="entwuerfe">
              <h2 className="lfa-h2">E-Mail-Entwürfe</h2>
              <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
                Jeder Entwurf ist vor dem Senden änderbar. „Senden“ fragt noch einmal nach und verschickt dann über lippeforst.de (Antworten ins Anfragenpostfach, Kopie an die Verwaltung); der Text wird im Verlauf gespeichert.
              </p>
              <div className="lfa-entwuerfe">
                {entwuerfe.map((e) => (
                  <MailEntwurf key={e.id} e={e} offen={Boolean(e.faellig)} />
                ))}
              </div>
            </section>
          )}

          <section className="lfa-panel">
            <h2 className="lfa-h2">Passende Gegenstücke</h2>
            {l.rolle === "keine" ? (
              <p className="lfa-klein">Diese Anfrage nimmt nicht am Matching teil. Rechts unter „Angaben fürs Matching“ lässt sie sich als Angebot oder Gesuch einordnen.</p>
            ) : eigeneKandidaten.length === 0 ? (
              <p className="lfa-klein">
                Noch kein passendes {l.rolle === "angebot" ? "Gesuch" : "Angebot"}.
                {orte.punkte.length === 0 ? " Der Ort ist noch nicht aufgelöst — siehe rechts." : ""}
              </p>
            ) : (
              <ul className="lfa-protokoll">
                {eigeneKandidaten.map((k) => {
                  const gegen = k.angebot.id === l.id ? k.gesuch : k.angebot;
                  return (
                    <li key={k.key} style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                      <Link href={`/admin/matching?anfrage=${l.id}#${k.key}`} className="lfa-link-name" title="Paar im Matching öffnen: Hinweise, Zustimmungen, Freigabe">
                        {gegen.name}
                      </Link>
                      <span className="lfa-klein">
                        {ROLLE_LABEL[gegen.rolle]} · {gegen.typ} · {gegen.ortText || "Ort offen"}
                        {k.score != null ? ` · ${k.score} %` : ""}
                        {k.distanzKm != null ? ` · ${k.distanzKm} km` : ""}
                      </span>
                      <span className="lfa-badge lfa-badge-keine" title={MATCH_STATUS[k.meta?.status ?? "vorschlag"].tipp}>
                        {MATCH_STATUS[k.meta?.status ?? "vorschlag"].label}
                      </span>
                      {k.meta && <VorgangLink k={k.key} text="Vorgang" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section className="lfa-panel">
            <h2 className="lfa-h2">Bearbeitung</h2>
            <form action={anfrageSpeichern} className="lfa-formraster">
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="bereich" value="bearbeitung" />
              <label className="lfa-breit">
                <span className="field-label">Status</span>
                <select name="status" defaultValue={l.status} className="field-select" title="Bearbeitungsstand. „Erledigt“ und „Archiv“ nehmen die Anfrage aus dem Matching.">
                  {(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>{LEAD_STATUS[s].label} — {LEAD_STATUS[s].tipp}</option>
                  ))}
                </select>
              </label>
              <label className="lfa-breit">
                <span className="field-label">Notiz (nur intern)</span>
                <textarea
                  name="notiz"
                  defaultValue={l.meta.notiz ?? ""}
                  className="field-textarea"
                  placeholder="z. B. telefoniert am …, Preisvorstellung, Pächter, nächste Schritte"
                  title="Interne Notiz — nur in der Verwaltung sichtbar, nie für Interessenten"
                />
              </label>
              <div className="lfa-breit">
                <button type="submit" className="lfa-knopf" title="Status und Notiz speichern; die Änderung erscheint im Verlauf">Speichern</button>
              </div>
            </form>
          </section>

          {(l.meta.postfach?.length ?? 0) > 0 && (
            <section className="lfa-panel" id="postfach">
              <h2 className="lfa-h2" title="E-Mails des Kunden an das Anfragenpostfach — vom Postfach-Abgleich (täglich) dieser Anfrage zugeordnet, ohne zitierte frühere Nachrichten">
                {l.meta.postfach!.some((m) => !m.erledigt) && <span className="lfa-puls" />}E-Mails aus dem Postfach
              </h2>
              <ul className="lfa-protokoll">
                {l.meta.postfach!.map((m) => (
                  <li key={m.id}>
                    <span className="lfa-klein">
                      {datumZeit(m.am)} · {m.von}
                      {m.betreff ? ` · „${m.betreff}“` : ""}
                    </span>
                    <div className="lfa-nachricht lfa-ticket-text" title="Text der E-Mail (ohne Zitat)">
                      {m.text || "— kein eigener Text —"}
                    </div>
                    {m.erledigt ? (
                      <div className="lfa-klein" title={`Bearbeitet am ${datumZeit(m.erledigt.am)} von ${m.erledigt.von}`}>
                        {m.erledigt.wie === "spaeter-erfasst"
                          ? "✓ Antwort war schon als Rückmeldung erfasst"
                          : m.erledigt.art
                            ? `✓ Übernommen: ${RUECKMELDUNG_NAME[m.erledigt.art]}`
                            : "✓ Zur Kenntnis genommen"}{" "}
                        ({datumZeit(m.erledigt.am)})
                      </div>
                    ) : (
                      <form action={postfachFormular} className="lfa-formraster" style={{ marginTop: "0.4rem" }}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="mail" value={mailKey(m.id)} />
                        <p className="lfa-klein lfa-breit" style={{ margin: 0 }} title="Aus dem Text der E-Mail abgeleitet — geändert wird erst beim Übernehmen">
                          {m.vorschlag ? "Vorschlag: " : ""}
                          {m.grund}
                          {m.hinweis ? ` · Hinweis: ${m.hinweis}` : ""}
                        </p>
                        <label className="lfa-breit">
                          <span className="field-label">Antwort des Kunden</span>
                          <select name="art" defaultValue={m.vorschlag ?? ""} className="field-select" title="Was hat der Kunde geantwortet? Übernehmen wirkt wie eine Rückmeldung über den Antwort-Link.">
                            <option value="">Bitte wählen …</option>
                            {optionen.map((a) => (
                              <option key={a} value={a}>
                                {RUECKMELDUNG_NAME[a]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="lfa-breit lfa-knopfreihe">
                          <button type="submit" name="aktion" value="uebernehmen" className="lfa-knopf lfa-knopf-klein" title="Übernimmt die gewählte Antwort: Einordnung und Ticket wie beim Antwort-Link, „kein Interesse“ setzt die Anfrage auf „Erledigt“. Es geht keine E-Mail raus.">
                            Übernehmen
                          </button>
                          <button type="submit" name="aktion" value="kenntnis" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Nur abhaken — Einordnung und Status bleiben, wie sie sind. Es geht keine E-Mail raus.">
                            Zur Kenntnis (nichts ändern)
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="lfa-panel" id="rueckmeldung">
            <h2 className="lfa-h2" title="Antwort des Kunden auf die Nachfass-Mail eintragen, wenn sie nicht über den Antwort-Link kam">Rückmeldung erfassen</h2>
            <p className="lfa-klein" style={{ marginTop: 0 }}>
              Kam die Antwort per E-Mail oder WhatsApp? Hier eintragen — wie beim Antwort-Link entsteht ein Ticket im Dashboard; „kein Interesse mehr“ setzt die Anfrage auf „Erledigt“. Es geht keine E-Mail raus.
            </p>
            {rmVor && (
              <p className="lfa-hinweis lfa-hinweis-frage" role="status">
                Vorbereitet aus der Antwort des Kunden: „{RUECKMELDUNG_NAME[rmVor]}“{rmNotizVor ? " mit Notiz" : ""} — bitte prüfen und „Rückmeldung speichern“ klicken.
              </p>
            )}
            <form action={rueckmeldungErfassen} className="lfa-formraster">
              <input type="hidden" name="id" value={l.id} />
              <label className="lfa-breit">
                <span className="field-label">Antwort des Kunden</span>
                <select name="art" required defaultValue={rmVor} className="field-select" title="Was hat der Kunde geantwortet?">
                  <option value="" disabled>
                    Bitte wählen …
                  </option>
                  {optionen.map((a) => (
                    <option key={a} value={a}>
                      {RUECKMELDUNG_NAME[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lfa-breit">
                <span className="field-label">Thema (nur bei Beratung)</span>
                <select name="thema" defaultValue={rmThemaVor || themaVorschlag(l.intent, l.flaechentyp) || ""} className="field-select" title="Nur bei „möchte eine Beratung“: worüber? Ohne Auswahl wird das Thema aus dem Anliegen abgeleitet.">
                  <option value="">—</option>
                  {BERATUNG_THEMEN.map((th) => (
                    <option key={th} value={th}>
                      {th}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lfa-breit">
                <span className="field-label">Notiz zur Antwort (freiwillig)</span>
                <textarea name="notiz" defaultValue={rmNotizVor} className="field-textarea" placeholder="z. B. möchte ab Oktober verpachten, bitte per E-Mail" title="Steht im Ticket und im Verlauf — nur intern" />
              </label>
              <div className="lfa-breit">
                <button type="submit" className="lfa-knopf" title="Speichert die Rückmeldung: Ticket im Dashboard bzw. „Erledigt“ bei „kein Interesse mehr“ — es geht keine E-Mail raus">
                  Rückmeldung speichern
                </button>
              </div>
            </form>
          </section>

          <section className="lfa-panel">
            <h2 className="lfa-h2">Angaben fürs Matching</h2>
            <form action={anfrageSpeichern} className="lfa-formraster">
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="bereich" value="matching" />
              <input type="hidden" name="groesseModus" value={einzel ? "einzel" : "spanne"} />
              <input type="hidden" name="groesseMinAlt" value={minAlt} />
              <input type="hidden" name="groesseMaxAlt" value={maxAlt} />
              <label>
                <span className="field-label">Rolle</span>
                <select name="rolle" defaultValue={l.meta.rolle ?? "auto"} className="field-select" title="Angebot = bietet Fläche an, Gesuch = sucht Fläche. „Automatisch“ nimmt das Anliegen aus dem Formular.">
                  <option value="auto">Automatisch ({ROLLE_LABEL[abgeleitet.rolle]})</option>
                  <option value="angebot">Angebot (bietet Fläche an)</option>
                  <option value="gesuch">Gesuch (sucht Fläche)</option>
                  <option value="keine">Kein Matching</option>
                </select>
              </label>
              <label>
                <span className="field-label">Kauf oder Pacht</span>
                <select
                  name="art"
                  defaultValue={l.meta.art === undefined ? "auto" : (l.meta.art ?? "auto")}
                  className="field-select"
                  title="Nur gleiche Art wird gepaart: Verkauf mit Kaufgesuch, Verpachtung mit Pachtgesuch"
                >
                  <option value="auto">Automatisch ({artLabel(abgeleitet.art) || "offen"})</option>
                  <option value="pacht">Pacht</option>
                  <option value="kauf">Kauf</option>
                </select>
              </label>
              <label>
                <span className="field-label">Flächentyp</span>
                <select name="flaechentyp" defaultValue={l.meta.flaechentyp ?? "auto"} className="field-select" title="Acker und Grünland gelten als verwandt (halbe Punktzahl), Wald und Bauland nur untereinander">
                  <option value="auto">Wie im Formular ({l.flaechentyp})</option>
                  {FLAECHENTYPEN.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              {einzel ? (
                <label>
                  <span className="field-label">Größe in ha</span>
                  <input name="groesseMin" defaultValue={minAlt} inputMode="decimal" className="field-input" placeholder="z. B. 5,2" title="Fläche in Hektar. Leer lassen = aus dem Formular lesen." />
                </label>
              ) : (
                <div className="lfa-formraster" style={{ gap: "0.5rem" }}>
                  <label>
                    <span className="field-label">Gesucht ab (ha)</span>
                    <input name="groesseMin" defaultValue={minAlt} inputMode="decimal" className="field-input" title="Mindestgröße in Hektar; leer = keine Untergrenze" />
                  </label>
                  <label>
                    <span className="field-label">bis (ha)</span>
                    <input name="groesseMax" defaultValue={maxAlt} inputMode="decimal" className="field-input" title="Höchstgröße in Hektar; leer = keine Obergrenze. Gleicher Wert wie „ab“ = ungefähre Wunschgröße." />
                  </label>
                </div>
              )}
              <label className="lfa-breit">
                <span className="field-label">{l.rolle === "gesuch" ? "Suchorte fürs Matching" : "Ort fürs Matching"}</span>
                <input
                  name="ortMatching"
                  defaultValue={l.meta.ortMatching ?? ""}
                  className="field-input"
                  placeholder={l.ort !== "—" ? l.ort : "z. B. Kalletal-Westorf"}
                  title="Nur ausfüllen, wenn die Formularangabe nicht passt. Mehrere Orte mit Komma trennen. Leer = Angabe aus dem Formular."
                />
              </label>
              {l.rolle === "gesuch" && (
                <label>
                  <span className="field-label">Suchradius (km)</span>
                  <input name="radiusKm" defaultValue={l.meta.radiusKm ?? ""} inputMode="numeric" className="field-input" placeholder="20" title="Wie weit darf die Fläche von den Suchorten entfernt sein? Leer = 20 km." />
                </label>
              )}
              <div className="lfa-breit">
                <button type="submit" className="lfa-knopf" title="Matching-Angaben speichern; geänderte Orte werden sofort nachgeschlagen">Speichern</button>
              </div>
            </form>

            <div style={{ marginTop: "1rem" }}>
              <span className="field-label">Ort aufgelöst</span>
              {orte.punkte.length === 0 && orte.offen.length === 0 && orte.unbekannt.length === 0 ? (
                <p className="lfa-klein">Kein Ort angegeben.</p>
              ) : (
                <ul className="lfa-protokoll">
                  {orte.punkte.map((p) => (
                    <li key={p.teil}>
                      <strong>{p.teil}</strong> <span className="lfa-klein">→ {p.name}</span>
                    </li>
                  ))}
                  {orte.offen.map((t) => (
                    <li key={t}>
                      <strong>{t}</strong> <span className="lfa-klein">→ noch nicht nachgeschlagen</span>
                    </li>
                  ))}
                  {orte.unbekannt.map((t) => (
                    <li key={t}>
                      <strong>{t}</strong> <span className="lfa-klein">→ nicht gefunden — oben einen eindeutigeren Ort eintragen</span>
                    </li>
                  ))}
                </ul>
              )}
              {(orte.punkte.length > 0 || orte.offen.length > 0 || orte.unbekannt.length > 0) && (
                <form action={ortNeuSuchen} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Ort(e) dieser Anfrage bei OpenStreetMap neu nachschlagen, z. B. wenn ein falscher Ort gleichen Namens gefunden wurde">
                    Ort neu suchen
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="lfa-panel">
            <h2 className="lfa-h2">Verlauf der Anfrage</h2>
            {verlauf.length === 0 ? (
              <p className="lfa-klein">Noch keine Änderungen.</p>
            ) : (
              <ul className="lfa-protokoll">
                {verlauf.map((p, i) => (
                  <li key={i}>
                    <span className="lfa-klein">{datumZeit(p.am)} · {p.von}</span>
                    <div>{p.was}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
