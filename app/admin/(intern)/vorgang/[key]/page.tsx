import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { MATCH_STATUS } from "@/lib/admin/model";
import { datumZeit } from "@/lib/admin/format";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import FlaechenEditor from "@/components/portal/FlaechenEditor";
import VertragsText from "@/components/vertrag/VertragsText";
import { entwuerfeKunde, entwuerfePaar } from "@/lib/portal/entwuerfe";
import * as M from "@/lib/portal/model";
import { basisUrl } from "@/lib/portal/sitzung";
import { datumDe, tagDe } from "@/lib/portal/texte";
import {
  freigabePruefung,
  kaufDokument,
  kaufVorschlag,
  ladeVorgangKontext,
  pachtDokument,
  pachtLuecken,
  pachtVorschlag,
  type VorgangKontext,
} from "@/lib/portal/vorgang";
import { istFreigegeben } from "@/lib/vertraege/vorlagen";
import {
  externErfassenAktion,
  freigabeZurueckziehenAktion,
  freigebenAktion,
  gutscheinAnrechnenAktion,
  gutscheinStornierenAktion,
  kaufAbbrechenAktion,
  kaufBeurkundetAktion,
  kaufNotarAktion,
  kaufSpeichernAktion,
  kaufWirksamAktion,
  kaufZurBestaetigungAktion,
  kaufZurueckAktion,
  pachtAnzeigeAktion,
  pachtReparierenAktion,
  pachtSpeichernAktion,
  pachtZurUnterschriftAktion,
  pachtZurueckAktion,
  provisionStatusAktion,
  zustimmungErfassenAktion,
} from "../../../portal-actions";
import BestaetigenKnopf from "../../BestaetigenKnopf";
import GesehenMarker from "../../GesehenMarker";
import MailEntwurf from "../../MailEntwurf";
import { DokumentListe, KundenStand, Meldung, Verlauf } from "../../teile";

export const metadata: Metadata = { title: "Vorgang" };

type Portal = Awaited<ReturnType<typeof ladePortal>>;

function Hidden({ ctx, zurueck }: { ctx: VorgangKontext; zurueck: string }) {
  return (
    <>
      <input type="hidden" name="key" value={ctx.key} />
      <input type="hidden" name="art" value={ctx.art} />
      <input type="hidden" name="zurueck" value={zurueck} />
    </>
  );
}

function zahl(n: number | null | undefined): string {
  return n == null ? "" : String(n).replace(".", ",");
}

// ---------------------------------------------------------------------------

