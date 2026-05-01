import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Fläche verpachten im Kreis Lippe — verlässlicher Pachtzins, kein Aufwand",
  description:
    "Sie wollen Ackerland, Wiese oder Wald im Kreis Lippe verpachten? Wir bewirtschaften selbst oder vermitteln Ihnen einen verlässlichen Pächter aus der Region — mit fairem Pachtzins und langfristigem Vertrag.",
  alternates: { canonical: "/flaeche-verpachten" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Verpachtung"
        title="Verpachten ohne Kopfschmerzen — verlässliche Pächter aus dem Lipper Land."
        subtitle="Sie wollen Ihre Fläche nicht verkaufen, sondern Pachteinnahmen generieren — ohne sich um Mahd, Pflege oder Bürokratie kümmern zu müssen? Wir sind Ihr direkter Ansprechpartner."
        primaryCta={{ href: "#anfrage", label: "Pacht-Angebot anfragen" }}
        secondaryCta={{ href: "/flaeche-bewerten", label: "Pachtwert ermitteln" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Wie wir verpachten</span>
            <hr className="divider mt-3" />
            <h2>Zwei Wege — Sie entscheiden, was passt.</h2>
            <h3>Option 1 — Wir pachten direkt</h3>
            <p>
              Sie verpachten Ihre Fläche an uns. Wir bewirtschaften sie entweder selbst oder vergeben sie an einen Unterpächter aus unserem Netzwerk. Sie haben einen einzigen Ansprechpartner, einen einzigen Pachtzahler und müssen sich um nichts mehr kümmern.
            </p>
            <h3>Option 2 — Wir vermitteln einen Pächter</h3>
            <p>
              Sie wollen lieber direkt mit einem Landwirt zusammenarbeiten? Wir kennen die Lipper Betriebe und vermitteln Ihnen einen passenden Pächter — mit fairem Vertrag, ohne Vermittlungsprovision für Sie.
            </p>

            <h2>Pachtspiegel Kreis Lippe</h2>
            <p>
              Die Pachtpreise im Kreis Lippe variieren stark — je nach Bodenqualität (Bodenpunkte), Lage, Erschließung und Bewirtschaftbarkeit. Grobe Orientierung für 2026:
            </p>
            <ul>
              <li><strong>Ackerland:</strong> 350 – 750 €/ha/Jahr (Schwerpunkt Lippe)</li>
              <li><strong>Grünland:</strong> 180 – 380 €/ha/Jahr</li>
              <li><strong>Hangflächen / extensiv:</strong> oft nur Pflegeentgelt — hier lohnt sich ein Blick auf <Link href="/services/vns-oekopunkte">Vertragsnaturschutz</Link></li>
              <li><strong>Sondernutzung (z. B. Photovoltaik):</strong> 3.500 – 5.000 €/ha/Jahr, langfristige Verträge nötig</li>
            </ul>
            <p>
              Den exakten Wert Ihrer Fläche besprechen wir gerne im Detail — kostenlos und unverbindlich.
            </p>

            <h2>Welche Vertragsformen sind möglich?</h2>
            <ul>
              <li>Klassischer Landpachtvertrag, in der Regel 5–12 Jahre</li>
              <li>Erntenutzungsverträge (z. B. nur Grasschnitt)</li>
              <li>Pflegeverträge für extensives Grünland</li>
              <li>Kombination aus Pacht + VNS-Förderung (höchster Ertrag bei extensiven Flächen)</li>
              <li>Photovoltaik-Pacht über spezialisierte Investoren</li>
            </ul>

            <h2>Was uns wichtig ist</h2>
            <p>
              Wir verpachten nicht an den Höchstbietenden, sondern an Betriebe, die mit der Fläche sorgsam umgehen. Wer von uns pachtet, weiß: regelmäßige Pflege, Düngung im Rahmen, keine Maximalausnutzung. So bleibt Ihre Fläche auch in 20 Jahren noch eine wertvolle Fläche.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="flaeche-verpachten"
              defaultIntent="Verpachten"
              title="Pacht-Anfrage"
              subtitle="Wir melden uns innerhalb von 24 Stunden mit einem konkreten Vorschlag."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
