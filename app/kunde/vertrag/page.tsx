import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import VertragsText from "@/components/vertrag/VertragsText";
import { kundenVertragEntwurf, ladeLead } from "@/lib/portal/ablauf";
import { erklaerungenKundenvertrag } from "@/lib/portal/erklaerungen";
import * as M from "@/lib/portal/model";
import { requireKundeId } from "@/lib/portal/sitzung";
import { ladeEinstellungen } from "@/lib/portal/speicher";
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
            <dt>Fälligkeit</dt>
            <dd>{kunde.art === "kauf" ? "Wenn der notarielle Kaufvertrag wirksam ist, 14 Tage nach Rechnung" : "Mit Abschluss des Pachtvertrags, 14 Tage nach Rechnung"}</dd>
          </>
        )}
        <dt>Laufzeit</dt>
        <dd>Unbestimmt, jederzeit ohne Frist kündbar — keine Mindestlaufzeit</dd>
        {!anbieter && verbraucher && (
          <>
            <dt>Widerruf</dt>
            <dd>14 Tage Widerrufsrecht (Belehrung im Vertragstext oben)</dd>
          </>
        )}
      </dl>
    </div>
  );

  return (
    <>
      <ol className="lfk-schritte">
        <li data-stand="fertig">Angaben</li>
        <li data-stand="jetzt">{anbieter ? "Vereinbarung bestätigen" : "Vertrag unterschreiben"}</li>
        <li data-stand="offen">Vorschläge und Kontakt</li>
      </ol>
      <h1 className="lfk-h1">{anbieter ? "Vereinbarung lesen und bestätigen" : "Vertrag lesen und unterschreiben"}</h1>
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
            <h2 className="lfk-h2">{anbieter ? "Bestätigen" : "Unterschreiben"}</h2>
            <UnterschriftFormular
              aktion={kundenvertragAktion}
              hidden={{ k: id, hash: entwurf.hash }}
              erklaerungen={erklaerungen}
              nameErwartet={kunde.stammdaten.name}
              knopf={anbieter ? "Verbindlich unterzeichnen" : "Zahlungspflichtig beauftragen"}
              knopfTipp={
                anbieter
                  ? "Schließt die kostenlose Vereinbarung ab; Sie erhalten sie als PDF per E-Mail"
                  : "Schließt den provisionspflichtigen Nachweisvertrag ab (Provision nur im Erfolgsfall); Sie erhalten ihn als PDF per E-Mail"
              }
              zusammenfassung={zusammenfassung}
            />
          </section>
        </>
      )}
    </>
  );
}
