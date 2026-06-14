import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Wiese & Grünland verkaufen Kreis Lippe — fairer Direktankauf",
  description:
    "Wiese oder Grünland im Kreis Lippe verkaufen? Wir kaufen auch extensive Mähwiesen, Streuobstwiesen und Hangflächen — direkt, ohne Provision, mit Diskretion.",
  alternates: { canonical: "/wiese-verkaufen" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Wiese · Grünland · Streuobst"
        title="Wiese verkaufen im Kreis Lippe — auch wenn niemand sie pachten will."
        subtitle="Extensive Mähwiesen, Streuobstwiesen, Hangflächen und Talauen sind oft schwer zu verpachten — aber für uns interessant. Wir kaufen Grünland in allen Lipper Gemeinden zum fairen Marktpreis."
        primaryCta={{ href: "#anfrage", label: "Unverbindlich bewerten" }}
        whatsappCta={{
          href: `https://wa.me/${site.contact.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Guten Tag, ich möchte meine Wiese / mein Grünland im Kreis Lippe verkaufen — bitte um eine diskrete Erstbewertung.")}`,
          label: "WhatsApp",
        }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe order-2 lg:order-1">
            <h2>Welche Wiesen wir ankaufen</h2>
            <ul>
              <li>Klassisches Wirtschaftsgrünland — Mahd, Standweide, Mähweide</li>
              <li>Extensiv genutzte Mähwiesen, gerne auch FFH-Lebensraumtypen 6510 / 6520</li>
              <li>Streuobstwiesen — auch verwildert, mit Pflegerückstand</li>
              <li>Hangflächen, Talauen, schwer bewirtschaftbare Flächen</li>
              <li>Grünland mit Heckenstrukturen, Knicks, Tümpeln, Saumstrukturen</li>
              <li>Konversions- und ehemalige Brachflächen</li>
            </ul>

            <h2>Bodenrichtwerte für Grünland Kreis Lippe</h2>
            <p>
              Grünland in Lippe wird typischerweise im Verhältnis 1 : 1,6 zum Ackerland bewertet — also durchschnittlich rund <strong>0,8–2,0 €/m²</strong> je nach Lage und Bodenqualität. Hangflächen oder Schutzgebietsflächen liegen oft niedriger; gut bewirtschaftbare Talgrundlagen können höher liegen.
            </p>
            <p>
              Diese Werte sind nur ein Ausgangspunkt. Wenn Ihre Fläche FFH-relevant ist oder im Vertragsnaturschutz liegt, kann sie über die VNS-Förderung deutlich werthaltiger sein als das reine Pachtpotenzial. Mehr dazu auf der <Link href="/services/vns-oekopunkte">Seite zu VNS und Ökopunkten</Link>.
            </p>

            <h2>Sonderfall Streuobstwiese</h2>
            <p>
              Streuobstwiesen sind ökologisch unschätzbar wertvoll — und werden in NRW über VNS-Pakete und Ökopunkte gut gefördert. Wenn Sie eine alte, verwilderte Streuobstwiese geerbt haben und nicht wissen wohin damit: Wir kaufen, übernehmen die Pflege und beantragen die passende Förderung. Sie haben keinen Aufwand, die Wiese bleibt erhalten.
            </p>

            <h2>Wiesen mit Pachtvertrag</h2>
            <p>
              Auch verpachtete Wiesen kaufen wir an. Bei Pachtverhältnissen mit langer Restlaufzeit oder Sonderpachten sprechen wir das mit Ihnen und dem Pächter ab. Vorkaufsrechte werden selbstverständlich beachtet.
            </p>

            <h2>Was die Kontaktaufnahme kostet</h2>
            <p>
              Nichts. Wir machen Ihnen ein konkretes Kaufangebot, sobald wir die Eckdaten Ihrer Wiese kennen. Sie entscheiden, ob Sie verkaufen möchten — kein Druck, keine Provision, keine versteckten Kosten.
            </p>
          </article>
          <aside id="anfrage" className="order-1 lg:order-2 lg:sticky lg:top-24 self-start">
            <LeadForm
              source="wiese-verkaufen"
              defaultIntent="Verkaufen"
              defaultFlaechentyp="Wiese / Grünland"
              title="Wiesen-Anfrage"
              subtitle="Wir melden uns innerhalb von 24 Stunden mit einer ehrlichen Einschätzung."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
