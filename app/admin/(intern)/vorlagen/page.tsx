import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { datumZeit } from "@/lib/admin/format";
import { grabsteine } from "@/lib/admin/loeschen";
import { ladePortal } from "@/lib/admin/neu";
import { readZustand } from "@/lib/admin/store";
import * as M from "@/lib/portal/model";
import { REGELN, automatikVon, regelWirksam } from "@/lib/portal/automatik-regeln";
import { VORLAGEN, VORLAGEN_REIHENFOLGE, aktuelleFreigabe, vorlageHash } from "@/lib/vertraege/vorlagen";
import {
  automatikEinstellungAktion,
  automatikJetztAktion,
  bewertungEinstellungAktion,
  gutscheinEinstellungAktion,
  konditionenAktion,
  vorlageFreigebenAktion,
  vorlageZurueckziehenAktion,
} from "../../portal-actions";
import { alleSitzungenBeendenAktion } from "../../actions";
import BestaetigenKnopf from "../BestaetigenKnopf";
import AlleFreigeben from "../AlleFreigeben";
import { Meldung } from "../teile";

export const metadata: Metadata = { title: "Vorlagen & Einstellungen" };

function zahl(n: number): string {
  return String(n).replace(".", ",");
}

export default async function VorlagenPage(props: PageProps<"/admin/vorlagen">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const [{ einstellungen: e }, { zustand }] = await Promise.all([ladePortal(), readZustand()]);
  const geloescht = grabsteine(zustand);
  const k = M.aktuelleKonditionen(e);
  const zurueck = "/admin/vorlagen";
  const envUrl = process.env.GOOGLE_REVIEW_URL || "";
  const bewertungsUrl = M.bewertungsUrl(e, envUrl);
  const auto = automatikVon(e.automatik);

  return (
    <>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Vorlagen &amp; Einstellungen</h1>
          <p className="lfa-unterzeile">
            Eine Vertragsvorlage ist erst nutzbar, wenn genau diese Version freigegeben ist. Ändert sich der Text im Code, ändert sich die Prüfsumme — dann ist eine neue Freigabe nötig. Bitte jede Vorlage vor der Freigabe anwaltlich prüfen lassen.
          </p>
        </div>
      </div>
      <Meldung sp={sp} />
      <AlleFreigeben e={e} zurueck={zurueck} />

      {VORLAGEN_REIHENFOLGE.map((id) => {
        const v = VORLAGEN[id];
        const hash = vorlageHash(id);
        const frei = aktuelleFreigabe(e, id);
        const verlauf = e.freigaben[id] ?? [];
        return (
          <section key={id} className="lfa-panel" id={id}>
            <div className="lfa-titelzeile" style={{ marginBottom: "0.5rem" }}>
              <div>
                <h2 className="lfa-h2" style={{ marginBottom: "0.25rem" }}>{v.titel}</h2>
                <p className="lfa-klein">
                  {id} · Version {v.version} · Prüfsumme <span title={hash}>{hash.slice(0, 16)}…</span> · {v.varianten.length} Textvariante{v.varianten.length === 1 ? "" : "n"}
                </p>
              </div>
              <span className={`lfa-badge lfa-badge-lang ${frei ? "lfa-badge-ok" : "lfa-badge-rot"}`} title={frei ? "Diese Version darf unterschrieben werden" : "Nicht freigegeben — niemand kann diese Vorlage unterschreiben"}>
                {frei ? `freigegeben ${datumZeit(frei.am)} von ${frei.von}` : "nicht freigegeben"}
              </span>
            </div>
            <p style={{ marginBottom: "0.75rem" }}>{v.beschreibung}</p>
            <div className="lfa-knopfreihe">
              <Link href={`/admin/vorlagen/${id}`} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Zeigt den vollständigen Text aller Varianten mit Platzhaltern — genau das, was freigegeben wird">
                Volltext ansehen
              </Link>
              {!frei ? (
                <form action={vorlageFreigebenAktion} className="lfa-knopfreihe">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="zurueck" value={zurueck} />
                  <label className="lfa-check" title="Pflicht: ohne diesen Haken ist keine Freigabe möglich">
                    <input type="checkbox" name="geprueft" value="1" required />
                    <span>Ich habe diese Version geprüft bzw. anwaltlich prüfen lassen.</span>
                  </label>
                  <BestaetigenKnopf
                    className="lfa-knopf lfa-knopf-klein"
                    frage={`„${v.titel}“ (Version ${v.version}) freigeben? Ab sofort können Kunden diesen Text online unterschreiben. Vorher anwaltlich prüfen lassen!`}
                    tipp="Gibt genau diese Version zur Unterschrift frei — vorher anwaltlich prüfen lassen"
                  >
                    Vorlage freigeben
                  </BestaetigenKnopf>
                </form>
              ) : (
                <form action={vorlageZurueckziehenAktion}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="zurueck" value={zurueck} />
                  <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Freigabe zurückziehen? Neue Unterschriften sind dann nicht mehr möglich; bereits unterschriebene Verträge bleiben gültig." tipp="Sperrt die Vorlage für neue Unterschriften (bestehende Verträge bleiben)">
                    Freigabe zurückziehen
                  </BestaetigenKnopf>
                </form>
              )}
            </div>
            {verlauf.length > 0 && (
              <details className="lfa-details" style={{ marginTop: "0.6rem" }}>
                <summary title="Alle bisherigen Freigaben dieser Vorlage">Freigabe-Verlauf ({verlauf.length})</summary>
                <ul className="lfa-verlauf">
                  {verlauf.map((f, i) => (
                    <li key={i}>
                      Version {f.version} ({f.hash.slice(0, 12)}…) freigegeben {datumZeit(f.am)} von {f.von}
                      {f.zurueckgezogen ? ` · zurückgezogen ${datumZeit(f.zurueckgezogen.am)} von ${f.zurueckgezogen.von}` : ""}
                      {f.version !== v.version || f.hash !== hash ? " · (ältere Textfassung)" : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      <section className="lfa-panel" id="konditionen">
        <h2 className="lfa-h2">Provisionskonditionen (nur Suchende zahlen)</h2>
        <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
          Aktuell Nr. {k.version}: Pacht = {M.konditionenText("pacht", k)} ({M.bruttoText("pacht", k)}); Kauf = {M.konditionenText("kauf", k)} ({M.bruttoText("kauf", k)}). Eine Änderung gilt nur für künftig unterschriebene Verträge — jeder Vertrag speichert seine Konditionen samt Nummer.
        </p>
        <form action={konditionenAktion} className="lfa-inline">
          <input type="hidden" name="zurueck" value={zurueck} />
          <label>
            Pacht: Jahrespachten
            <input name="pachtJahrespachten" defaultValue={zahl(k.pachtJahrespachten)} inputMode="decimal" className="field-input" title="Vielfaches der vollen Jahrespacht (Standard 1)" />
          </label>
          <label>
            USt bei Pacht
            <select name="ustPacht" defaultValue={k.ust.pacht} className="field-select" title="Ob die Pachtprovision netto zzgl. USt oder inkl. USt gilt (Standard: zzgl.)">
              <option value="zuzueglich">zzgl. USt</option>
              <option value="inklusive">inkl. USt</option>
            </select>
          </label>
          <label>
            Kauf: % vom Kaufpreis
            <input name="kaufProzent" defaultValue={zahl(k.kaufProzent)} inputMode="decimal" className="field-input" title="Prozent vom beurkundeten Kaufpreis (Standard 3,59)" />
          </label>
          <label>
            USt bei Kauf
            <select name="ustKauf" defaultValue={k.ust.kauf} className="field-select" title="Ob der Kaufprovisionssatz netto zzgl. USt oder inkl. USt gilt (Standard: zzgl.)">
              <option value="zuzueglich">zzgl. USt</option>
              <option value="inklusive">inkl. USt</option>
            </select>
          </label>
          <label>
            USt-Satz (%)
            <input name="ustProzent" defaultValue={zahl(k.ustProzent)} inputMode="decimal" className="field-input" title="Gesetzlicher Umsatzsteuersatz (derzeit 19 %)" />
          </label>
          <BestaetigenKnopf className="lfa-knopf lfa-knopf-klein" frage="Konditionen speichern? Sie gelten nur für künftig unterschriebene Verträge." tipp="Speichert neue Konditionen als neue Nummer — bestehende Verträge behalten ihre Konditionen">
            Speichern
          </BestaetigenKnopf>
        </form>
        {e.konditionenVerlauf?.length ? (
          <details className="lfa-details" style={{ marginTop: "0.6rem" }}>
            <summary title="Frühere Konditionen">Frühere Konditionen ({e.konditionenVerlauf.length})</summary>
            <ul className="lfa-verlauf">
              {e.konditionenVerlauf.map((x) => (
                <li key={`${x.version}-${x.am}`}>
                  Nr. {x.version}: Pacht {M.konditionenText("pacht", x.konditionen)}; Kauf {M.konditionenText("kauf", x.konditionen)} — abgelöst {datumZeit(x.am)} von {x.von}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="lfa-panel" id="bewertung">
        <h2 className="lfa-h2">Bitte um Google-Bewertung</h2>
        <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
          Nach einem Abschluss sehen beide Seiten im Kundenbereich einen Dank mit „Bei Google bewerten“; nach einigen Tagen steht eine Follow-up-Mail als Entwurf bereit. Ohne jeden Anreiz, an alle Abschlüsse, ohne vorherige Zufriedenheitsabfrage und ohne Vorgaben zu Sternen oder Inhalt (Google-Richtlinie, § 5 UWG).
        </p>
        {!bewertungsUrl && <p className="lfa-hinweis">Google-Profil anlegen, Bewertungslink hinterlegen — ohne Link wird keine Bitte angezeigt.</p>}
        <form action={bewertungEinstellungAktion} className="lfa-inline">
          <input type="hidden" name="zurueck" value={zurueck} />
          <label style={{ flex: "2 1 18rem" }}>
            Bewertungslink (https://…)
            <input name="url" defaultValue={e.bewertung?.url ?? ""} placeholder={envUrl || "https://g.page/r/…/review"} className="field-input" title="Link zum Bewerten im Google-Unternehmensprofil. Leer = Umgebungsvariable GOOGLE_REVIEW_URL." />
          </label>
          <label>
            Follow-up nach Tagen
            <input name="nachTagen" defaultValue={e.bewertung?.nachTagen ?? 3} inputMode="numeric" className="field-input" title="Frühestens so viele Tage nach dem Abschluss erscheint der Mail-Entwurf (Standard 3)" />
          </label>
          <label className="lfa-check" style={{ flex: "2 1 16rem" }} title="Wenn eingeschaltet, verschickt ein täglicher Automatiklauf fällige Bewertungsbitten selbst. Standard: aus — dann nur per Klick im Entwurf.">
            <input type="checkbox" name="autoVersand" value="1" defaultChecked={Boolean(e.bewertung?.autoVersand)} />
            <span>Fällige Follow-up-Mails automatisch senden (täglich)</span>
          </label>
          <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Einstellungen zur Bewertungsbitte speichern">Speichern</button>
        </form>
      </section>

      <section className="lfa-panel" id="gutschein">
        <h2 className="lfa-h2">Treue-Gutschein fürs nächste Geschäft</h2>
        <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
          Bei jedem erfolgreichen Abschluss erhält der Provisionszahler einen Gutschein, der auf seine nächste Provision angerechnet wird (Preisnachlass, nicht übertragbar, keine Barauszahlung, gültig bis Ende des dritten Kalenderjahres). Er ist nie an eine Bewertung gekoppelt und wird getrennt von der Bewertungsbitte mitgeteilt.
        </p>
        <form action={gutscheinEinstellungAktion} className="lfa-inline">
          <input type="hidden" name="zurueck" value={zurueck} />
          <label className="lfa-check" title="Ausgabe neuer Gutscheine ein- oder ausschalten; bereits ausgegebene bleiben gültig">
            <input type="checkbox" name="aktiv" value="1" defaultChecked={Boolean(e.gutschein?.aktiv)} />
            <span>Gutscheine ausgeben</span>
          </label>
          <label>
            Betrag (€, brutto)
            <input name="betrag" defaultValue={zahl(e.gutschein?.betrag ?? 100)} inputMode="decimal" className="field-input" title="Wert des Gutscheins (Standard 100 €)" />
          </label>
          <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Einstellung zum Treue-Gutschein speichern">Speichern</button>
        </form>
      </section>

      <section className="lfa-panel" id="automatik">
        <h2 className="lfa-h2">Automatik</h2>
        <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
          Die Automatik erledigt Schritte, die sonst auf Ihren Klick warten — mit denselben Prüfungen wie die Knöpfe; sie überspringt keinen der sieben Schritte. Sie läuft nach Kundenhandlungen (Angaben, Unterschrift, Zustimmung) und einmal täglich am Morgen. Jede Regel ist einzeln schaltbar; Standard ist alles aus. Im Probelauf wird nur protokolliert, was passieren würde (Dashboard „Automatisch erledigt“). Kauf-Vorgänge sind ausgenommen (R3–R7 nur Pacht).
        </p>
        <form action={automatikEinstellungAktion} className="lfa-form" style={{ display: "grid", gap: "0.6rem" }}>
          <input type="hidden" name="zurueck" value={zurueck} />
          <div className="lfa-knopfreihe">
            <label className="lfa-check" title="Not-Aus: Es läuft gar nichts, auch kein Probelauf — unabhängig von den einzelnen Regeln">
              <input type="checkbox" name="notAus" value="1" defaultChecked={auto.notAus} />
              <span>
                <strong>Not-Aus</strong>
              </span>
            </label>
            <label className="lfa-check" title="Probelauf: nichts senden und nichts ändern, nur protokollieren, was passieren würde (empfohlen für die ersten 1–2 Wochen)">
              <input type="checkbox" name="probelauf" value="1" defaultChecked={auto.probelauf} />
              <span>Probelauf (nur protokollieren)</span>
            </label>
            <label className="lfa-check" title="Täglich eine Zusammenfassung des Vortags an die Verwaltungsadressen">
              <input type="checkbox" name="zusammenfassung" value="1" defaultChecked={auto.zusammenfassung} />
              <span>Tägliche Zusammenfassung</span>
            </label>
          </div>
          <div className="lfa-knopfreihe">
            <label title="Höchstens so viele automatische Kunden-Mails je Tag (alle Regeln zusammen); der Rest folgt am nächsten Tag">
              Tageslimit Mails
              <input name="tageslimit" defaultValue={auto.tageslimit} inputMode="numeric" className="field-input" style={{ maxWidth: "6rem" }} />
            </label>
            <label title="R2: Paare ab dieser Übereinstimmung (50–100 %) vormerken">
              Schwelle R2 (%)
              <input name="schwelle" defaultValue={auto.schwelle} inputMode="numeric" className="field-input" style={{ maxWidth: "6rem" }} />
            </label>
          </div>
          <fieldset className="lfa-feldgruppe" style={{ display: "grid", gap: "0.45rem" }}>
            <legend className="field-label">Regeln</legend>
            {REGELN.map((r) => {
              const w = regelWirksam(auto, r.id);
              return (
                <label key={r.id} className="lfa-check" title={r.beschreibung}>
                  <input type="checkbox" name={`regel_${r.id}`} value="1" defaultChecked={auto.regeln[r.id]} />
                  <span>
                    <strong>{r.titel}</strong>
                    <span className="lfa-klein" style={{ display: "block" }}>
                      {r.beschreibung} {auto.regeln[r.id] && !w.an ? `— derzeit ${w.grund}.` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <fieldset className="lfa-feldgruppe" style={{ display: "grid", gap: "0.45rem" }}>
            <legend className="field-label">Rechtliche Voraussetzungen für R4 und R5 (nur von Dennis zu bestätigen)</legend>
            <label className="lfa-check" title="Die Erlaubnis nach § 34c GewO für die Vermittlung von Grundstücksverträgen liegt vor">
              <input type="checkbox" name="recht34c" value="1" defaultChecked={auto.recht34c} />
              <span>§ 34c-Erlaubnis liegt vor</span>
            </label>
            <label className="lfa-check" title="Alle Vertragsvorlagen in der aktuellen Fassung sind anwaltlich geprüft">
              <input type="checkbox" name="vorlagenGeprueft" value="1" defaultChecked={auto.vorlagenGeprueft} />
              <span>Vorlagen anwaltlich geprüft</span>
            </label>
          </fieldset>
          <div className="lfa-knopfreihe">
            <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Automatik-Einstellungen speichern — die Änderung steht im Verlauf">
              Speichern
            </button>
            {auto.geaendert && <span className="lfa-klein">Zuletzt geändert {datumZeit(auto.geaendert.am)} von {auto.geaendert.von}</span>}
          </div>
        </form>
        <form action={automatikJetztAktion} style={{ marginTop: "0.6rem" }}>
          <input type="hidden" name="zurueck" value={zurueck} />
          <BestaetigenKnopf className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" frage="Automatik jetzt einmal laufen lassen (wie der tägliche Lauf)?" tipp="Führt die eingeschalteten Regeln jetzt aus — im Probelauf wird nur protokolliert. Ergebnis im Dashboard unter „Automatisch erledigt“.">
            Jetzt einmal laufen lassen
          </BestaetigenKnopf>
        </form>
      </section>

      <section className="lfa-panel" id="sicherheit">
        <h2 className="lfa-h2">Sicherheit</h2>
        <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
          Gerät verloren oder Anmeldelink an eine falsche Adresse gegangen? „Alle Sitzungen beenden“ meldet alle Geräte aller Verwaltungs-Zugänge ab. Dieses Gerät bleibt angemeldet (es bekommt sofort eine neue Sitzung); alle anderen brauchen einen neuen Anmeldelink.
        </p>
        <form action={alleSitzungenBeendenAktion}>
          <BestaetigenKnopf className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" frage="Wirklich alle anderen Sitzungen der Verwaltung beenden?" tipp="Meldet alle anderen Geräte ab (alle Admins). Es geht keine E-Mail raus.">
            Alle Sitzungen beenden
          </BestaetigenKnopf>
        </form>
      </section>

      <section className="lfa-panel" id="geloescht">
        <h2 className="lfa-h2" title="Endgültig gelöschte Vorgänge (Art. 17 DSGVO) — übrig ist nur ein Grabstein ohne Personendaten">Gelöschte Vorgänge</h2>
        {geloescht.length === 0 ? (
          <p className="lfa-klein">Noch keine. Gelöscht wird in der Anfrage unter „Datenschutz“ mit „Vorgang endgültig löschen (DSGVO)“.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="lfa-liste">
              <thead>
                <tr>
                  <th>Vorgang</th>
                  <th title="Monat des Eingangs">Eingang</th>
                  <th>Art</th>
                  <th>Gelöscht</th>
                  <th title="Wegen Aufbewahrungspflicht nur gesperrt — bis zu diesem Tag, danach löschen">Gesperrt bis</th>
                </tr>
              </thead>
              <tbody>
                {geloescht.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/admin/anfrage/${g.id}`} title="Grabstein öffnen: was gelöscht und was nur gesperrt ist">
                        {g.id}
                      </Link>
                      {g.stand !== "fertig" && <span className="lfa-badge lfa-badge-rot" title="Nicht vollständig gelöscht — im Grabstein „Löschen fortsetzen“">unvollständig</span>}
                    </td>
                    <td>{g.monat.split("-").reverse().join("/")}</td>
                    <td>{g.art}</td>
                    <td>
                      {datumZeit(g.geloeschtAm)} · {g.geloeschtVon}
                    </td>
                    <td>{g.gesperrt.length ? g.gesperrt.map((p) => p.bis).sort().at(-1)!.split("-").reverse().join(".") : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} title="Summe aller gelöschten Vorgänge">
                    <strong>Summe: {geloescht.length} gelöscht</strong>
                    {` · ${geloescht.filter((g) => g.gesperrt.length).length} mit gesperrten Unterlagen`}
                    {geloescht.some((g) => g.stand !== "fertig") ? ` · ${geloescht.filter((g) => g.stand !== "fertig").length} unvollständig` : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
