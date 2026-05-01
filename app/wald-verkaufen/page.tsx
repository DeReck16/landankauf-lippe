import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Wald verkaufen Kreis Lippe & Teutoburger Wald — Privatwald-Ankauf",
  description:
    "Privatwald, Misch- oder Nadelholzbestand im Kreis Lippe verkaufen? Wir kaufen Forstflächen im Teutoburger Wald und der Egge — fair, diskret, ohne Provision.",
  alternates: { canonical: "/wald-verkaufen" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Privatwald · Forst"
        title="Wald verkaufen im Kreis Lippe — vom Teutoburger Wald bis zur Egge."
        subtitle="Misch- oder Nadelholzbestände, Käferflächen, Sturmwurfflächen, alte Eichenbestände — wir kaufen Privatwald in allen Größen ab ca. 0,5 Hektar im Teutoburger Wald, in der Egge, im Sauerländer Vorland und in den angrenzenden Kreisen."
        primaryCta={{ href: "#anfrage", label: "Wald-Anfrage" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Welchen Wald wir ankaufen</h2>
            <ul>
              <li>Privatwald jeglicher Bestockung — Buche, Eiche, Esche, Birke, Kiefer, Fichte, Douglasie</li>
              <li>Mischbestände und Laubholzparzellen</li>
              <li>Käfer-Kalamitätsflächen und Sturmwurfflächen</li>
              <li>Wiederaufforstungsflächen mit Pflanzungsrückstand</li>
              <li>Grundstücke mit Anteil an Forstbetriebsgemeinschaften (FBG)</li>
              <li>Waldränder, Knickstrukturen, Galeriewälder, Bachuferflächen</li>
              <li>Naturwald- und Bannwaldflächen — gerade hier mit Förderpotenzial</li>
            </ul>

            <h2>Wert eines Waldgrundstücks im Kreis Lippe</h2>
            <p>
              Die Bewertung von Waldflächen ist komplexer als die von Acker oder Wiese. Sie setzt sich zusammen aus dem Bodenwert (typischerweise 0,30–1,50 €/m²) und dem Bestandswert (vorratsabhängig: junge Aufforstung ist niedriger bewertet, hiebsreife Bestände entsprechend höher). Die Bandbreite reicht je nach Bestand, Erschließung und Marktlage von <strong>3.000–18.000 €/ha</strong>, in Einzelfällen mehr.
            </p>
            <p>
              Wir machen Ihnen — anders als manche Online-Rechner — keine Phantasiezahlen. Wir schauen uns die Fläche an, berücksichtigen Bestandsalter, Holzpreise, Erschließung, Pflegezustand und die Wegesituation. Dann bekommen Sie eine Zahl, die wir auch begründen können.
            </p>

            <h2>Käferholz, Sturmwurf, Aufforstungsflächen</h2>
            <p>
              Sie haben einen Fichtenbestand, der dem Borkenkäfer zum Opfer gefallen ist? Eine Sturmwurffläche, die seit Jahren brachliegt? Eine Wiederaufforstungspflicht, die Sie nicht stemmen können? Genau diese Flächen sind für uns interessant — wir kaufen, lassen aufforsten oder konvertieren in Mischwald, mit Förderung und Lohnunternehmer-Vermittlung.
            </p>

            <h2>Förderpotenzial: Biotopbaum, Ökopunkte, Klimaschutz</h2>
            <p>
              Bevor Sie einen alten Eichen- oder Buchenbestand verkaufen, prüfen wir, ob Sie ihn nicht behalten und über die <Link href="/services/vns-oekopunkte">FöRL Privat- und Körperschaftswald NRW</Link> als Biotopbaum-Bestand sichern wollen. Eine Eiche mit 60 cm Brusthöhendurchmesser bringt einmalig <strong>bis zu 690 €</strong>, eine 80-cm-Eiche bis zu 1.400 € — bei Eigentumserhalt.
            </p>

            <h2>Was wir nicht tun</h2>
            <ul>
              <li>Keine Pauschalangebote ohne Bestandsbesichtigung</li>
              <li>Keine "Investorenversprechen", die später nicht eingehalten werden</li>
              <li>Keine Kahlschlag-Strategien — wir bewirtschaften nachhaltig</li>
            </ul>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="wald-verkaufen"
              defaultIntent="Verkaufen"
              defaultFlaechentyp="Wald / Forst"
              title="Wald-Anfrage"
              subtitle="Beschreiben Sie uns kurz Größe, Lage und Bestand — wir antworten innerhalb von 24 Stunden."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
