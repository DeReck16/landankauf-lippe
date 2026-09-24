import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { ratgeberSchema, seitenMetadaten } from "@/lib/seo";

const TITEL = "Bodenrichtwerte Kreis Lippe: echte Kaufpreise";
const BESCHREIBUNG =
  "Bodenrichtwerte und tatsächlich gezahlte Kaufpreise für Ackerland, Grünland, Wald und Bauland im Kreis Lippe — nach den Grundstücksmarktberichten 2025 und 2026.";
const PFAD = "/ratgeber/bodenrichtwerte-lippe";

export const metadata: Metadata = seitenMetadaten({
  title: TITEL,
  description: BESCHREIBUNG,
  pfad: PFAD,
});

// Kauffälle > 2.500 m², gewöhnlicher Geschäftsverkehr. Ø-Preis = Geldumsatz / Fläche.
// Quelle: Grundstücksmarktbericht 2026 des Kreises Lippe und der Stadt Detmold, Abschnitt 4.4
// (enthält auch die Vorjahreswerte 2024 aus dem Bericht 2025).
const KAUFFAELLE: [string, string, string, string][] = [
  ["Ackerland 2024", "75", "163,67", "≈ 5,26 €/m² (≈ 52.600 €/ha)"],
  ["Ackerland 2025", "89", "221,58", "≈ 3,80 €/m² (≈ 38.000 €/ha)"],
  ["Grünland 2024", "24", "34,32", "≈ 1,89 €/m² (≈ 18.900 €/ha)"],
  ["Grünland 2025", "24", "33,84", "≈ 2,16 €/m² (≈ 21.600 €/ha)"],
  ["Forst inkl. Aufwuchs 2024", "15", "22,44", "≈ 1,34 €/m² (≈ 13.400 €/ha)"],
  ["Forst inkl. Aufwuchs 2025", "28", "45,00", "≈ 1,53 €/m² (≈ 15.300 €/ha)"],
];

// Bodenrichtwertübersicht Wohnbauflächen, individueller Wohnungsbau, erschließungsbeitragsfrei
// (Grundstücksmarktbericht 2026, Abschnitt 4.7.3).
const BAULAND: [string, number | null, number, number][] = [
  ["Augustdorf", 260, 245, 150],
  ["Bad Salzuflen", 340, 185, 140],
  ["Barntrup", 160, 95, 65],
  ["Blomberg", 170, 120, 65],
  ["Detmold", 320, 215, 140],
  ["Dörentrup", null, 100, 60],
  ["Extertal", 80, 75, 47],
  ["Horn-Bad Meinberg", 165, 115, 55],
  ["Kalletal", 130, 90, 60],
  ["Lage", 260, 180, 135],
  ["Lemgo", 270, 180, 120],
  ["Leopoldshöhe", 260, 220, 145],
  ["Lügde", 150, 90, 48],
  ["Oerlinghausen", 320, 245, 180],
  ["Schieder-Schwalenberg", 125, 70, 55],
  ["Schlangen", 260, 185, 140],
];