function PachtPanel({ ctx, portal, zurueck }: { ctx: VorgangKontext; portal: Portal; zurueck: string }) {
  const v = ctx.vorgang;
  const pv = v?.pachtvertrag;
  const frei = M.aktiveFreigabe(v);
  const vorlageFrei = istFreigegeben(portal.einstellungen, "pachtvertrag");
  const daten = pv && pv.status !== "verworfen" ? pv.daten : pachtVorschlag(ctx);
  const bearbeitbar = !pv || pv.status === "entwurf" || pv.status === "verworfen";
  const luecken = pachtLuecken(daten);
  const jp = M.jahrespacht(daten);
  const mp = M.massgeblicheJahrespacht(daten);
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  const prov = M.provisionBerechnen("pacht", mp, konditionen ?? M.aktuelleKonditionen(portal.einstellungen));
  const warnFernabsatz = ctx.anbieter?.stammdaten?.eigenschaft === "unternehmer" && ctx.suchender?.stammdaten?.eigenschaft === "verbraucher";

  return (
    <section className="lfa-panel" id="pachtvertrag">
      <h2 className="lfa-h2">Landpachtvertrag</h2>
      {!frei && <p className="lfa-hinweis">Den Pachtvertrag können Sie vorbereiten; zur Unterschrift geht er erst nach der Freigabe.</p>}
      {!vorlageFrei && <p className="lfa-hinweis lfa-hinweis-fehler">Die Vorlage „Landpachtvertrag“ ist noch nicht freigegeben (Verwaltung → Vorlagen).</p>}
      {warnFernabsatz && (
        <p className="lfa-hinweis lfa-hinweis-fehler" title="Verbraucherverträge im Fernabsatz: Widerrufsrecht des Pächters möglich (§§ 312c, 312g BGB)">
          Achtung: Verpächter handelt als Unternehmer, Pächter als Verbraucher. Dann kann der Pächter den online geschlossenen Pachtvertrag ggf. widerrufen (Fernabsatz). Vor der Unterschrift anwaltlich klären oder den Vertrag außerhalb der Plattform schließen.
        </p>
      )}
      <p className="lfa-klein" style={{ marginBottom: "0.5rem" }}>
        Stand: <strong>{pv ? { entwurf: "Entwurf", zur_unterschrift: "liegt zur Unterschrift vor", abgeschlossen: "abgeschlossen", verworfen: "verworfen" }[pv.status] : "noch nicht vorbereitet"}</strong>
        {pv?.geaendertAm ? ` · zuletzt geändert ${datumZeit(pv.geaendertAm)}` : ""}
        {pv?.textHash ? ` · SHA-256 ${pv.textHash.slice(0, 16)}…` : ""}
      </p>
      <p className="lfa-klein" style={{ marginBottom: "0.75rem" }}>
        Volle Jahrespacht: <strong>{M.euro(jp)}</strong> · maßgeblich für die Provision: <strong>{M.euro(mp)}</strong>
        {daten.staffel.length ? " (Durchschnitt der ersten fünf Pachtjahre wegen Staffel)" : ""} · Provision {konditionen ? `nach Vertrag des Suchenden (Konditionen Nr. ${konditionen.version})` : "(Vorschau mit aktuellen Konditionen — Suchender hat noch nicht unterschrieben)"}: <strong>{M.euro(prov.netto)} netto / {M.euro(prov.brutto)} brutto</strong>
      </p>

      {pv?.status === "zur_unterschrift" && (
        <div className="lfa-abschnitt">
          <ul className="lfa-pruefliste">
            <li className={pv.unterschriften.verpaechter ? "lfa-ok" : undefined}>
              Verpächter {pv.unterschriften.verpaechter ? `hat unterschrieben (${datumZeit(pv.unterschriften.verpaechter.am)}, „${pv.unterschriften.verpaechter.name}“)` : "hat noch nicht unterschrieben"}
            </li>
            <li className={pv.unterschriften.paechter ? "lfa-ok" : undefined}>
              Pächter {pv.unterschriften.paechter ? `hat unterschrieben (${datumZeit(pv.unterschriften.paechter.am)}, „${pv.unterschriften.paechter.name}“)` : "hat noch nicht unterschrieben"}
            </li>
          </ul>
          <div className="lfa-knopfreihe">
            <form action={pachtZurueckAktion}>
              <Hidden ctx={ctx} zurueck={zurueck} />
              <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Zurück zum Entwurf? Bereits geleistete Unterschriften werden ungültig und müssen neu erfolgen." tipp="Macht den Vertrag wieder bearbeitbar; vorhandene Unterschriften verfallen">
                Zurück zum Entwurf
              </BestaetigenKnopf>
            </form>
            <form action={pachtZurueckAktion}>
              <Hidden ctx={ctx} zurueck={zurueck} />
              <input type="hidden" name="verwerfen" value="1" />
              <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Pachtvertrag verwerfen? Unterschriften verfallen." tipp="Verwirft den Pachtvertrag (z. B. wenn die Parteien sich nicht einig werden)">
                Verwerfen
              </BestaetigenKnopf>
            </form>
          </div>
        </div>
      )}

      {pv?.status === "abgeschlossen" && (
        <div className="lfa-abschnitt">
          <p>
            Abgeschlossen am <strong>{datumZeit(pv.abgeschlossenAm ?? "")}</strong> — das PDF liegt unten in den Dokumenten; beide Seiten haben es per E-Mail erhalten.
          </p>
          <p className="lfa-klein">
            Anzeige nach § 2 LPachtVG (Pflicht des Verpächters, binnen eines Monats; Flächen bis 1 ha ausgenommen):{" "}
            {pv.anzeigeErledigtAm ? `erledigt vermerkt am ${datumDe(pv.anzeigeErledigtAm)}` : "noch nicht als erledigt vermerkt"}
          </p>
          <div className="lfa-knopfreihe" style={{ marginTop: "0.4rem" }}>
            {!pv.anzeigeErledigtAm && (
              <form action={pachtAnzeigeAktion}>
                <Hidden ctx={ctx} zurueck={zurueck} />
                <button type="submit" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Vermerkt, dass der Verpächter die Pachtanzeige erledigt hat — die Erinnerung verschwindet">
                  Pachtanzeige erledigt
                </button>
              </form>
            )}
            {!ctx.vorgang?.dokumente.some((d) => d.id === pv.dokumentId) && (
              <form action={pachtReparierenAktion}>
                <Hidden ctx={ctx} zurueck={zurueck} />
                <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Das PDF oder die Provision fehlt (Abbruch beim Abschluss) — jetzt nachholen">
                  PDF und Provision nachholen
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {bearbeitbar && (
        <form action={pachtSpeichernAktion} className="lfa-formraster" style={{ marginTop: "0.5rem" }}>
          <Hidden ctx={ctx} zurueck={zurueck} />
          <label>
            <span className="field-label">Verpächter (Name)</span>
            <input name="vp_name" defaultValue={daten.verpaechter.name} className="field-input" title="Name des Verpächters, wie im Vertrag — aus dem Onboarding vorbelegt" />
          </label>
          <label>
            <span className="field-label">Anschrift Verpächter</span>
            <input name="vp_anschrift" defaultValue={daten.verpaechter.anschrift} className="field-input" title="Straße, PLZ, Ort" />
          </label>
          <label>
            <span className="field-label">Pächter (Name)</span>
            <input name="p_name" defaultValue={daten.paechter.name} className="field-input" title="Name des Pächters — aus dem Onboarding vorbelegt" />
          </label>
          <label>
            <span className="field-label">Anschrift Pächter</span>
            <input name="p_anschrift" defaultValue={daten.paechter.anschrift} className="field-input" title="Straße, PLZ, Ort" />
          </label>
          <label className="lfa-breit">
            <span className="field-label">Betrieb des Pächters (optional)</span>
            <input name="p_betrieb" defaultValue={daten.paechter.betrieb} className="field-input" title="z. B. Hofname oder Firma" />
          </label>
          <div className="lfa-breit">
            <span className="field-label">Pachtflächen</span>
            <FlaechenEditor start={daten.flaechen} nutzungVorschlag={daten.nutzungsart} />
          </div>
          <label>
            <span className="field-label">Nutzungsart</span>
            <input name="nutzungsart" defaultValue={daten.nutzungsart} className="field-input" title="z. B. Ackerland, Grünland" />
          </label>
          <label>
            <span className="field-label">Pachtbeginn</span>
            <input name="pachtBeginn" type="date" defaultValue={daten.pachtBeginn} className="field-input" title="Erster Tag des Pachtverhältnisses" />
          </label>
          <label>
            <span className="field-label">Laufzeit (Pachtjahre)</span>
            <input name="laufzeitJahre" inputMode="numeric" defaultValue={daten.laufzeitJahre ?? ""} className="field-input" placeholder="leer = unbestimmte Zeit" title="Feste Laufzeit in Pachtjahren (1–30). Leer = unbestimmte Zeit mit gesetzlicher Kündigung (§ 594a BGB)." />
          </label>
          <label>
            <span className="field-label">Pachtjahr</span>
            <select name="pachtjahr" defaultValue={daten.pachtjahr} className="field-select" title="Wirtschaftsjahr 1.10.–30.9. (üblich) oder Kalenderjahr">
              <option value="wirtschaftsjahr">1. Oktober bis 30. September</option>
              <option value="kalenderjahr">Kalenderjahr</option>
            </select>
          </label>
          <label>
            <span className="field-label">Pachtzins je ha und Jahr (€)</span>
            <input name="pachtzinsJeHa" inputMode="decimal" defaultValue={zahl(daten.pachtzinsJeHa)} className="field-input" placeholder="z. B. 450" title="Pachtzins je Hektar und Pachtjahr (netto). Die Jahrespacht wird daraus berechnet, wenn unten kein fester Betrag steht." />
          </label>
          <label>
            <span className="field-label">oder fester Betrag je Pachtjahr (€)</span>
            <input name="pachtzinsJahr" inputMode="decimal" defaultValue={zahl(daten.pachtzinsJahr)} className="field-input" placeholder="leer = €/ha × Fläche" title="Volle Jahrespacht (netto) für ein ganzes Pachtjahr — auch bei halbjährlicher Zahlung der Jahresbetrag" />
          </label>
          <label className="lfa-breit">
            <span className="field-label">Staffel (optional)</span>
            <textarea
              name="staffel"
              defaultValue={daten.staffel.map((s) => `${s.pachtjahr}: ${zahl(s.betrag)}`).join("\n")}
              className="field-textarea"
              style={{ minHeight: "4rem" }}
              placeholder={"z. B.\n1: 0\n2: 6000\n3: 9000"}
              title="Nur bei abweichender Jahrespacht einzelner Pachtjahre: je Zeile „Pachtjahr: Betrag“. Für die Provision zählt dann der Durchschnitt der ersten fünf Pachtjahre."
            />
          </label>
          <label>
            <span className="field-label">Zahlweise</span>
            <select name="zahlweise" defaultValue={daten.zahlweise} className="field-select" title="Jährlich oder in zwei Raten">
              <option value="jaehrlich">jährlich</option>
              <option value="halbjaehrlich">halbjährlich (zwei Raten)</option>
            </select>
          </label>
          <label>
            <span className="field-label">Fälligkeit</span>
            <input name="faelligkeit" defaultValue={daten.faelligkeit} className="field-input" placeholder="jeweils im Voraus zum 1. Oktober" title="z. B. „jeweils im Voraus zum 1. Oktober“ oder „nachträglich zum 11. November“" />
          </label>
          <label>
            <span className="field-label">Umsatzsteuer auf die Pacht</span>
            <select name="umsatzsteuer" defaultValue={daten.umsatzsteuer} className="field-select" title="Nur wenn der Verpächter zur Umsatzsteuer optiert hat, kommt USt hinzu">
              <option value="ohne">ohne (Regelfall)</option>
              <option value="zuzueglich">zzgl. USt (Verpächter hat optiert)</option>
            </select>
          </label>
          <label>
            <span className="field-label">Wasser- und Bodenverband trägt</span>
            <select name="wasserverband" defaultValue={daten.wasserverband} className="field-select" title="Wer die Verbandsbeiträge trägt">
              <option value="verpaechter">Verpächter</option>
              <option value="paechter">Pächter</option>
            </select>
          </label>
          <label>
            <span className="field-label">Kontoinhaber (optional)</span>
            <input name="kontoinhaber" defaultValue={daten.kontoinhaber} className="field-input" title="Kontoinhaber für die Pachtzahlung — kann auch leer bleiben" />
          </label>
          <label>
            <span className="field-label">IBAN (optional)</span>
            <input name="iban" defaultValue={daten.iban} className="field-input" autoComplete="off" title="IBAN des Verpächters für die Pachtzahlung — nur eintragen, wenn der Verpächter sie genannt hat" />
          </label>
          <label className="lfa-breit">
            <span className="field-label">Bestehende Verpflichtungen (AUKM, Vertragsnaturschutz …)</span>
            <textarea name="verpflichtungen" defaultValue={daten.verpflichtungen} className="field-textarea" style={{ minHeight: "4rem" }} title="Laufende Förderverpflichtungen auf der Fläche; leer = keine bekannt" />
          </label>
          <label className="lfa-breit">
            <span className="field-label">Besondere Vereinbarungen</span>
            <textarea name="besonderes" defaultValue={daten.besonderes} className="field-textarea" style={{ minHeight: "4rem" }} title="Was die Parteien zusätzlich vereinbart haben (z. B. Zufahrt, Zaun, Übergabe der Ernte) — erscheint im Vertrag" />
          </label>
          <div className="lfa-breit lfa-knopfreihe">
            <button type="submit" className="lfa-knopf" title="Speichert den Entwurf (noch keine Unterschrift möglich). Die Vorschau unten aktualisiert sich.">
              Entwurf speichern
            </button>
            {luecken.length > 0 && <span className="lfa-klein">Noch offen: {luecken.join(", ")}</span>}
          </div>
        </form>
      )}

      {pv?.status === "entwurf" && (
        <form action={pachtZurUnterschriftAktion} style={{ marginTop: "0.75rem" }}>
          <Hidden ctx={ctx} zurueck={zurueck} />
          <BestaetigenKnopf
            className="lfa-knopf"
            disabled={!frei || !vorlageFrei || luecken.length > 0}
            frage="Pachtvertrag jetzt beiden Seiten zur Unterschrift vorlegen? Danach ist der Text gesperrt (Änderungen nur über „Zurück zum Entwurf“)."
            tipp={!frei ? "Erst nach der Freigabe" : !vorlageFrei ? "Vorlage erst freigeben" : luecken.length ? `Es fehlen: ${luecken.join(", ")}` : "Sperrt den Text und zeigt den Vertrag beiden Seiten im Kundenbereich zur Unterschrift"}
          >
            Zur Unterschrift freigeben
          </BestaetigenKnopf>
        </form>
      )}

      {(pv || bearbeitbar) && (
        <details className="lfa-details" style={{ marginTop: "0.9rem" }}>
          <summary title="Zeigt den vollständigen Vertragstext mit den aktuellen Angaben — genau so sehen ihn die Parteien">Vorschau des Vertragstexts</summary>
          <div className="lfa-vorschau">
            <VertragsText dok={pachtDokument(ctx.key, daten)} kompakt />
          </div>
        </details>
      )}
    </section>
  );
}

function KaufPanel({ ctx, portal, zurueck }: { ctx: VorgangKontext; portal: Portal; zurueck: string }) {
  const k = ctx.vorgang?.kauf;
  const frei = M.aktiveFreigabe(ctx.vorgang);
  const daten = k && k.status !== "abgebrochen" ? k.daten : kaufVorschlag(ctx);
  const bearbeitbar = !k || k.status === "entwurf" || k.status === "abgebrochen";
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  const vorlageFrei = istFreigegeben(portal.einstellungen, "kaufabsicht");
  const statusText: Record<M.KaufStand["status"], string> = {
    entwurf: "Entwurf",
    zur_bestaetigung: "liegt beiden Seiten zur Bestätigung vor",
    bestaetigt: "von beiden bestätigt — bereit für den Notar",
    beurkundet: "beurkundet — Genehmigung ausstehend",
    wirksam: "wirksam",
    abgebrochen: "abgebrochen",
  };
  return (
    <section className="lfa-panel" id="kauf">
      <h2 className="lfa-h2">Kauf: Kaufabsicht, Notar, Beurkundung</h2>
      <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
        Grundstückskaufverträge brauchen den Notar (§ 311b BGB). Online werden nur die unverbindlichen Eckdaten bestätigt. Stand: <strong>{k ? statusText[k.status] : "noch nicht vorbereitet"}</strong>
        {k?.notar.beurkundetAm ? ` · beurkundet ${tagDe(k.notar.beurkundetAm)}, Kaufpreis ${M.euro(k.notar.kaufpreis)}` : ""}
      </p>
      {!vorlageFrei && <p className="lfa-hinweis lfa-hinweis-fehler">Die Vorlage „Kaufabsicht“ ist noch nicht freigegeben (Verwaltung → Vorlagen).</p>}
      {k?.status === "zur_bestaetigung" && (
        <ul className="lfa-pruefliste">
          <li className={k.bestaetigungen.verkaeufer ? "lfa-ok" : undefined}>Verkäufer {k.bestaetigungen.verkaeufer ? `hat bestätigt (${datumZeit(k.bestaetigungen.verkaeufer.am)})` : "hat noch nicht bestätigt"}</li>
          <li className={k.bestaetigungen.kaeufer ? "lfa-ok" : undefined}>Käufer {k.bestaetigungen.kaeufer ? `hat bestätigt (${datumZeit(k.bestaetigungen.kaeufer.am)})` : "hat noch nicht bestätigt"}</li>
        </ul>
      )}
      {bearbeitbar && (
        <form action={kaufSpeichernAktion} className="lfa-formraster">
          <Hidden ctx={ctx} zurueck={zurueck} />
          <label>
            <span className="field-label">Verkäufer (Name)</span>
            <input name="vk_name" defaultValue={daten.verkaeufer.name} className="field-input" title="Name des Verkäufers" />
          </label>
          <label>
            <span className="field-label">Anschrift Verkäufer</span>
            <input name="vk_anschrift" defaultValue={daten.verkaeufer.anschrift} className="field-input" title="Straße, PLZ, Ort" />
          </label>
          <label>
            <span className="field-label">Käufer (Name)</span>
            <input name="k_name" defaultValue={daten.kaeufer.name} className="field-input" title="Name des Käufers" />
          </label>
          <label>
            <span className="field-label">Anschrift Käufer</span>
            <input name="k_anschrift" defaultValue={daten.kaeufer.anschrift} className="field-input" title="Straße, PLZ, Ort" />
          </label>
          <label className="lfa-breit">
            <span className="field-label">Betrieb des Käufers (optional)</span>
            <input name="k_betrieb" defaultValue={daten.kaeufer.betrieb} className="field-input" title="z. B. Hofname oder Firma" />
          </label>
          <div className="lfa-breit">
            <span className="field-label">Flächen</span>
            <FlaechenEditor start={daten.flaechen} />
          </div>
          <label>
            <span className="field-label">Kaufpreis (Vorstellung, €)</span>
            <input name="kaufpreis" inputMode="decimal" defaultValue={zahl(daten.kaufpreis)} className="field-input" title="Angestrebter Kaufpreis — verbindlich wird er erst beim Notar" />
          </label>
          <label>
            <span className="field-label">Übergabe (Besitz, Nutzen, Lasten)</span>
            <input name="uebergabe" defaultValue={daten.uebergabe} className="field-input" placeholder="z. B. nach der Ernte 2027" title="Wann Besitz, Nutzen und Lasten übergehen sollen" />
          </label>
          <label className="lfa-breit">
            <span className="field-label">Bestehende Pacht / Belastungen</span>
            <input name="bestehendePacht" defaultValue={daten.bestehendePacht} className="field-input" title="z. B. verpachtet bis 30.09.2028 an …" />
          </label>
          <label>
            <span className="field-label">Gewünschter Notar</span>
            <input name="notarWunsch" defaultValue={daten.notarWunsch} className="field-input" title="Name und Ort des Notars, falls schon bekannt" />
          </label>
          <label>
            <span className="field-label">Besonderes</span>
            <input name="besonderes" defaultValue={daten.besonderes} className="field-input" title="Weitere Eckdaten für den Notar" />
          </label>
          <div className="lfa-breit">
            <button type="submit" className="lfa-knopf" title="Speichert die Eckdaten (Entwurf)">Eckdaten speichern</button>
          </div>
        </form>
      )}
      <div className="lfa-knopfreihe" style={{ marginTop: "0.75rem" }}>
        {k?.status === "entwurf" && (
          <form action={kaufZurBestaetigungAktion}>
            <Hidden ctx={ctx} zurueck={zurueck} />
            <BestaetigenKnopf disabled={!frei || !vorlageFrei} className="lfa-knopf lfa-knopf-klein" frage="Eckdaten beiden Seiten zur (unverbindlichen) Bestätigung vorlegen?" tipp={frei ? "Zeigt die Eckdaten beiden Seiten im Kundenbereich zur Bestätigung" : "Erst nach der Freigabe"}>
              Zur Bestätigung vorlegen
            </BestaetigenKnopf>
          </form>
        )}
        {(k?.status === "zur_bestaetigung" || k?.status === "bestaetigt") && (
          <form action={kaufZurueckAktion}>
            <Hidden ctx={ctx} zurueck={zurueck} />
            <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Zurück zum Entwurf? Bestätigungen verfallen." tipp="Macht die Eckdaten wieder bearbeitbar">
              Zurück zum Entwurf
            </BestaetigenKnopf>
          </form>
        )}
        {k && k.status !== "abgebrochen" && k.status !== "wirksam" && (
          <form action={kaufAbbrechenAktion} className="lfa-inline" style={{ flex: "1 1 16rem" }}>
            <Hidden ctx={ctx} zurueck={zurueck} />
            <label>
              Grund (bei Abbruch)
              <input name="grund" className="field-input" title="Warum der Kauf nicht zustande kommt — storniert eine erfasste Provision" />
            </label>
            <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Kauf abbrechen? Eine bereits erfasste Provision wird storniert." tipp="Kauf abbrechen (Provision wird storniert)">
              Abbrechen
            </BestaetigenKnopf>
          </form>
        )}
      </div>

      {k && ["bestaetigt", "zur_bestaetigung", "entwurf"].includes(k.status) && (
        <div className="lfa-abschnitt">
          <h3 className="lfa-h3">Notar und Beurkundung</h3>
          <form action={kaufNotarAktion} className="lfa-inline">
            <Hidden ctx={ctx} zurueck={zurueck} />
            <label>
              Notar
              <input name="notar" defaultValue={k.notar.name ?? ""} className="field-input" title="Name und Ort des Notars" />
            </label>
            <label>
              Termin
              <input name="termin" type="date" defaultValue={k.notar.termin ?? ""} className="field-input" title="Beurkundungstermin" />
            </label>
            <button type="submit" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Notar und Termin speichern">Speichern</button>
          </form>
          <form action={kaufBeurkundetAktion} className="lfa-inline" style={{ marginTop: "0.6rem" }}>
            <Hidden ctx={ctx} zurueck={zurueck} />
            <label>
              Beurkundet am
              <input name="datum" type="date" className="field-input" required title="Datum der notariellen Beurkundung" />
            </label>
            <label>
              Kaufpreis laut Urkunde (€)
              <input name="kaufpreis" inputMode="decimal" defaultValue={zahl(k.daten.kaufpreis)} className="field-input" required title="Beurkundeter Kaufpreis — Grundlage der Provision" />
            </label>
            <label>
              Genehmigung (GrdstVG)
              <select name="genehmigung" className="field-select" title="Ohne erforderliche Genehmigung ist der Kaufvertrag schwebend unwirksam — die Provision wird erst mit der Genehmigung fällig">
                <option value="beantragt">beantragt / ausstehend</option>
                <option value="nicht_noetig">nicht nötig (bis 1 ha)</option>
                <option value="erteilt">bereits erteilt</option>
              </select>
            </label>
            <BestaetigenKnopf
              className="lfa-knopf lfa-knopf-klein"
              frage="Beurkundung erfassen? Die Provision wird angelegt (fällig erst mit Wirksamkeit)."
              tipp={`Erfasst die Beurkundung und legt die Provision an (${konditionen ? `Konditionen Nr. ${konditionen.version}` : "kein unterschriebener Nachweisvertrag des Käufers gefunden!"})`}
            >
              Beurkundung erfassen
            </BestaetigenKnopf>
          </form>
        </div>
      )}
      {k?.status === "beurkundet" && (
        <form action={kaufWirksamAktion} className="lfa-inline lfa-abschnitt">
          <Hidden ctx={ctx} zurueck={zurueck} />
          <label>
            Wirksam seit (Genehmigung erteilt)
            <input name="datum" type="date" className="field-input" title="Datum, an dem die Genehmigung erteilt wurde" />
          </label>
          <BestaetigenKnopf className="lfa-knopf lfa-knopf-klein" frage="Kaufvertrag als wirksam erfassen? Die Provision wird fällig." tipp="Genehmigung ist da — Provision wird fällig (Admin-Mail „Provision fällig“)">
            Kauf wirksam
          </BestaetigenKnopf>
        </form>
      )}
      {k && (
        <details className="lfa-details" style={{ marginTop: "0.9rem" }}>
          <summary title="Zeigt die Eckdaten so, wie beide Seiten sie sehen">Vorschau der Kaufabsicht</summary>
          <div className="lfa-vorschau">
            <VertragsText dok={kaufDokument(ctx.key, daten, konditionen)} kompakt />
          </div>
        </details>
      )}
    </section>
  );
}

function ProvisionPanel({ ctx, zurueck }: { ctx: VorgangKontext; zurueck: string }) {
  const v = ctx.vorgang;
  const g = v?.gutschein;
  return (
    <section className="lfa-panel" id="provision">
      <h2 className="lfa-h2">Provision</h2>
      <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
        Schuldner ist immer der Suchende. Hier wird der Anspruch nur erfasst und nachverfolgt — die Rechnung stellt die Buchhaltung (keine Rechnungsnummern aus diesem System).
      </p>
      {!v?.provisionen.length ? (
        <p className="lfa-klein">Noch kein Provisionsanspruch.</p>
      ) : (
        <table className="lfa-liste">
          <thead>
            <tr>
              <th title="Grundlage des Anspruchs">Grundlage</th>
              <th title="Jahrespacht bzw. Kaufpreis">Bemessung</th>
              <th title="Provision netto und brutto — nach Anrechnung eines Gutscheins">Betrag</th>
              <th title="Stand des Anspruchs">Status</th>
              <th title="Status ändern, Notiz, Gutschein anrechnen">Bearbeiten</th>
            </tr>
          </thead>
          <tbody>
            {v.provisionen.map((p) => {
              const nach = M.provisionNachGutschein(p);
              return (
                <tr key={p.id}>
                  <td data-label="Grundlage">
                    <div>{p.grundlage === "pachtvertrag" ? "Pachtvertrag (online)" : p.grundlage === "kaufvertrag" ? "Kaufvertrag (Notar)" : "außerhalb geschlossen"}</div>
                    <div className="lfa-klein">{p.id} · entstanden {datumDe(p.entstandenAm)}{p.konditionen ? ` · Konditionen Nr. ${p.konditionen.version}` : " · ohne Vertrag!"}</div>
                  </td>
                  <td data-label="Bemessung">{M.euro(p.bemessung)}</td>
                  <td data-label="Betrag">
                    <div>{M.euro(nach.netto)} netto</div>
                    <div className="lfa-klein">{M.euro(nach.brutto)} brutto{p.gutschein ? ` (Gutschein ${p.gutschein.code}: −${M.euro(p.gutschein.abzugBrutto)})` : ""}</div>
                  </td>
                  <td data-label="Status">
                    <span className={`lfa-badge ${p.status === "bezahlt" ? "lfa-badge-ok" : p.status === "storniert" ? "lfa-badge-keine" : "lfa-badge-warn"}`} title={M.PROVISION_STATUS[p.status].tipp}>
                      {M.PROVISION_STATUS[p.status].label}
                    </span>
                    {p.notiz && <div className="lfa-klein">{p.notiz}</div>}
                  </td>
                  <td data-label="Bearbeiten">
                    <form action={provisionStatusAktion} className="lfa-inline">
                      <input type="hidden" name="key" value={ctx.key} />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="zurueck" value={zurueck} />
                      <label>
                        Status
                        <select name="status" defaultValue={p.status} className="field-select" title="Neuen Stand wählen">
                          {(Object.keys(M.PROVISION_STATUS) as M.ProvisionStatus[]).map((s) => (
                            <option key={s} value={s}>{M.PROVISION_STATUS[s].label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Notiz
                        <input name="notiz" className="field-input" placeholder="z. B. Rechnung vom …" title="z. B. Datum und Nummer der Rechnung der Buchhaltung, Zahlungseingang, Stornogrund" />
                      </label>
                      <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Speichert Status und Notiz im Verlauf der Provision">Speichern</button>
                    </form>
                    {!p.gutschein && p.status !== "storniert" && (
                      <form action={gutscheinAnrechnenAktion} className="lfa-inline" style={{ marginTop: "0.4rem" }}>
                        <input type="hidden" name="key" value={ctx.key} />
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="zurueck" value={zurueck} />
                        <label>
                          Treue-Gutschein
                          <input name="code" className="field-input" placeholder="LF-XXXX-XXXX" title="Code eines Treue-Gutscheins desselben Kunden aus einem früheren Abschluss" />
                        </label>
                        <button type="submit" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Rechnet den Gutschein als Preisnachlass auf diese Provision an (nur für denselben Kunden, nicht übertragbar)">
                          Anrechnen
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {g && (
        <div className="lfa-abschnitt">
          <h3 className="lfa-h3">Treue-Gutschein aus diesem Abschluss</h3>
          <p className="lfa-klein">
            <strong>{g.code}</strong> über {M.euro(g.betrag)} für den Suchenden · ausgegeben {datumDe(g.ausgegebenAm)} · gültig bis {tagDe(g.gueltigBis)} ·{" "}
            {g.eingeloest ? `eingelöst ${datumDe(g.eingeloest.am)} im Vorgang ${g.eingeloest.vorgang}` : g.storniert ? `storniert ${datumDe(g.storniert.am)} (${g.storniert.grund})` : "offen"}
          </p>
          {!g.eingeloest && !g.storniert && (
            <form action={gutscheinStornierenAktion} className="lfa-inline" style={{ marginTop: "0.4rem" }}>
              <input type="hidden" name="key" value={ctx.key} />
              <input type="hidden" name="zurueck" value={zurueck} />
              <label>
                Grund
                <input name="grund" className="field-input" title="Warum der Gutschein storniert wird" />
              </label>
              <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Gutschein stornieren?" tipp="Storniert den Gutschein (z. B. wenn der Abschluss rückabgewickelt wurde)">
                Stornieren
              </BestaetigenKnopf>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function ExternPanel({ ctx, zurueck }: { ctx: VorgangKontext; zurueck: string }) {
  const v = ctx.vorgang;
  return (
    <section className="lfa-panel" id="extern">
      <h2 className="lfa-h2">Außerhalb geschlossener Vertrag</h2>
      <p className="lfa-klein" style={{ marginBottom: "0.6rem" }}>
        Haben die Parteien den Pacht- oder Kaufvertrag ohne die Plattform geschlossen (z. B. auf Papier), hier erfassen — der Provisionsanspruch entsteht genauso. Den Vertrag als Scan unten bei „Dokumente“ hochladen.
      </p>
      {v?.externeVertraege.length ? (
        <ul className="lfa-verlauf" style={{ marginBottom: "0.6rem" }}>
          {v.externeVertraege.map((x) => (
            <li key={x.id}>
              <span className="lfa-klein">erfasst {datumZeit(x.erfasstAm)} von {x.von}</span>
              <div>
                {x.art === "kauf" ? "Kaufvertrag" : "Pachtvertrag"} vom {tagDe(x.datum)}
                {x.flaecheHa ? ` · ${String(x.flaecheHa).replace(".", ",")} ha` : ""} · {x.art === "kauf" ? "Kaufpreis" : "Jahrespacht"} {M.euro(x.betrag)} · Quelle: {x.quelle || "—"}
                {x.notiz ? ` · ${x.notiz}` : ""}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <form action={externErfassenAktion} className="lfa-inline">
        <input type="hidden" name="key" value={ctx.key} />
        <input type="hidden" name="zurueck" value={zurueck} />
        <label>
          Art
          <select name="art" defaultValue={ctx.art} className="field-select" title="Pacht- oder Kaufvertrag">
            <option value="pacht">Pachtvertrag</option>
            <option value="kauf">Kaufvertrag</option>
          </select>
        </label>
        <label>
          Datum
          <input name="datum" type="date" required className="field-input" title="Datum des Vertragsschlusses" />
        </label>
        <label>
          Fläche (ha)
          <input name="flaeche" inputMode="decimal" className="field-input" title="Vertragsfläche in Hektar" />
        </label>
        <label>
          Jahrespacht bzw. Kaufpreis (€)
          <input name="betrag" inputMode="decimal" required className="field-input" title="Volle Jahrespacht (netto) bzw. Kaufpreis — Grundlage der Provision" />
        </label>
        <label>
          Quelle
          <input name="quelle" className="field-input" placeholder="Mitteilung des Kunden …" title="Woher die Information stammt (Mitteilung, Kopie des Vertrags, Gespräch …)" />
        </label>
        <label>
          Notiz
          <input name="notiz" className="field-input" title="Weitere Angaben" />
        </label>
        <BestaetigenKnopf className="lfa-knopf lfa-knopf-klein" frage="Außerhalb geschlossenen Vertrag erfassen? Die Provision wird als fällig angelegt." tipp="Legt den Vertrag und einen fälligen Provisionsanspruch gegen den Suchenden an">
          Erfassen
        </BestaetigenKnopf>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------

export default async function VorgangPage(props: PageProps<"/admin/vorgang/[key]">) {
  const { email } = await requireAdmin();
  const { key: roh } = await props.params;
  const key = decodeURIComponent(roh);
  const sp = await props.searchParams;
  if (!/^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/.test(key)) notFound();
  const [ctx, portal, neu, basis] = await Promise.all([ladeVorgangKontext(key), ladePortal(), ladeNeu(email), basisUrl()]);
  if (!ctx) notFound();
  const zurueck = `/admin/vorgang/${key}`;
  const status = ctx.meta?.status ?? "vorschlag";
  const v = ctx.vorgang;
  const frei = M.aktiveFreigabe(v);
  const pr = freigabePruefung(ctx);
  const neueEreignisse = neu.vorgang(v);
  const neuIds = new Set(neueEreignisse.map((e) => e.id));
  const bewertungsUrl = M.bewertungsUrl(portal.einstellungen, process.env.GOOGLE_REVIEW_URL);
  const entwuerfe = [
    ...entwuerfePaar({ key, angebot: ctx.angebot, gesuch: ctx.gesuch, anbieter: ctx.anbieter, suchender: ctx.suchender, vorgang: v, meta: ctx.meta, zustand: ctx.zustand, einstellungen: portal.einstellungen, basis, bewertungsUrl }),
    ...(status === "vorgemerkt" || status === "angefragt"
      ? [...entwuerfeKunde({ lead: ctx.gesuch, kunde: ctx.suchender, einstellungen: portal.einstellungen, basis }), ...entwuerfeKunde({ lead: ctx.angebot, kunde: ctx.anbieter, einstellungen: portal.einstellungen, basis })].filter(
          (e) => e.zweck === "einladung" || e.zweck === "erinnerung",
        )
      : []),
  ];

  return (
    <>
      <GesehenMarker keys={[`vorgang:${key}`]} />
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/admin/vorgaenge" className="lfa-klein" title="Zur Übersicht aller Vorgänge">← Alle Vorgänge</Link>
      </p>
      <Meldung sp={sp} />
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">
            {ctx.angebot.name} ↔ {ctx.gesuch.name}
          </h1>
          <div className="lfa-knopfreihe" style={{ marginTop: "0.4rem" }}>
            <span className="lfa-badge lfa-badge-keine" title={MATCH_STATUS[status].tipp}>{MATCH_STATUS[status].label}</span>
            <span className="lfa-badge lfa-badge-angebot" title="Kauf oder Pacht">{ctx.art === "kauf" ? "Kauf" : "Pacht"}</span>
            {frei && <span className="lfa-badge lfa-badge-ok" title="Kontaktdaten sind im Kundenbereich freigegeben">freigegeben {datumDe(v!.freigabe!.am)}</span>}
            {neueEreignisse.length > 0 && <span className="lfa-neu-text"><span className="lfa-puls" />{neueEreignisse.length} neu</span>}
            <span className="lfa-klein">Vorgang {key}</span>
          </div>
        </div>
        <div className="lfa-knopfreihe">
          <Link href={`/admin/anfrage/${ctx.angebot.id}`} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Anfrage des Anbieters öffnen (Onboarding, Einladung, Kundenakte)">Anbieter</Link>
          <Link href={`/admin/anfrage/${ctx.gesuch.id}`} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Anfrage des Suchenden öffnen (Onboarding, Einladung, Kundenakte)">Suchender</Link>
          <Link href={`/admin/matching?anfrage=${ctx.angebot.id}#${key}`} className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Paar im Matching anzeigen">Im Matching</Link>
        </div>
      </div>

      <div className="lfa-raster">
        <div>
          <section className="lfa-panel">
            <h2 className="lfa-h2">Parteien und Freigabe</h2>
            <div className="lfa-texte" style={{ marginBottom: "0.75rem" }}>
              <KundenStand k={ctx.anbieter} rolle="anbieter" />
              <KundenStand k={ctx.suchender} rolle="suchender" />
            </div>
            {!frei && status !== "verworfen" && (
              <>
                <div className="lfa-knopfreihe" style={{ marginBottom: "0.5rem" }}>
                  {(["anbieter", "suchender"] as M.Rolle[]).map((r) => {
                    const am = r === "anbieter" ? ctx.meta?.zustimmungAnbieter : ctx.meta?.zustimmungSuchender;
                    return (
                      <form key={r} action={zustimmungErfassenAktion}>
                        <input type="hidden" name="key" value={key} />
                        <input type="hidden" name="rolle" value={r} />
                        <input type="hidden" name="art" value={ctx.art} />
                        <input type="hidden" name="an" value={am ? "0" : "1"} />
                        <input type="hidden" name="zurueck" value={zurueck} />
                        <button type="submit" className={`lfa-knopf lfa-knopf-klein ${am ? "" : "lfa-knopf-hell"}`} title={am ? "Zustimmung zurücknehmen" : "Zustimmung zu diesem Kontakt erfassen (z. B. telefonisch erteilt) — Kunden können auch selbst im Kundenbereich zustimmen"}>
                          {am ? `✓ ${M.ROLLE_NAME[r]} stimmt zu (${datumDe(am)})` : `Zustimmung ${M.ROLLE_ARTIKEL[r].gen} erfassen`}
                        </button>
                      </form>
                    );
                  })}
                </div>
                {ctx.meta?.ablehnung && (
                  <p className="lfa-hinweis lfa-hinweis-fehler">
                    {M.ROLLE_NAME[ctx.meta.ablehnung.rolle]} hat am {datumDe(ctx.meta.ablehnung.am)} „kein Interesse“ gemeldet{ctx.meta.ablehnung.grund ? `: ${ctx.meta.ablehnung.grund}` : ""}.
                  </p>
                )}
                <ul className="lfa-pruefliste">
                  {pr.punkte.map((p) => (
                    <li key={p.text} className={p.ok ? "lfa-ok" : undefined}>{p.text}</li>
                  ))}
                </ul>
                <form action={freigebenAktion}>
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="zurueck" value={zurueck} />
                  <BestaetigenKnopf
                    className="lfa-knopf"
                    disabled={!pr.bereit}
                    frage="Kontakt jetzt freigeben? Beide Seiten sehen danach im Kundenbereich Namen, Kontaktdaten und Flurstücke des Gegenübers."
                    tipp={pr.bereit ? "Gibt die Kontaktdaten beider Seiten frei; danach die Freigabe-Mitteilungen senden" : "Erst möglich, wenn alle Punkte oben erfüllt sind"}
                  >
                    Kontakt freigeben
                  </BestaetigenKnopf>
                </form>
              </>
            )}
            {frei && (
              <div className="lfa-abschnitt">
                <p className="lfa-klein">Freigegeben am {datumZeit(v!.freigabe!.am)} von {v!.freigabe!.von}. Beide Seiten sehen die Kontaktdaten im Kundenbereich.</p>
                {!v?.abschluss && (ctx.anbieter?.widerruf || ctx.suchender?.widerruf) && (
                  <p className="lfa-hinweis lfa-hinweis-fehler" style={{ margin: "0.4rem 0 0" }} role="alert">
                    Achtung: {ctx.suchender?.widerruf ? `Der Suchende hat am ${datumDe(ctx.suchender.widerruf.am)}` : `Der Anbieter hat am ${datumDe(ctx.anbieter!.widerruf!.am)}`} widerrufen. Der Kundenbereich zeigt die Kontaktdaten nicht mehr an; einen Pachtvertrag bzw. Eckdaten nicht mehr über die Plattform vorlegen. Freigabe bitte zurückziehen und — falls nötig — die Gegenseite informieren.
                  </p>
                )}
                {v?.abschluss ? (
                  <p className="lfa-klein" style={{ marginTop: "0.4rem" }}>Nach dem Vertragsschluss bleibt die Freigabe bestehen — beide Seiten brauchen Zugriff auf ihren Vertrag.</p>
                ) : (
                <details className="lfa-details" style={{ marginTop: "0.4rem" }}>
                  <summary title="Nur bei einem Versehen oder nach einem Widerruf: Kontaktdaten im Kundenbereich wieder verbergen">Freigabe zurückziehen</summary>
                  <form action={freigabeZurueckziehenAktion} className="lfa-inline">
                    <input type="hidden" name="key" value={key} />
                    <input type="hidden" name="zurueck" value={zurueck} />
                    <label>
                      Grund
                      <input name="grund" required className="field-input" title="Warum die Freigabe zurückgezogen wird (wird protokolliert)" />
                    </label>
                    <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Freigabe zurückziehen? Die Kontaktdaten werden im Kundenbereich wieder verborgen — bereits gesehene Daten bleiben natürlich bekannt." tipp="Verbirgt die Kontaktdaten wieder (der Nachweis bleibt bestehen)">
                      Zurückziehen
                    </BestaetigenKnopf>
                  </form>
                </details>
                )}
              </div>
            )}
          </section>

          {ctx.art === "pacht" ? <PachtPanel ctx={ctx} portal={portal} zurueck={zurueck} /> : <KaufPanel ctx={ctx} portal={portal} zurueck={zurueck} />}
          <ProvisionPanel ctx={ctx} zurueck={zurueck} />
          <ExternPanel ctx={ctx} zurueck={zurueck} />
        </div>

        <div>
          {entwuerfe.length > 0 && (
            <section className="lfa-panel" id="entwuerfe">
              <h2 className="lfa-h2">E-Mail-Entwürfe</h2>
              <div className="lfa-entwuerfe">
                {entwuerfe.map((e) => (
                  <MailEntwurf key={e.id} e={e} offen={Boolean(e.faellig && !e.gesendetAm)} />
                ))}
              </div>
            </section>
          )}

          {v?.meldungen.length ? (
            <section className="lfa-panel">
              <h2 className="lfa-h2">Meldungen aus dem Kundenbereich</h2>
              <ul className="lfa-verlauf">
                {v.meldungen.map((m) => (
                  <li key={m.id}>
                    <span className="lfa-klein">{datumZeit(m.am)} · {M.ROLLE_NAME[m.rolle]} · {m.art === "abschluss" ? "meldet Vertragsschluss" : "Rückfrage"}</span>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="lfa-panel" id="dokumente">
            <h2 className="lfa-h2">Dokumente</h2>
            <DokumentListe dokumente={v?.dokumente ?? []} quelle={{ v: key }} neu={(id) => (v ? neu.dokumentNeu(v, id) : false)} />
            <form action="/admin/hochladen" method="post" encType="multipart/form-data" className="lfa-inline lfa-abschnitt">
              <input type="hidden" name="key" value={key} />
              <label>
                Titel
                <input name="titel" className="field-input" placeholder="z. B. Pachtvertrag (Scan)" title="Bezeichnung des Dokuments" />
              </label>
              <label>
                Sichtbar für
                <select name="sichtbar" className="field-select" defaultValue="" title="Wer das Dokument im Kundenbereich sieht">
                  <option value="">nur Verwaltung</option>
                  <option value="beide">beide Seiten</option>
                  <option value="anbieter">nur Anbieter</option>
                  <option value="suchender">nur Suchender</option>
                </select>
              </label>
              <label>
                Datei (PDF/JPG/PNG, max. 4 MB)
                <input name="datei" type="file" accept="application/pdf,image/jpeg,image/png" required className="field-input" title="Datei auswählen" />
              </label>
              <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Lädt die Datei in die private Dokumentenablage dieses Vorgangs hoch">Hochladen</button>
            </form>
          </section>

          <section className="lfa-panel">
            <h2 className="lfa-h2">Verlauf des Vorgangs</h2>
            <Verlauf ereignisse={v?.ereignisse ?? []} mails={v?.mails ?? []} neuIds={neuIds} />
          </section>
        </div>
      </div>
    </>
  );
}
