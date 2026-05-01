import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Grundstücksverkehrsgesetz NRW — was Verkäufer wissen müssen",
  description:
    "Genehmigungspflicht, siedlungsrechtliches Vorkaufsrecht, Landwirtschaftskammer: Was beim Verkauf landwirtschaftlicher Flächen ab 1 ha in NRW zu beachten ist.",
  alternates: { canonical: "/ratgeber/grundstuecksverkehrsgesetz" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber"
        title="Grundstücksverkehrsgesetz NRW — der praktische Leitfaden für Verkäufer."
        subtitle="Beim Verkauf landwirtschaftlicher Flächen ab 1 Hektar in NRW greifen Sonderregeln. Hier ein verständlicher Überblick — ohne Juristen-Deutsch."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Worum geht's?</h2>
            <p>
              Das Grundstücksverkehrsgesetz (GrdstVG) regelt den Verkauf landwirtschaftlich genutzter Flächen. Ziel: Erhalt der Agrarstruktur, Vermeidung der Zersplitterung von Betrieben und Verhinderung "ungesunder" Bodenverteilung. In NRW gilt eine <strong>Genehmigungsschwelle von 1 Hektar</strong> — Flächen ab dieser Größe brauchen eine Genehmigung der Landwirtschaftskammer.
            </p>

            <h2>Was bedeutet das konkret?</h2>
            <ol className="list-decimal pl-5 mt-4 space-y-2 text-[color:var(--color-ink-soft)]">
              <li>Sie und der Käufer schließen einen notariellen Kaufvertrag.</li>
              <li>Der Notar leitet den Vertrag der Landwirtschaftskammer NRW (Genehmigungsbehörde) zu.</li>
              <li>Die Behörde prüft innerhalb von max. 3 Monaten, ob die Voraussetzungen für eine Genehmigung vorliegen.</li>
              <li>Parallel wird das siedlungsrechtliche Vorkaufsrecht der NRW.URBAN bzw. eines beliehenen Siedlungsunternehmens (in NRW: Landgesellschaft) geprüft. Übt es das Vorkaufsrecht aus, "schlüpft" es in den Vertrag und wird zum Käufer.</li>
              <li>Bei Genehmigung: Eigentumsübergang läuft normal über das Grundbuch.</li>
            </ol>

            <h2>Wann wird die Genehmigung versagt?</h2>
            <p>
              Wenn der Verkauf "ungesund" wäre — also typischerweise:
            </p>
            <ul>
              <li>Käufer ist nicht-landwirtschaftlich und ein ortsansässiger Landwirt hätte konkret Bedarf</li>
              <li>Der vereinbarte Kaufpreis liegt deutlich (≥ 50 %) über dem ermittelten Verkehrswert</li>
              <li>Der Verkauf würde zu einer Zersplitterung führen, die der Agrarstruktur schadet</li>
            </ul>

            <h2>Wer profitiert vom siedlungsrechtlichen Vorkaufsrecht?</h2>
            <p>
              In NRW ist das die <strong>NRW.URBAN</strong> bzw. die <strong>Landgesellschaft NRW</strong>. Sie übt das Vorkaufsrecht aus, wenn der Käufer kein Landwirt ist und ein örtlicher Landwirt das Grundstück zu denselben Konditionen erwerben möchte. In der Praxis kommt das eher selten vor, ist aber im Hinterkopf zu behalten.
            </p>

            <h2>Was wir als Käufer tun</h2>
            <ul>
              <li>Wir kennen den Ablauf und stimmen den Notarvertrag entsprechend ab</li>
              <li>Wir kommunizieren mit der Landwirtschaftskammer und ziehen die Genehmigung zügig durch</li>
              <li>Wir tragen die behördliche Bearbeitungsdauer ein — keine Hängepartien</li>
              <li>Bei verpachteten Flächen: Pächter wird transparent eingebunden</li>
            </ul>

            <h2>Was Sie tun können</h2>
            <p>
              Sammeln Sie vorab alle Unterlagen zu Ihrer Fläche: Grundbuchauszug, Liegenschaftskarte, ggf. Pachtvertrag, ggf. Erbschein. Sprechen Sie uns gerne an — wir gehen den Ablauf gemeinsam mit Ihrem Notar durch, sodass keine Überraschungen entstehen.
            </p>
            <p>
              Übrigens: Auch unter 1 Hektar lohnt sich Sorgfalt — denn Vorkaufsrechte (Pächter, Miteigentümer) können auch hier greifen.
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-grundstuecksverkehrsgesetz"
              defaultIntent="Verkaufen"
              title="Verkaufsanfrage"
              subtitle="Wir kümmern uns um Genehmigung, Vorkaufsrecht und alles was dazu gehört."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
