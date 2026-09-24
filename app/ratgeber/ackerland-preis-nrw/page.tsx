import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { ratgeberSchema, seitenMetadaten } from "@/lib/seo";

const TITEL = "Was kostet 1 ha Ackerland in NRW? Preise 2026";
const BESCHREIBUNG =
  "Ackerland-Preise NRW: Ø 80.732 €/ha (IT.NRW, Kauffälle 2025), je Regierungsbezirk rund 45.000–121.500 €/ha. Alle Zahlen für NRW, OWL und den Kreis Lippe.";
const PFAD = "/ratgeber/ackerland-preis-nrw";

export const metadata: Metadata = seitenMetadaten({
  title: TITEL,
  description: BESCHREIBUNG,
  pfad: PFAD,
});

const zelle = "p-3 border border-[color:var(--color-line)]";

// IT.NRW, Kaufwerte für landwirtschaftliche Grundstücke 2025 (Pressemitteilung 21.08.2026);
// Kreis Lippe: Grundstücksmarktberichte 2025/2026, Ackerland > 2.500 m², Umsatz je Fläche.
const REGIONEN: [string, string][] = [
  ["Regierungsbezirk Münster (Münsterland)", "≈ 121.500 €"],
  ["Regierungsbezirk Düsseldorf", "≈ 102.800 €"],
  ["NRW gesamt", "≈ 80.700 €"],
  ["Regierungsbezirk Köln", "≈ 74.400 €"],
  ["Regierungsbezirk Detmold (Ostwestfalen-Lippe)", "≈ 57.300 €"],
  ["Regierungsbezirk Arnsberg (Sauerland/Ruhr)", "≈ 45.200 €"],
  ["Kreis Lippe, Ackerland (Kauffälle 2024 / 2025)", "≈ 52.600 € / ≈ 38.000 €"],
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Kaufpreise"
        title="Was kostet 1 Hektar Ackerland in NRW?"
        subtitle="Die kurze Antwort: im Landesschnitt rund 80.700 € pro Hektar — aber die Spanne reicht je nach Regierungsbezirk von rund 45.000 € bis über 120.000 €. Hier die offiziellen Zahlen und was sie für Ihre Fläche bedeuten."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe min-w-0">
            <h2>Der aktuelle Durchschnittspreis in NRW</h2>
            <p>
              Nach der amtlichen Kaufwertestatistik von <Link href="https://statistik.nrw/wirtschaft-und-umwelt/preise/bodenmarkt/kaufwerte-fuer-landwirtschaftliche-grundstuecke" target="_blank" rel="noopener">IT.NRW</Link> lag der durchschnittliche Kaufwert für landwirtschaftliche Grundstücke in Nordrhein-Westfalen 2025 bei rund <strong>80.732 € je Hektar</strong> — nach 81.953 € (2024) und 87.240 € (2023). Die Preise haben also zwei Jahre in Folge leicht nachgegeben, während die Zahl der Verkäufe 2025 um 28,6 % auf 1.907 stieg. NRW gehört damit weiter zu den teuersten Bodenmärkten Deutschlands; der Bundesdurchschnitt liegt deutlich darunter.
            </p>
            <p>
              Umgerechnet sind das etwa <strong>8,07 € pro m²</strong> im Landesschnitt. Ein einzelner Durchschnittswert sagt über eine konkrete Fläche aber wenig — entscheidend ist die Region.
            </p>

            <h2>Preise nach Regierungsbezirk</h2>
            <div className="overflow-x-auto">
              <table className="w-full mt-3 border-collapse text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-brand-soft)] text-left">
                    <th className={zelle}>Region</th>
                    <th className={`${zelle} text-right`}>Ø Kaufwert je ha</th>
                  </tr>
                </thead>
                <tbody>
                  {REGIONEN.map(([region, wert]) => (
                    <tr key={region}>
                      <td className={zelle}>{region}</td>
                      <td className={`${zelle} text-right`}>{wert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Quellen: IT.NRW, Kaufwerte für landwirtschaftliche Grundstücke 2025 (Pressemitteilung vom 21.08.2026); Grundstücksmarktberichte 2025 und 2026 des Gutachterausschusses Kreis Lippe (Ackerland, Kauffälle &gt; 2.500 m², Geldumsatz je Fläche — der Gutachterausschuss wertet das Preisniveau 2025 als konstant).
            </p>
            <p>
              Im Regierungsbezirk Münster (u. a. mit den Kreisen Steinfurt, Warendorf, Coesfeld und Borken) wurden 2025 im Schnitt über 120.000 € je Hektar gezahlt — dort treffen intensive Tierhaltung und Flächenknappheit aufeinander. Ostwestfalen-Lippe liegt mit rund 57.300 € deutlich darunter. Im Kreis Lippe zog dafür das Handelsvolumen an: 2024 stiegen die Ackerlandkäufe in Anzahl (+39 %), Fläche (+89 %) und Geldumsatz (+162 %), 2025 kamen noch einmal 24 % mehr land- und forstwirtschaftliche Kauffälle hinzu.
            </p>

            <h2>Was den Preis Ihrer Fläche wirklich bestimmt</h2>
            <ul>
              <li><strong>Bodengüte (Ackerzahl):</strong> Eine Fläche mit Ackerzahl 70 ist pro Hektar deutlich mehr wert als eine mit 40. Die Bodenrichtwerte im Kreis Lippe beziehen sich auf ein Richtwertgrundstück mit Ackerzahl 55.</li>
              <li><strong>Schlaggröße und Zuschnitt:</strong> Große, gut maschinengängige Schläge erzielen Aufschläge; kleine Splitterflächen Abschläge.</li>
              <li><strong>Pachtstatus:</strong> Frei verfügbare Flächen sind mehr wert als langfristig verpachtete.</li>
              <li><strong>Lage zum Käufer:</strong> Der aufstockende Landwirt nebenan zahlt oft mehr als der Bodenrichtwert hergibt.</li>
              <li><strong>Sonderpotenziale:</strong> Bauerwartung, PV-Eignung, Ausgleichsflächen-Potenzial (<Link href="/services/vns-oekopunkte">VNS &amp; Ökopunkte</Link>) können den Wert vervielfachen.</li>
            </ul>

            <h2>Wo Sie offizielle Werte einsehen</h2>
            <ul>
              <li><Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link> — kostenloses Bodenrichtwert-Informationssystem für ganz NRW</li>
              <li><Link href="/ratgeber/bodenrichtwerte-lippe">Bodenrichtwerte Kreis Lippe</Link> — unsere Auswertung des Grundstücksmarktberichts mit echten Kaufpreisen</li>
            </ul>

            <h2>Vom Durchschnittspreis zum konkreten Angebot</h2>
            <p>
              Statistik ist der Anfang, nicht das Ende. Wir bewerten Ihre Fläche kostenlos anhand von Bonität, Zuschnitt, Pachtstatus und echten Vergleichsverkäufen aus Ihrer Gemarkung — und sagen Ihnen, was heute realistisch erzielbar ist. Wenn es passt, kaufen wir direkt an: <Link href="/ackerland-verkaufen">Ackerland verkaufen</Link> oder erst einmal <Link href="/flaeche-bewerten">kostenlos bewerten lassen</Link>.
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-ackerland-preis-nrw"
              defaultIntent="Bewertung"
              title="Was ist Ihr Acker wert?"
              subtitle="Kostenlose Werteinschätzung auf Basis echter Vergleichsverkäufe aus Ihrer Gemarkung — in 24 h."
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
