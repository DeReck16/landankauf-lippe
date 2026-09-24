import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten, punkteFuer } from "@/lib/admin/matching";
import { LEAD_STATUS, MATCH_STATUS, ableitenAusAnliegen, formatGroesse, parseGroesse, type LeadStatus } from "@/lib/admin/model";
import { ROLLE_LABEL, ROLLE_TIPP, artLabel, datumZeit } from "@/lib/admin/format";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { anfrageSpeichern, ortNeuSuchen } from "../../../actions";

export const metadata: Metadata = { title: "Anfrage" };

function zahlFeld(v: number | null | undefined): string {
  return v == null ? "" : String(v).replace(".", ",");
}

export default async function AnfragePage(props: PageProps<"/admin/anfrage/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const { leads, zustand } = await ladeVerwaltung();
  const l = leads.find((x) => x.id === id);
  if (!l) notFound();

  const abgeleitet = ableitenAusAnliegen(l.intent);
  const geparst = parseGroesse(l.groesse);
  const orte = punkteFuer(l, zustand.orte);
  const eigeneKandidaten = findeKandidaten(leads, zustand).kandidaten.filter(
    (k) => k.angebot.id === l.id || k.gesuch.id === l.id,
  );
  const verlauf = zustand.protokoll.filter((p) => p.ref === l.id || p.ref?.split("~").includes(l.id)).slice(0, 30);
  const einzel = l.rolle !== "gesuch";
  const minAlt = zahlFeld(l.groesseWert.minHa);
  const maxAlt = einzel ? minAlt : zahlFeld(l.groesseWert.maxHa);

  return (
    <>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/admin" className="lfa-klein" title="Zurück zur Liste aller Anfragen">← Alle Anfragen</Link>
      </p>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">{l.name}</h1>
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
                    <li key={k.key}>
                      <Link href={`/admin/matching?anfrage=${l.id}#${k.key}`} className="lfa-link-name" title="Paar im Matching öffnen: anonyme Hinweistexte, Zustimmungen, Kontakt">
                        {gegen.name}
                      </Link>{" "}
                      <span className="lfa-klein">
                        {ROLLE_LABEL[gegen.rolle]} · {gegen.typ} · {gegen.ortText || "Ort offen"}
                        {k.score != null ? ` · ${k.score} %` : ""}
                        {k.distanzKm != null ? ` · ${k.distanzKm} km` : ""}
                      </span>{" "}
                      <span className="lfa-badge lfa-badge-keine" title={MATCH_STATUS[k.meta?.status ?? "vorschlag"].tipp}>
                        {MATCH_STATUS[k.meta?.status ?? "vorschlag"].label}
                      </span>
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
            <h2 className="lfa-h2">Verlauf</h2>
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

