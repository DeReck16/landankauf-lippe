import type { Metadata } from "next";
import Link from "next/link";
import FlaechenEditor from "@/components/portal/FlaechenEditor";
import { ladeLead } from "@/lib/portal/ablauf";
import { requireKundeId } from "@/lib/portal/sitzung";
import { wert } from "@/lib/portal/texte";
import { angabenAktion } from "../actions";

export const metadata: Metadata = { title: "Ihre Angaben" };

export default async function AngabenPage(props: PageProps<"/kunde/angaben">) {
  const sp = await props.searchParams;
  const id = typeof sp.k === "string" ? sp.k : "";
  const { kunde } = await requireKundeId(id);
  const lead = (await ladeLead(id))?.lead;
  const s = kunde.stammdaten;
  const anbieter = kunde.rolle === "anbieter";
  const m = typeof sp.m === "string" ? sp.m.slice(0, 300) : "";
  const eigenschaftFest = Boolean(kunde.vertrag);

  return (
    <>
      <ol className="lfk-schritte">
        <li data-stand="jetzt">Angaben</li>
        <li data-stand={kunde.vertrag ? "fertig" : "offen"}>{anbieter ? "Vereinbarung bestätigen" : "Vertrag unterschreiben"}</li>
        <li data-stand="offen">Vorschläge und Kontakt</li>
      </ol>
      <h1 className="lfk-h1">Ihre Angaben</h1>
      <p className="lfk-unterzeile">
        Diese Angaben stehen später in Ihrem Vertrag. {anbieter ? "Name, Kontaktdaten und Flurstücke geben wir erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben." : "Ihre Kontaktdaten geben wir erst weiter, wenn Sie dem konkreten Kontakt zugestimmt haben."}
      </p>
      {m && <p className={`lfk-hinweis ${sp.mt === "fehler" ? "lfk-hinweis-fehler" : "lfk-hinweis-ok"}`}>{m}</p>}

      <form action={angabenAktion} className="lfk-karte lfk-form">
        <input type="hidden" name="k" value={kunde.id} />
        <div className="lfk-raster">
          <label className="lfk-voll">
            <span className="field-label">Vor- und Nachname *</span>
            <input name="name" required defaultValue={s?.name ?? wert(lead?.name)} autoComplete="name" className="field-input" title="Ihr vollständiger Name — so unterschreiben Sie später auch" />
          </label>
          <label className="lfk-voll">
            <span className="field-label">Betrieb / Firma (optional)</span>
            <input name="betrieb" defaultValue={s?.betrieb ?? ""} autoComplete="organization" className="field-input" title="Nur ausfüllen, wenn Sie für einen Betrieb oder eine Firma handeln" />
          </label>
          <label className="lfk-voll">
            <span className="field-label">Straße und Hausnummer *</span>
            <input name="strasse" required defaultValue={s?.strasse ?? ""} autoComplete="street-address" className="field-input" title="Ihre Anschrift für den Vertrag" />
          </label>
          <label>
            <span className="field-label">PLZ *</span>
            <input name="plz" required defaultValue={s?.plz ?? ""} inputMode="numeric" pattern="\d{5}" maxLength={5} autoComplete="postal-code" className="field-input" title="Fünfstellige Postleitzahl" />
          </label>
          <label>
            <span className="field-label">Ort *</span>
            <input name="ort" required defaultValue={s?.ort ?? ""} autoComplete="address-level2" className="field-input" title="Wohnort bzw. Sitz" />
          </label>
          <label>
            <span className="field-label">Telefon</span>
            <input name="telefon" defaultValue={s?.telefon ?? wert(lead?.phone)} inputMode="tel" autoComplete="tel" className="field-input" title="Für die Kontaktaufnahme nach der Freigabe — empfohlen" />
          </label>
          <label>
            <span className="field-label">E-Mail</span>
            <input value={kunde.email} readOnly className="field-input" title="Ihre Anmeldeadresse. Zum Ändern melden Sie sich bitte bei uns." />
          </label>
        </div>

        <fieldset className="lfk-auswahl" disabled={eigenschaftFest}>
          <legend className="field-label">Sie handeln als … *</legend>
          <label className="lfk-option" title="Sie handeln privat, z. B. als Eigentümer eigener Flächen, Erbengemeinschaft oder Hobby-Tierhalter">
            <input type="radio" name="eigenschaft" value="verbraucher" required defaultChecked={s?.eigenschaft === "verbraucher"} />
            <span>
              <strong>Privatperson (Verbraucher)</strong>
              Sie schließen den Vertrag nicht für einen Betrieb oder ein Gewerbe (§ 13 BGB). {anbieter ? "" : "Sie haben dann ein 14-tägiges Widerrufsrecht."}
            </span>
          </label>
          <label className="lfk-option" title="Sie handeln für Ihren landwirtschaftlichen Betrieb, Ihr Gewerbe oder Ihre selbständige Tätigkeit">
            <input type="radio" name="eigenschaft" value="unternehmer" required defaultChecked={s?.eigenschaft === "unternehmer"} />
            <span>
              <strong>Unternehmer</strong>
              Sie schließen den Vertrag für Ihren landwirtschaftlichen Betrieb, Ihr Gewerbe oder Ihre selbständige Tätigkeit (§ 14 BGB).
            </span>
          </label>
          {eigenschaftFest && <p className="lfk-klein">Diese Angabe ist Teil Ihres unterschriebenen Vertrags und lässt sich nicht mehr ändern.</p>}
        </fieldset>
        {eigenschaftFest && <input type="hidden" name="eigenschaft" value={s?.eigenschaft ?? "verbraucher"} />}

        {anbieter && (
          <div>
            <span className="field-label">Ihre Flächen</span>
            <p className="lfk-klein" style={{ marginBottom: "0.5rem" }}>
              Bitte alle Flächen angeben, die Sie {kunde.art === "kauf" ? "verkaufen" : "verpachten"} möchten (Gemarkung, Flur und Flurstück stehen z. B. im Grundsteuerbescheid oder Grundbuchauszug). Sie können das auch später ergänzen.
            </p>
            <FlaechenEditor start={kunde.flaechen ?? []} nutzungVorschlag={lead?.typ === "Wiese / Grünland" ? "Grünland" : lead?.typ === "Ackerland" ? "Acker" : ""} />
          </div>
        )}

        {anbieter && kunde.art === "kauf" && (
          <div>
            <input type="hidden" name="boerse_feld" value="1" />
            <label className="lfk-check lfk-check-frei" title="Freiwillig und jederzeit widerrufbar — ohne Häkchen erscheint Ihre Fläche nicht öffentlich">
              <input type="checkbox" name="boerse" value="1" defaultChecked={Boolean(lead?.meta.boerse?.einwilligung)} />
              <span>
                Freiwillig: Meine Fläche darf anonym in der <a href="/flaechenboerse" target="_blank" rel="noopener" title="Flächenbörse in neuem Tab ansehen">Flächenbörse</a> auf lippeforst.de erscheinen — nur mit Flächentyp, ungefährer Größe und grober Lage (z. B. „Ackerland, ca. 5 ha, Raum Lemgo“), ohne Namen, Flurstück oder genaue Lage. Das lässt sich jederzeit widerrufen: einfach das Häkchen hier entfernen.
              </span>
            </label>
          </div>
        )}

        <div className="lfk-knopfreihe">
          <button type="submit" className="btn-primary" title={kunde.vertrag ? "Angaben speichern" : "Angaben speichern und weiter zum Vertrag"}>
            {kunde.vertrag ? "Speichern" : "Speichern und weiter zum Vertrag"}
          </button>
          <Link href="/kunde" className="btn-secondary lfk-knopf-klein" title="Zurück zur Übersicht, ohne zu speichern">
            Zurück
          </Link>
        </div>
      </form>
    </>
  );
}
