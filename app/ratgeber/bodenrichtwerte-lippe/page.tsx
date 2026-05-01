import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Bodenrichtwerte Kreis Lippe — echte Zahlen 2024/2025 (Grundstücksmarktbericht)",
  description:
    "Aktuelle Bodenrichtwerte und tatsächlich gezahlte Kaufpreise für Ackerland, Grünland und Wald im Kreis Lippe — auf Basis des offiziellen Grundstücksmarktberichts 2025 und BORIS NRW.",
  alternates: { canonical: "/ratgeber/bodenrichtwerte-lippe" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Echte Zahlen"
        title="Bodenrichtwerte Kreis Lippe — was Flächen 2024 wirklich gekostet haben."
        subtitle="Wir haben den offiziellen Grundstücksmarktbericht 2025 des Gutachterausschusses Kreis Lippe ausgewertet. Hier die echten Zahlen für Ackerland, Grünland, Wald und Bauland — keine Pauschalwerte, sondern was 2024 tatsächlich bezahlt wurde."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Was ist ein Bodenrichtwert?</h2>
            <p>
              Der Bodenrichtwert ist ein durchschnittlicher Lagewert für unbebaute Grundstücke in einer Bodenrichtwertzone. Er wird vom <strong>Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold</strong> auf Basis tatsächlicher Verkaufsfälle ermittelt und jährlich neu beschlossen. Er gilt nicht für ein konkretes Grundstück, sondern für eine ganze Zone — Ihre Fläche kann also höher oder niedriger liegen.
            </p>

            <h2>Tatsächlich gezahlte Kaufpreise 2024 (Kreis Lippe)</h2>
            <p>
              Quelle: <Link href="https://www.kreis-lippe.de/gutachterausschuss" target="_blank" rel="noopener">Grundstücksmarktbericht 2025</Link>, Berichtszeitraum 01.01.2024 – 31.12.2024, ausschließlich Kauffälle des gewöhnlichen Geschäftsverkehrs &gt; 2.500 m².
            </p>
            <table className="w-full mt-3 border-collapse text-sm">
              <thead>
                <tr className="bg-[color:var(--color-brand-soft)] text-left">
                  <th className="p-3 border border-[color:var(--color-line)]">Nutzungsart</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">Kauffälle</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">Fläche [ha]</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">Ø Kaufpreis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Ackerland</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">75</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">163,67</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 5,26 €/m² (≈ 52.600 €/ha)</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Grünland</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">24</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">34,32</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 1,89 €/m² (≈ 18.900 €/ha)</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Forst (inkl. Aufwuchs)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">15</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">22,44</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 1,34 €/m² (≈ 13.400 €/ha)</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Hinweis: Ackerlandkäufe stiegen 2024 in Anzahl (+39 %), Fläche (+89 %) und Geldumsatz (+162 %) gegenüber 2023 deutlich.
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
              Liegt Ihre Fläche höher in der Bonität, größer im Zuschnitt oder besser erschlossen, weicht der Verkehrswert vom reinen Bodenrichtwert ab — meist nach oben.
            </p>

            <h2>Bodenrichtwerte für Bauland Kreis Lippe (Wohnungsbau)</h2>
            <p>
              Auch wenn Bauland nicht unser Kerngebiet ist — <Link href="/kontakt">wir kaufen und beraten auch hier</Link>. Aktuelle Bodenrichtwerte für individuellen Wohnungsbau, erschließungsbeitragsfrei:
            </p>
            <table className="w-full mt-3 border-collapse text-sm">
              <thead>
                <tr className="bg-[color:var(--color-brand-soft)] text-left">
                  <th className="p-3 border border-[color:var(--color-line)]">Stadt / Gemeinde</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">gute Lage</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">mittlere</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">mäßige</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Augustdorf", 250, 245, 135],
                  ["Bad Salzuflen", 345, 185, 140],
                  ["Barntrup", 160, 95, 65],
                  ["Blomberg", 170, 120, 65],
                  ["Detmold", 320, 215, 130],
                  ["Dörentrup", null, 100, 60],
                  ["Extertal", 75, 70, 45],
                  ["Horn-Bad Meinberg", 165, 115, 55],
                  ["Kalletal", 130, 90, 60],
                  ["Lage", 260, 185, 130],
                  ["Lemgo", 270, 180, 105],
                  ["Leopoldshöhe", 260, 215, 140],
                  ["Lügde", 150, 90, 45],
                  ["Oerlinghausen", 315, 235, 165],
                  ["Schieder-Schwalenberg", 120, 70, 55],
                  ["Schlangen", 260, 185, 140],
                ].map(([name, gut, mittel, maes]) => (
                  <tr key={name as string}>
                    <td className="p-3 border border-[color:var(--color-line)]">{name}</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">{gut ? `${gut} €/m²` : "—"}</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">{mittel ? `${mittel} €/m²` : "—"}</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">{maes ? `${maes} €/m²` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Quelle: Grundstücksmarktbericht 2025 für den Kreis Lippe, Bodenrichtwertübersichten Wohnbauflächen für individuellen Wohnungsbau.
            </p>

            <h2>Ausgleichsflächen / Ökopunkte</h2>
            <p>
              Aus 21 ausgewerteten Kauffällen 2010–2024 ergibt sich für Ausgleichsflächen im Außenbereich eine durchschnittliche <strong>Wertrelation von 1,6</strong> zum Ackerland — Spanne 0,3 bis 4,0. Anders gesagt: Ein Hektar Ausgleichsfläche kann das 1,6-fache eines vergleichbaren Ackerland-Hektars wert sein. Mehr dazu auf der Seite <Link href="/services/vns-oekopunkte">VNS &amp; Ökopunkte</Link>.
            </p>

            <h2>Wo Sie Werte direkt einsehen</h2>
            <ul>
              <li><Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link> — Bodenrichtwert-Informationssystem für ganz NRW, kostenlos, mit Kartenansicht</li>
              <li><Link href="https://geoportal.kreislippe.de/geoportal/application/bodenrichtwerte" target="_blank" rel="noopener">Geoportal Kreis Lippe</Link> — kostenlose Kartenansicht der Lipper Werte</li>
              <li><Link href="https://www.kreis-lippe.de/gutachterausschuss" target="_blank" rel="noopener">Grundstücksmarktbericht 2025</Link> — kostenlos als PDF beim Gutachterausschuss</li>
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
    </>
  );
}