const zelle = "p-3 border border-[color:var(--color-line)]";

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Echte Zahlen"
        title="Bodenrichtwerte Kreis Lippe — was Flächen 2024 und 2025 wirklich gekostet haben."
        subtitle="Wir haben die offiziellen Grundstücksmarktberichte 2025 und 2026 des Gutachterausschusses für den Kreis Lippe und die Stadt Detmold ausgewertet. Hier die echten Zahlen für Ackerland, Grünland, Wald und Bauland — keine Pauschalwerte, sondern was tatsächlich bezahlt wurde."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe min-w-0">
            <h2>Was ist ein Bodenrichtwert?</h2>
            <p>
              Der Bodenrichtwert ist ein durchschnittlicher Lagewert für unbebaute Grundstücke in einer Bodenrichtwertzone. Er wird vom <strong>Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold</strong> auf Basis tatsächlicher Verkaufsfälle ermittelt und jährlich neu beschlossen. Er gilt nicht für ein konkretes Grundstück, sondern für eine ganze Zone — Ihre Fläche kann also höher oder niedriger liegen.
            </p>

            <h2>Tatsächlich gezahlte Kaufpreise 2024 und 2025 (Kreis Lippe)</h2>
            <p>
              Quelle: <Link href="https://www.kreis-lippe.de/gutachterausschuss" target="_blank" rel="noopener">Grundstücksmarktbericht 2026</Link> (Berichtsjahr 2025, mit den Vorjahreswerten 2024), ausschließlich Kauffälle des gewöhnlichen Geschäftsverkehrs &gt; 2.500 m².
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mt-3 border-collapse text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-brand-soft)] text-left">
                    <th className={zelle}>Nutzungsart</th>
                    <th className={`${zelle} text-right`}>Kauffälle</th>
                    <th className={`${zelle} text-right`}>Fläche [ha]</th>
                    <th className={`${zelle} text-right`}>Ø Kaufpreis</th>
                  </tr>
                </thead>
                <tbody>
                  {KAUFFAELLE.map(([art, faelle, flaeche, preis]) => (
                    <tr key={art}>
                      <td className={zelle}>{art}</td>
                      <td className={`${zelle} text-right`}>{faelle}</td>
                      <td className={`${zelle} text-right`}>{flaeche}</td>
                      <td className={`${zelle} text-right`}>{preis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Der Ø Kaufpreis ist Geldumsatz geteilt durch Fläche und schwankt mit der Zusammensetzung der verkauften Flächen. Der Gutachterausschuss selbst wertet die Ackerlandpreise 2025 als konstant (Preisindex 99 nach 100 im Vorjahr), die Grünlandpreise als gestiegen (Index 112). Der Markt zog 2025 an: 141 land- und forstwirtschaftliche Kauffälle (+24 %) über 300 ha (+36 %). Bereits 2024 waren die Ackerlandkäufe in Anzahl (+39 %), Fläche (+89 %) und Geldumsatz (+162 %) deutlich gestiegen.
            </p>

            <h2>Bodenrichtwerte vs. tatsächliche Kaufpreise</h2>
            <p>
              Der Gutachterausschuss veröffentlicht Bodenrichtwerte in <strong>€/m²</strong> bezogen auf ein <strong>Richtwertgrundstück</strong> mit definierten Eigenschaften:
            </p>
            <ul>
              <li><strong>Ackerland (A):</strong> Bezugsfläche ca. 2,0 ha, Ackerzahl 55. Beispielnotation „2,10 / A 55" = 2,10 €/m² für eine 2-ha-Fläche mit Bonität 55.</li>
              <li><strong>Grünland (GR):</strong> Bezugsfläche ca. 1,0 ha.</li>
              <li><strong>Forst (F):</strong> Bodenwert <em>ohne</em> Aufwuchs (im Gegensatz zu obiger Tabelle).</li>
            </ul>
            <p>
              Zum Stichtag 01.01.2026 liegen die Bodenrichtwerte im Kreis Lippe für <strong>Ackerland je nach Zone etwa zwischen 2,40 und 5,90 €/m²</strong> (niedrig z. B. Schieder-Schwalenberg und Teile von Blomberg, hoch Lage, Leopoldshöhe und Oerlinghausen), für <strong>Grünland etwa zwischen 1,40 und 3,80 €/m²</strong> (Stichprobe aus BORIS NRW).
            </p>
            <p>
              Liegt Ihre Fläche höher in der Bonität, größer im Zuschnitt oder besser erschlossen, weicht der Verkehrswert vom reinen Bodenrichtwert ab — meist nach oben.
            </p>

            <h2>Bodenrichtwerte für Bauland Kreis Lippe (Wohnungsbau)</h2>
            <p>
              Auch wenn Bauland nicht unser Kerngebiet ist — <Link href="/kontakt">wir kaufen und beraten auch hier</Link>. Aktuelle Bodenrichtwerte für individuellen Wohnungsbau, erschließungsbeitragsfrei:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mt-3 border-collapse text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-brand-soft)] text-left">
                    <th className={zelle}>Stadt / Gemeinde</th>
                    <th className={`${zelle} text-right`}>gute Lage</th>
                    <th className={`${zelle} text-right`}>mittlere</th>
                    <th className={`${zelle} text-right`}>mäßige</th>
                  </tr>
                </thead>
                <tbody>
                  {BAULAND.map(([name, gut, mittel, maes]) => (
                    <tr key={name}>
                      <td className={zelle}>{name}</td>
                      <td className={`${zelle} text-right`}>{gut ? `${gut} €/m²` : "—"}</td>
                      <td className={`${zelle} text-right`}>{`${mittel} €/m²`}</td>
                      <td className={`${zelle} text-right`}>{`${maes} €/m²`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Quelle: Grundstücksmarktbericht 2026 für den Kreis Lippe und die Stadt Detmold, Bodenrichtwertübersicht Wohnbauflächen für individuellen Wohnungsbau.
            </p>

            <h2>Ausgleichsflächen / Ökopunkte</h2>
            <p>
              Aus 21 ausgewerteten Kauffällen 2010–2025 ergibt sich für Ausgleichsflächen im Außenbereich eine durchschnittliche <strong>Wertrelation von 1,6</strong> zum Ackerland — Spanne 0,3 bis 4,0. Anders gesagt: Ein Hektar Ausgleichsfläche kann das 1,6-fache eines vergleichbaren Ackerland-Hektars wert sein. Mehr dazu auf der Seite <Link href="/services/vns-oekopunkte">VNS &amp; Ökopunkte</Link>.
            </p>

            <h2>Wo Sie Werte direkt einsehen</h2>
            <ul>
              <li><Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link> — Bodenrichtwert-Informationssystem für ganz NRW, kostenlos, mit Kartenansicht</li>
              <li><Link href="https://geoportal.kreislippe.de/geoportal/application/bodenrichtwerte" target="_blank" rel="noopener">Geoportal Kreis Lippe</Link> — kostenlose Kartenansicht der Lipper Werte</li>
              <li><Link href="https://www.kreis-lippe.de/gutachterausschuss" target="_blank" rel="noopener">Grundstücksmarktbericht 2026</Link> — kostenlos als PDF beim Gutachterausschuss</li>
              <li>Auf Anfrage beim Gutachterausschuss: 05231 / 62-7590, GA@kreis-lippe.de</li>
            </ul>

            <h2>Vom Bodenrichtwert zum echten Marktwert</h2>
            <p>
              Bodenrichtwert × Größe ist der Anfang, nicht das Ende. Die echte Wertindikation ergibt sich aus Bodenrichtwert + tatsächlichen Vergleichsverkäufen + spezifischen Eigenschaften Ihres Grundstücks (Bonität, Zuschnitt, Erschließung, Pachtstatus, Lasten, Schutzgebietskulisse). Genau das machen wir kostenlos für Sie. <Link href="/flaeche-bewerten">Hier kostenlose Bewertung anfragen</Link>.
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-bodenrichtwerte"
              defaultIntent="Bewertung"
              title="Werteinschätzung erhalten"
              subtitle="Wir verbinden Bodenrichtwert mit echten Vergleichsverkäufen — und sagen Ihnen, was Ihre Fläche heute wirklich bringt."
            />
          </aside>
        </div>
      </section>

      {ratgeberSchema({
        titel: TITEL,
        beschreibung: BESCHREIBUNG,
        pfad: PFAD,
        veroeffentlicht: "2026-05-01",
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
