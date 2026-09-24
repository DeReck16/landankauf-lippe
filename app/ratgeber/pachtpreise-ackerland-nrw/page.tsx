import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { ratgeberSchema, seitenMetadaten } from "@/lib/seo";

const TITEL = "Pachtpreise Ackerland NRW 2026 je Hektar";
const BESCHREIBUNG =
  "Pachtpreise NRW: Ø 659 €/ha Ackerland und 288 €/ha Grünland — bundesweit Spitze. Mit Regionalwerten, Monatsrechnung und der Frage: verpachten oder verkaufen?";
const PFAD = "/ratgeber/pachtpreise-ackerland-nrw";

export const metadata: Metadata = seitenMetadaten({
  title: TITEL,
  description: BESCHREIBUNG,
  pfad: PFAD,
});

const zelle = "p-3 border border-[color:var(--color-line)]";

// Agrarstrukturerhebung 2023 (IT.NRW, Pressemitteilung 11.07.2024). Die Werte der
// Regierungsbezirke gelten für die landwirtschaftlich genutzte Fläche insgesamt,
// nicht nur für Ackerland.
const PACHTEN: [string, string, string][] = [
  ["NRW Ackerland, Bestandspacht (Ø)", "659 €", "≈ 55 €"],
  ["NRW Ackerland, Neupacht (Ø)", "≈ 780 €", "≈ 65 €"],
  ["NRW Dauergrünland (Ø)", "288 €", "≈ 24 €"],
  ["NRW landwirtschaftliche Fläche insgesamt (Ø)", "560 €", "≈ 47 €"],
  ["Regierungsbezirk Münster (Ø alle Flächen)", "787 €", "≈ 66 €"],
  ["Regierungsbezirk Düsseldorf (Ø alle Flächen)", "638 €", "≈ 53 €"],
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Pachtpreise"
        title="Pachtpreise für Ackerland in NRW — die echten Zahlen."
        subtitle="NRW hat die höchsten Pachtpreise Deutschlands: im Bestand rund 659 € je Hektar Ackerland und Jahr, bei Neupachten deutlich mehr. Hier die offiziellen Werte — und wann Verkaufen die bessere Rechnung ist."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe min-w-0">
            <h2>Wie viel Pacht bekommt man für 1 Hektar Ackerland?</h2>
            <p>
              Nach der Agrarstrukturerhebung zahlen Landwirte in Nordrhein-Westfalen im Bestand durchschnittlich <strong>659 € je Hektar Ackerland und Jahr</strong> — bundesweit der höchste Wert. Bei <strong>Neupachten</strong> liegt der Schnitt mit rund <strong>780 € je Hektar</strong> nochmals deutlich darüber; in gefragten Lagen werden auch vierstellige Beträge gezahlt.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mt-3 border-collapse text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-brand-soft)] text-left">
                    <th className={zelle}>Pachtentgelt</th>
                    <th className={`${zelle} text-right`}>€/ha/Jahr</th>
                    <th className={`${zelle} text-right`}>≈ €/ha/Monat</th>
                  </tr>
                </thead>
                <tbody>
                  {PACHTEN.map(([art, jahr, monat]) => (
                    <tr key={art}>
                      <td className={zelle}>{art}</td>
                      <td className={`${zelle} text-right`}>{jahr}</td>
                      <td className={`${zelle} text-right`}>{monat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Quellen: Agrarstrukturerhebung 2023 / IT.NRW, BMEL-Pachtstatistik. Die Werte der Regierungsbezirke beziehen sich auf die gesamte landwirtschaftlich genutzte Fläche (Acker und Grünland). Zwischen 2013 und 2023 sind die Ackerland-Pachten in NRW um über 40 % gestiegen.
            </p>

            <h2>Was eine faire Pacht für Ihre Fläche bestimmt</h2>
            <ul>
              <li><strong>Bodengüte:</strong> Hohe Ackerzahlen rechtfertigen Pachten deutlich über dem Schnitt — schwache Standorte liegen darunter.</li>
              <li><strong>Konkurrenzdruck vor Ort:</strong> Wo mehrere Betriebe aufstocken wollen, steigen Neupachten schnell über 800–1.000 €/ha.</li>
              <li><strong>Vertragslaufzeit und Anpassungsklauseln:</strong> Ohne Indexierung frisst die Inflation die Pacht real auf.</li>
              <li><strong>Sonderverträge:</strong> Flächen für PV-Freiflächenanlagen erzielen ein Vielfaches der Agrar-Pacht — sind aber an lange Laufzeiten und Standortkriterien gebunden.</li>
            </ul>

            <h2>Verpachten oder verkaufen — die ehrliche Rechnung</h2>
            <p>
              659 € Pacht bei rund 80.700 € Verkehrswert je Hektar (NRW-Schnitt 2025) entsprechen einer Bruttorendite von <strong>unter 1 %</strong> — vor Steuern, Flächenpflege und Verwaltungsaufwand. Wer die Fläche nicht selbst bewirtschaften oder in der Familie halten will, fährt mit einem Verkauf zum heutigen Preisniveau oft besser: Die Bodenpreise liegen weiter nahe am Rekordniveau von 2023, während die Pachtrendite seit Jahren sinkt.
            </p>
            <p>
              Wir rechnen Ihnen beides durch — konkrete Pachtempfehlung für Ihre Gemarkung gegen realistisch erzielbaren Verkaufspreis: <Link href="/flaeche-verpachten">Fläche verpachten</Link> oder <Link href="/flaeche-bewerten">kostenlos bewerten lassen</Link>. Aktuelle Kaufpreise finden Sie im Ratgeber <Link href="/ratgeber/ackerland-preis-nrw">Was kostet 1 ha Ackerland in NRW?</Link>
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-pachtpreise-nrw"
              defaultIntent="Verpachten"
              title="Pacht- oder Verkaufs-Check"
              subtitle="Wir sagen Ihnen, welche Pacht für Ihre Fläche fair ist — und was ein Verkauf heute bringen würde."
            />
          </aside>
        </div>
      </section>

      {ratgeberSchema({
        titel: TITEL,
        beschreibung: BESCHREIBUNG,
        pfad: PFAD,
        veroeffentlicht: "2026-07-04",
        aktualisiert: "2026-09-24",
      }).map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
    </>
  );
}
