import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import QuickValuation from "@/components/QuickValuation";
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

      <section className="section border-b border-black/5">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.05fr] items-start">
          <div>
            <p className="eyebrow">Kurzantwort</p>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 leading-snug">Was ist Grünland im Kreis Lippe wert?</h2>
            <p className="mt-4 text-lg leading-relaxed">2024 wurden im Kreis Lippe <strong>24 Kauffälle über 34,32 Hektar</strong> Grünland beurkundet — im Mittel <strong>1,89 €/m²</strong>, also rund <strong>18.900 € je Hektar</strong>. Ausschlaggebend ist die Bewirtschaftbarkeit: Hang- und Schutzgebietsflächen liegen niedriger, gut befahrbare Talgrundlagen höher. Rechnen Sie Ihre Wiese rechts durch — anonym, ohne Kontaktdaten.</p>
            <p className="mt-4 text-sm text-[color:var(--color-muted)] leading-relaxed">
              Quelle: Grundstücksmarktbericht 2025 für den Kreis Lippe (Berichtsjahr 2024),
              Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold.
               Liegt die Fläche im Vertragsnaturschutz, kann die Förderung den reinen Flächenwert deutlich übersteigen.
            </p>
          </div>
          <div className="card">
            <QuickValuation
              compact
              defaultTyp="gruenland"
              ctaHref="#anfrage"
              heading="Was bringt meine Wiese?"
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe order-1">
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
              Grünland erreicht in Lippe deutlich weniger als Ackerland: dem Ackerland-Mittel von 5,26 €/m² standen 2024 beim Grünland <strong>1,89 €/m²</strong> gegenüber — etwa ein Drittel. Die übliche Spanne liegt bei <strong>0,95–2,85 €/m²</strong> (rund 9.500–28.500 €/ha). Hangflächen und Schutzgebietsflächen liegen darunter, gut befahrbare Talgrundlagen darüber.
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
          <aside id="anfrage" className="order-2 lg:sticky lg:top-24 self-start">
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
