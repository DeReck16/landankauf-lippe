import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Was kostet 1 Hektar Ackerland in NRW? Aktuelle Preise 2026",
  description:
    "Ackerland-Preise NRW aktuell: Ø 87.240 €/ha (IT.NRW), Spanne 55.000–129.000 €/ha je Region. Alle Zahlen für Regierungsbezirke und Kreis Lippe — plus was Ihre Fläche wirklich wert ist.",
  alternates: { canonical: "/ratgeber/ackerland-preis-nrw" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Kaufpreise"
        title="Was kostet 1 Hektar Ackerland in NRW?"
        subtitle="Die kurze Antwort: im Landesschnitt rund 87.000 € pro Hektar — aber die Spanne reicht je nach Region von unter 40.000 € bis weit über 100.000 €. Hier die offiziellen Zahlen und was sie für Ihre Fläche bedeuten."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Der aktuelle Durchschnittspreis in NRW</h2>
            <p>
              Nach der amtlichen Kaufwertestatistik von <Link href="https://statistik.nrw/wirtschaft-und-umwelt/preise/bodenmarkt/kaufwerte-fuer-landwirtschaftliche-grundstuecke" target="_blank" rel="noopener">IT.NRW</Link> lag der durchschnittliche Kaufwert für landwirtschaftliche Grundstücke in Nordrhein-Westfalen zuletzt bei rund <strong>87.240 € je Hektar</strong> (Fläche der landwirtschaftlichen Nutzung, Kauffälle 2023). Das ist der mit Abstand höchste Wert aller Bundesländer — der Bundesdurchschnitt liegt bei etwa einem Drittel davon.
            </p>
            <p>
              Umgerechnet sind das etwa <strong>8,70 € pro m²</strong> im Landesschnitt. Ein einzelner Durchschnittswert sagt über eine konkrete Fläche aber wenig — entscheidend ist die Region.
            </p>

            <h2>Preise nach Regierungsbezirk</h2>
            <table className="w-full mt-3 border-collapse text-sm">
              <thead>
                <tr className="bg-[color:var(--color-brand-soft)] text-left">
                  <th className="p-3 border border-[color:var(--color-line)]">Region</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">Ø Kaufwert je ha</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Regierungsbezirk Münster (Münsterland)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 129.300 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">NRW gesamt</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 87.200 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Regierungsbezirk Arnsberg (Sauerland/Ruhr)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 55.600 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Kreis Lippe (tatsächliche Kauffälle 2024)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 52.600 € (5,26 €/m²)</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Quellen: IT.NRW Kaufwertestatistik (Kauffälle 2023); Grundstücksmarktbericht 2025 des Gutachterausschusses Kreis Lippe (Kauffälle 2024, Flächen &gt; 2.500 m²).
            </p>
            <p>
              In den Münsterland-Kreisen Steinfurt, Warendorf, Coesfeld und Borken wurden im Schnitt sogar mehr als <strong>100.000 € je Hektar</strong> gezahlt — dort treffen intensive Tierhaltung und Flächenknappheit aufeinander. Ostwestfalen-Lippe liegt deutlich darunter, aber mit stark steigender Tendenz: Im Kreis Lippe stiegen die Ackerlandkäufe 2024 in Anzahl (+39 %), Fläche (+89 %) und Geldumsatz (+162 %) gegenüber dem Vorjahr.
            </p>

            <h2>Was den Preis Ihrer Fläche wirklich bestimmt</h2>
            <ul>
              <li><strong>Bodengüte (Ackerzahl):</strong> Eine Fläche mit Ackerzahl 70 ist pro Hektar deutlich mehr wert als eine mit 40. Die Bodenrichtwerte in NRW beziehen sich meist auf ein Richtwertgrundstück mit Ackerzahl 55.</li>
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
    </>
  );
}
