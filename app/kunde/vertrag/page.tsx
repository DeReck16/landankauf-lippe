import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import VertragsText from "@/components/vertrag/VertragsText";
import { leadView } from "@/lib/admin/model";
import { listLeads, readZustand } from "@/lib/admin/store";
import { kundenVertragEntwurf, ladeLead } from "@/lib/portal/ablauf";
import { weitereFlaechenOhneVereinbarung } from "@/lib/portal/anbieter-gruppe";
import { erklaerungenKundenvertrag } from "@/lib/portal/erklaerungen";
import * as M from "@/lib/portal/model";
import { requireKundeId } from "@/lib/portal/sitzung";
import { alleKunden, ladeEinstellungen } from "@/lib/portal/speicher";
import { angebotText, datumDe } from "@/lib/portal/texte";
import { istFreigegeben } from "@/lib/vertraege/vorlagen";
import { kundenvertragAktion } from "../actions";
import UnterschriftFormular from "../UnterschriftFormular";

export const metadata: Metadata = { title: "Vertrag" };

export default async function VertragPage(props: PageProps<"/kunde/vertrag">) {
  const sp = await props.searchParams;
  const id = typeof sp.k === "string" ? sp.k : "";
  const { kunde } = await requireKundeId(id);
  if (kunde.vertrag) redirect("/kunde");
  if (!kunde.stammdaten) redirect(`/kunde/angaben?k=${id}`);
  const [geladen, e] = await Promise.all([ladeLead(id), ladeEinstellungen()]);
  if (!geladen) redirect("/kunde");
  const entwurf = kundenVertragEntwurf(kunde, geladen.lead, e);
  const anbieter = kunde.rolle === "anbieter";
  const verbraucher = kunde.stammdaten.eigenschaft === "verbraucher";
  const frei = istFreigegeben(e, entwurf.vorlageId);
  const erklaerungen = erklaerungenKundenvertrag(kunde.rolle, verbraucher, entwurf.provisionKurz);
  const k = entwurf.konditionen;
  const andere: M.Art = kunde.art === "pacht" ? "kauf" : "pacht";
  // Wartezeit für Verbraucher: Widerrufsfrist (14 Tage ab heute) + 4 Tage Puffer, ohne ausdrücklichen Beginnwunsch.
  const freigabeAb = verbraucher && !anbieter ? new Date(Date.parse(M.widerrufsfristEnde(new Date().toISOString())) + M.WIDERRUF_PUFFER_TAGE * 86_400_000).toISOString() : null;

  // Anbieter mit weiteren Flächen: ausdrücklich auswählen, wofür die Vereinbarung gilt (nie automatisch).
  let weitere: { id: string; text: string }[] = [];
  if (anbieter) {
    const [roh, { zustand }, alle] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
    weitere = weitereFlaechenOhneVereinbarung(kunde, roh.map((l) => leadView(l, zustand.anfragen[l.id])), alle).map((l) => ({ id: l.id, text: angebotText(l) || l.id }));
  }
  const auswahl = weitere.length ? (
    <fieldset className="lfk-auswahl" aria-label="Weitere Flächen">
      <legend className="field-label">Die Vereinbarung soll auch für diese weiteren Flächen gelten:</legend>
      {weitere.map((w) => (
        <label key={w.id} className="lfk-check lfk-check-frei" title="Mit Häkchen gilt diese Vereinbarung auch für diese Fläche — ohne Häkchen können Sie sie später im Kundenbereich hinzufügen">
          <input type="checkbox" name="weitere" value={w.id} defaultChecked />
          <span>
            {w.text} (Vorgang {w.id})
          </span>
        </label>
      ))}
    </fieldset>
  ) : null;

  const zusammenfassung = (
    <div className="lfk-zusammenfassung" aria-label="Zusammenfassung vor der Unterschrift">
      <p className="field-label" style={{ marginBottom: "0.5rem" }}>Das Wichtigste auf einen Blick</p>
      <dl>
        <dt>Vertragspartner</dt>
        <dd>TR Vertriebs GmbH („Lippe Forst“), Horn-Bad Meinberg</dd>
        {anbieter ? (
          <>
            <dt>Leistung</dt>
            <dd>Vorstellung Ihrer Fläche bei passenden Interessenten; Kontakt erst nach Ihrer Zustimmung</dd>
            <dt>Kosten</dt>
            <dd>Keine — Sie zahlen nichts</dd>
            <dt>Nach dem Ausstieg</dt>
            <dd>Schließen Sie innerhalb von 24 Monaten nach einer Freigabe mit einem von uns nachgewiesenen Interessenten ab, teilen Sie uns das kurz mit — ohne Kosten für Sie</dd>
          </>
        ) : (
          <>
            <dt>Leistung</dt>
            <dd>Nachweis und Vermittlung von {kunde.art === "kauf" ? "Flächen zum Kauf" : "Pachtflächen"}; Kontakt erst nach Zustimmung beider Seiten</dd>
            <dt>Preis (nur bei Erfolg)</dt>
            <dd>
              {k ? (verbraucher ? M.bruttoText(kunde.art, k) : M.konditionenText(kunde.art, k)) : "—"}
              {k && !verbraucher ? ` (${M.bruttoText(kunde.art, k)})` : ""}
            </dd>
            {k && (
              <>
                <dt>{kunde.art === "pacht" ? "Kaufen statt pachten" : "Pachten statt kaufen"}</dt>
                <dd>Schließen Sie über eine nachgewiesene Fläche stattdessen einen {andere === "kauf" ? "Kaufvertrag" : "Pachtvertrag"}, gilt dessen Provision: {M.konditionenText(andere, k)}</dd>
              </>
            )}
            <dt>Auch bei Angehörigen</dt>
            <dd>Die Provision entsteht auch, wenn Ihr Ehegatte bzw. eingetragener Lebenspartner oder eine von Ihnen beherrschte Gesellschaft den Vertrag schließt</dd>
            <dt>Nachwirkung</dt>
            <dd>Verträge über nachgewiesene Flächen innerhalb von 24 Monaten nach dem Nachweis teilen Sie uns mit — auch nach einer Kündigung</dd>
            <dt>Fälligkeit</dt>
            <dd>{kunde.art === "kauf" ? "Wenn der notarielle Kaufvertrag wirksam ist, 14 Tage nach Rechnung" : "Mit Abschluss des Pachtvertrags, 14 Tage nach Rechnung"}</dd>
            <dt>Eigene Flächen</dt>
            <dd>Für Flächen, die dem Geschäftsführer von Lippe Forst bzw. seiner Familie gehören (als „eigene Fläche“ gekennzeichnet), fällt keine Provision an</dd>
          </>
        )}
        <dt>Laufzeit</dt>
        <dd>Unbestimmt, jederzeit ohne Frist kündbar — keine Mindestlaufzeit</dd>
        {!anbieter && verbraucher && (
          <>
            <dt>Widerruf</dt>
            <dd>14 Tage Widerrufsrecht (Belehrung im Vertragstext oben)</dd>
            <dt>Wartezeit</dt>
            <dd>Ohne ausdrücklichen Beginnwunsch geben wir Kontaktdaten frühestens am {datumDe(freigabeAb)} frei (Ende der Widerrufsfrist plus {M.WIDERRUF_PUFFER_TAGE} Tage). Mit Beginnwunsch (Häkchen oben) geht es sofort.</dd>
          </>
        )}
      </dl>
    </div>
  );

  return (
    <>
      <ol className="lfk-schritte">
        <li data-stand="fertig">Angaben</li>
        <li data-stand="jetzt">{anbieter ? "Vereinbarung kostenlos bestätigen" : "Nachweisvertrag unterschreiben"}</li>
        <li data-stand="offen">Vorschläge und Kontakt</li>
      </ol>
      <h1 className="lfk-h1">{anbieter ? "Vereinbarung lesen und kostenlos bestätigen" : "Nachweisvertrag lesen und unterschreiben"}</h1>
      <p className="lfk-unterzeile">
        Bitte lesen Sie den vollständigen Text. Ihre Angaben sind bereits eingesetzt —{" "}
        <Link href={`/kunde/angaben?k=${id}`} style={{ textDecoration: "underline" }} title="Angaben korrigieren; danach wird der Vertragstext neu erzeugt">
          Angaben ändern
        </Link>
        . Nach der Unterschrift erhalten Sie den Vertrag als PDF per E-Mail.
      </p>

      {!frei ? (
        <p className="lfk-hinweis lfk-hinweis-fehler">Der Vertrag steht gerade nicht zur Unterschrift bereit. Wir melden uns bei Ihnen.</p>
      ) : (
        <>
          <div className="lfk-vertrag" tabIndex={0} aria-label="Vertragstext">
            <VertragsText dok={entwurf.dok} />
          </div>
          <section className="lfk-karte" style={{ marginTop: "1rem" }}>
            <h2 className="lfk-h2">{anbieter ? "Kostenlos bestätigen" : "Unterschreiben"}</h2>
            <UnterschriftFormular
              aktion={kundenvertragAktion}
              hidden={{ k: id, hash: entwurf.hash }}
              erklaerungen={erklaerungen}
              nameErwartet={kunde.stammdaten.name}
              knopf={anbieter ? "Vereinbarung kostenlos bestätigen" : "Zahlungspflichtig beauftragen"}
              knopfTipp={
                anbieter
                  ? "Schließt die kostenlose Vereinbarung ab; Sie erhalten sie als PDF per E-Mail"
                  : "Schließt den provisionspflichtigen Nachweisvertrag ab (Provision nur im Erfolgsfall); Sie erhalten ihn als PDF per E-Mail"
              }
              auswahl={auswahl}
              zusammenfassung={zusammenfassung}
            />
          </section>
        </>
      )}
    </>
  );
}
