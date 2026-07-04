import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Was kostet 1 Hektar Wald in NRW? Waldpreise 2026",
  description:
    "Waldpreise NRW: je nach Holzvorrat 8.000–50.000 €/ha, im Kreis Lippe wurden zuletzt Ø 13.400 €/ha gezahlt. Was Ihren Wald wirklich wertvoll macht — Bestand, Baumart, Erschließung, Jagd.",
  alternates: { canonical: "/ratgeber/wald-preis-nrw" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Waldpreise"
        title="Was kostet 1 Hektar Wald in NRW?"
        subtitle="Wald wird pro Hektar zwischen 8.000 und 50.000 € gehandelt — die Spanne ist riesig, weil der Aufwuchs oft mehr wert ist als der Boden. Hier die echten Zahlen und die Faktoren, die zählen."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Die kurze Antwort</h2>
            <p>
              Waldflächen kosten in Deutschland je nach Lage und Bestand etwa <strong>0,80 bis 5,00 € pro m²</strong> — also <strong>8.000 bis 50.000 € je Hektar</strong> inklusive Aufwuchs. Im Kreis Lippe wurden laut Grundstücksmarktbericht 2025 zuletzt im Schnitt <strong>1,34 €/m² (≈ 13.400 €/ha) inklusive Aufwuchs</strong> gezahlt. Der reine Waldboden ohne Bestand liegt deutlich darunter.
            </p>

            <h2>Warum die Spanne so groß ist: Boden + Aufwuchs</h2>
            <p>
              Ein Waldpreis besteht aus zwei Komponenten: dem <strong>Bodenwert</strong> (in NRW meist 0,3–1 €/m²) und dem <strong>Bestandswert</strong> — dem stehenden Holz. Ein hiebsreifer 100-jähriger Buchen- oder Eichenbestand kann den Hektarpreis vervielfachen, während eine frisch geräumte Käferfläche kaum mehr als den Bodenwert bringt.
            </p>
            <table className="w-full mt-3 border-collapse text-sm">
              <thead>
                <tr className="bg-[color:var(--color-brand-soft)] text-left">
                  <th className="p-3 border border-[color:var(--color-line)]">Waldtyp (typisch NRW)</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">Größenordnung je ha</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Kalamitätsfläche (Käfer, geräumt), Wiederaufforstungspflicht</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">3.000 – 8.000 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Junger Mischbestand (20–40 Jahre)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">8.000 – 15.000 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Mittelalter Bestand, gute Erschließung</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">15.000 – 25.000 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Hiebsreifer Laubholz-/Wertbestand</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">25.000 – 50.000 €+</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Orientierungswerte aus Marktbeobachtung und Grundstücksmarktbericht Kreis Lippe 2025; der Einzelfall hängt am konkreten Bestand.
            </p>

            <h2>Die sechs Werttreiber beim Waldverkauf</h2>
            <ul>
              <li><strong>Holzvorrat und Baumarten:</strong> Vorratsfestmeter × Holzpreis ist der Kern der Bewertung. Eiche und Douglasie bringen mehr als Fichte nach Käferjahren.</li>
              <li><strong>Alter und Pflegezustand:</strong> Durchforstete, stabile Bestände schlagen ungepflegte deutlich.</li>
              <li><strong>Erschließung:</strong> Ohne befahrbare Rückegassen und Zuwegung sinkt der Preis spürbar.</li>
              <li><strong>Kalamitätsrisiko:</strong> Fichten-Reinbestände in Südlagen handeln Käufer mit Risikoabschlag.</li>
              <li><strong>Jagd:</strong> Eigenjagdgröße (ab 75 ha) oder attraktive Jagdverpachtung erhöht die Nachfrage.</li>
              <li><strong>Fördersituation:</strong> Laufende Bindungen (z. B. <Link href="/services/vns-oekopunkte">VNS, Ökopunkte</Link>, Biotopbaumförderung) können Wert schaffen oder Auflagen bedeuten.</li>
            </ul>

            <h2>Bodenrichtwert Wald einsehen</h2>
            <p>
              Bodenrichtwerte für Forstflächen (ohne Aufwuchs!) finden Sie kostenlos in <Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link>; echte Kaufpreise inkl. Aufwuchs stehen im Grundstücksmarktbericht — unsere Auswertung für Lippe: <Link href="/ratgeber/bodenrichtwerte-lippe">Bodenrichtwerte Kreis Lippe</Link>.
            </p>

            <h2>Was ist Ihr Wald konkret wert?</h2>
            <p>
              Wir bewerten Bestand, Erschließung und Marktlage kostenlos — und machen bei Interesse ein direktes Ankaufangebot ohne Makler: <Link href="/wald-verkaufen">Wald verkaufen</Link> oder <Link href="/flaeche-bewerten">erst bewerten lassen</Link>.
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-wald-preis-nrw"
              defaultIntent="Bewertung"
              title="Wald-Werteinschätzung"
              subtitle="Bestand, Baumarten, Erschließung — wir sagen Ihnen in 24 h, was Ihr Wald heute realistisch bringt."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
