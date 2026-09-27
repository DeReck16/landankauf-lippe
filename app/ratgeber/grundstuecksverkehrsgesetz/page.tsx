import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { ratgeberSchema, seitenMetadaten } from "@/lib/seo";

const TITEL = "Grundstücksverkehrsgesetz NRW für Verkäufer";
const BESCHREIBUNG =
  "Genehmigungspflicht ab mehr als 1 ha, siedlungsrechtliches Vorkaufsrecht ab 2 ha, Fristen der Behörde: Was beim Verkauf land- und forstwirtschaftlicher Flächen in NRW zu beachten ist.";
const PFAD = "/ratgeber/grundstuecksverkehrsgesetz";

export const metadata: Metadata = seitenMetadaten({
  title: TITEL,
  description: BESCHREIBUNG,
  pfad: PFAD,
});

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber"
        title="Grundstücksverkehrsgesetz NRW — der praktische Leitfaden für Verkäufer."
        subtitle="Beim Verkauf land- und forstwirtschaftlicher Flächen über 1 Hektar greifen in NRW Sonderregeln. Hier ein verständlicher Überblick — ohne Juristen-Deutsch."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Worum geht’s?</h2>
            <p>
              Das Grundstücksverkehrsgesetz (GrdstVG) regelt den Verkauf landwirtschaftlich genutzter Flächen. Ziel: Erhalt der Agrarstruktur, Vermeidung der Zersplitterung von Betrieben und Verhinderung „ungesunder“ Bodenverteilung. In NRW sind Verkäufe bis 1 Hektar genehmigungsfrei; <strong>Flächen von mehr als 1 Hektar</strong> brauchen eine Genehmigung. Zuständig ist die Kreisstelle der Landwirtschaftskammer als Landesbeauftragte.
            </p>

            <h2>Was bedeutet das konkret?</h2>
            <ol className="list-decimal pl-5 mt-4 space-y-2 text-[color:var(--color-ink-soft)]">
              <li>Sie und der Käufer schließen einen notariellen Kaufvertrag.</li>
              <li>Der Notar beantragt die Genehmigung bei der Genehmigungsbehörde (Kreisstelle der Landwirtschaftskammer NRW).</li>
              <li>Die Behörde entscheidet binnen eines Monats; mit Zwischenbescheid binnen zwei, bei einem möglichen Vorkaufsrecht binnen drei Monaten (§ 6 GrdstVG). Entscheidet sie nicht fristgerecht, gilt die Genehmigung als erteilt.</li>
              <li>Ab 2 Hektar wird parallel das siedlungsrechtliche Vorkaufsrecht geprüft. In NRW übt es das gemeinnützige Siedlungsunternehmen NRW.URBAN aus — eine eigene Landgesellschaft gibt es in NRW nicht. Übt es das Vorkaufsrecht aus, „schlüpft“ es in den Vertrag und wird zum Käufer.</li>
              <li>Bei Genehmigung: Eigentumsübergang läuft normal über das Grundbuch.</li>
            </ol>

            <h2>Wann wird die Genehmigung versagt?</h2>
            <p>
              Wenn der Verkauf „ungesund“ wäre — also typischerweise:
            </p>
            <ul>
              <li>Käufer ist nicht-landwirtschaftlich und ein ortsansässiger Landwirt hätte konkret Bedarf</li>
              <li>Der vereinbarte Kaufpreis liegt deutlich (≥ 50 %) über dem ermittelten Verkehrswert</li>
              <li>Der Verkauf würde zu einer Zersplitterung führen, die der Agrarstruktur schadet</li>
            </ul>

            <h2>Wer profitiert vom siedlungsrechtlichen Vorkaufsrecht?</h2>
            <p>
              Ausgeübt wird es in NRW vom gemeinnützigen Siedlungsunternehmen <strong>NRW.URBAN</strong> — bei Flächen ab 2 Hektar, wenn der Käufer kein Landwirt ist und ein örtlicher Landwirt das Grundstück dringend braucht und zu denselben Konditionen übernehmen möchte. In der Praxis kommt das eher selten vor, ist aber im Hinterkopf zu behalten.
            </p>

            <h2>Was wir tun — als Käufer oder als Vermittler</h2>
            <ul>
              <li>Wir kennen den Ablauf und stimmen den Notarvertrag entsprechend ab</li>
              <li>Wir stimmen uns mit Notar und Behörde ab, damit der Antrag vollständig ist</li>
              <li>Wir planen die behördliche Bearbeitungsdauer von Anfang an ein — keine Hängepartien</li>
              <li>Bei verpachteten Flächen: Pächter wird transparent eingebunden</li>
            </ul>

            <h2>Was Sie tun können</h2>
            <p>
              Sammeln Sie vorab alle Unterlagen zu Ihrer Fläche: Grundbuchauszug, Liegenschaftskarte, ggf. Pachtvertrag, ggf. Erbschein. Sprechen Sie uns gerne an — wir gehen den Ablauf gemeinsam mit Ihrem Notar durch, sodass keine Überraschungen entstehen.
            </p>
            <p>
              Übrigens: Auch unter 1 Hektar lohnt sich Sorgfalt — denn andere Vorkaufsrechte können auch hier greifen: etwa das der Gemeinde nach dem Baugesetzbuch oder ein im Grundbuch eingetragenes bzw. im Pachtvertrag vereinbartes Vorkaufsrecht. Ein gesetzliches Vorkaufsrecht des Pächters gibt es dagegen nicht.
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-grundstuecksverkehrsgesetz"
              defaultIntent="Verkaufen"
              title="Verkaufsanfrage"
              subtitle="Wir kennen Genehmigung und Vorkaufsrecht — ob wir selbst kaufen oder einen Käufer vermitteln."
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
