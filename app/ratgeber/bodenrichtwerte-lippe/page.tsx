import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Bodenrichtwerte Kreis Lippe — Übersicht und Praxistipps 2026",
  description:
    "Aktuelle Bodenrichtwerte für landwirtschaftliche Flächen im Kreis Lippe: Was sie aussagen, wo Sie sie einsehen und wie Sie sie für Verkauf, Pacht oder Erbauseinandersetzung nutzen.",
  alternates: { canonical: "/ratgeber/bodenrichtwerte-lippe" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber"
        title="Bodenrichtwerte Kreis Lippe — was sie aussagen und wie Sie sie nutzen."
        subtitle="Der Bodenrichtwert ist der wichtigste Ausgangspunkt für jede Wertindikation. Hier die Grundlagen, die Quellen und die typischen Spannen für Ackerland, Grünland und Wald in Lippe."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Was ist ein Bodenrichtwert?</h2>
            <p>
              Der Bodenrichtwert ist ein durchschnittlicher Lagewert für unbebaute Grundstücke in einer Bodenrichtwertzone. Er wird vom <strong>Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold</strong> auf Basis tatsächlicher Verkaufsfälle ermittelt und jährlich neu beschlossen. Er gilt nicht für ein konkretes Grundstück, sondern für eine ganze Zone — Ihre Fläche kann also höher oder niedriger liegen.
            </p>

            <h2>Wo finde ich die aktuellen Werte?</h2>
            <ul>
              <li><Link href="https://geoportal.kreislippe.de/geoportal/application/bodenrichtwerte" target="_blank" rel="noopener">Geoportal Kreis Lippe</Link> — kostenlos, mit Kartenansicht</li>
              <li><Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link> — Bodenrichtwert-Informationssystem für ganz NRW</li>
              <li>Grundstücksmarktbericht des Gutachterausschusses Kreis Lippe (jährlich, kostenpflichtig)</li>
            </ul>

            <h2>Typische Spannen im Kreis Lippe (Stand 2025/2026)</h2>
            <ul>
              <li><strong>Ackerland:</strong> 1,40–4,50 €/m² (≈ 14.000–45.000 €/ha)</li>
              <li><strong>Grünland:</strong> 0,80–2,00 €/m² (≈ 8.000–20.000 €/ha) — durchschnittliches Verhältnis Grünland zu Ackerland: 1 : 1,6</li>
              <li><strong>Wald:</strong> Bodenwert 0,30–1,50 €/m², zzgl. Bestandswert</li>
              <li><strong>Bauland (zum Vergleich):</strong> Detmold lt. BORIS NRW bei rund 99 €/m² (deutliche Steigerung)</li>
            </ul>

            <h2>Was der Bodenrichtwert NICHT abbildet</h2>
            <ul>
              <li>Konkrete Bodenqualität / Ackerzahl Ihres Flurstücks</li>
              <li>Hangneigung und Bewirtschaftbarkeit</li>
              <li>Zuschnitt und Erschließung</li>
              <li>Eingetragene Lasten (Wegerecht, Leitungsrecht, Vorkaufsrechte)</li>
              <li>Schutzgebietskulisse (FFH, NSG, Wasserschutz)</li>
              <li>Bestockung bei Wald (Vorrat, Alter, Sortiment)</li>
              <li>Pachtstatus und Pachtdauer</li>
              <li>Förderpotenzial (VNS, Ökopunkte, Biotopbaum)</li>
            </ul>

            <h2>So kommen Sie zum echten Marktwert</h2>
            <p>
              Bodenrichtwert × Größe ist der Anfang, nicht das Ende. Die echte Wertindikation ergibt sich aus Bodenrichtwert + Vergleichsverkäufe + spezifischen Eigenschaften Ihres Grundstücks. Genau das machen wir kostenlos für Sie. <Link href="/flaeche-bewerten">Hier kostenlose Bewertung anfragen</Link>.
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
