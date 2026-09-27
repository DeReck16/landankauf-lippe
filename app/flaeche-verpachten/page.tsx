import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import AblaufFristen from "@/components/AblaufFristen";
import { seitenMetadaten } from "@/lib/seo";

export const metadata: Metadata = seitenMetadaten({
  title: "Fläche verpachten in Lippe – fairer Pachtzins",
  description:
    "Ackerland oder Wiese im Kreis Lippe verpachten? Wir vermitteln einen verlässlichen Pächter aus der Region — für Sie als Eigentümer kostenlos, auf Wunsch mit Online-Pachtvertrag.",
  pfad: "/flaeche-verpachten",
});

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Verpachtung"
        title="Verpachten ohne Kopfschmerzen — verlässliche Pächter aus dem Lipper Land."
        subtitle="Sie wollen Ihre Fläche nicht verkaufen, sondern Pachteinnahmen generieren — ohne sich um Mahd, Pflege oder Bürokratie kümmern zu müssen? Wir vermitteln Ihnen passende Pächter — für Sie als Eigentümer kostenlos."
        primaryCta={{ href: "#anfrage", label: "Pacht-Angebot anfragen" }}
        secondaryCta={{ href: "/flaeche-bewerten", label: "Pachtwert ermitteln" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Wie wir verpachten</span>
            <hr className="divider mt-3" />
            <h2>So vermitteln wir Ihre Fläche.</h2>
            <p>
              Wir stellen Ihre Fläche passenden Betrieben aus der Region vor — zuerst anonym, Kontaktdaten erst nach Ihrer Zustimmung. Für Sie als Eigentümer ist das kostenlos; nur der Pächter zahlt im Erfolgsfall eine Provision. Den Pachtvertrag schließen Sie direkt mit dem Pächter, auf Wunsch online über unsere Vorlage (Textform, § 585a BGB).
            </p>
            <p>
              Möchten Sie doch lieber verkaufen? Die TR Vertriebs GmbH (Betreiberin von Lippe Forst) kauft geeignete Flächen auch selbst — ohne Makler und ohne Provision. Mehr unter <Link href="/flaeche-verkaufen">Fläche verkaufen</Link>.
            </p>

            <h2>Pachtspiegel Kreis Lippe</h2>
            <p>
              Die Pachtpreise im Kreis Lippe variieren stark — je nach Bodenqualität (Bodenpunkte), Lage, Erschließung und Bewirtschaftbarkeit. Grobe Orientierung für 2026:
            </p>
            <ul>
              <li><strong>Ackerland:</strong> 250 – 750 €/ha/Jahr — gute Lagen (Bonität 55+, hofnah) 550 – 750, schwere Lagen 250 – 380</li>
              <li><strong>Grünland:</strong> 120 – 380 €/ha/Jahr — intensiv nutzbar 250 – 380, extensiv oft nur Pflegeentgelt</li>
              <li><strong>Hangflächen / extensiv:</strong> oft nur Pflegeentgelt — hier lohnt sich ein Blick auf <Link href="/services/vns-oekopunkte">Vertragsnaturschutz</Link></li>
              <li><strong>Sondernutzung Photovoltaik:</strong> 2.500 – 4.500 €/ha/Jahr, an Spitzenstandorten bis ca. 5.000 €, langfristige Verträge — Details auf <Link href="/solarpark-verpachten">Solarpark verpachten</Link></li>
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
              Wir schlagen nicht einfach den Höchstbietenden vor, sondern Betriebe, die mit der Fläche sorgsam umgehen: regelmäßige Pflege, Düngung im Rahmen, keine Maximalausnutzung. So bleibt Ihre Fläche auch in 20 Jahren noch eine wertvolle Fläche. An wen Sie verpachten, entscheiden Sie.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="flaeche-verpachten"
              defaultIntent="Verpachten"
              title="Pacht-Anfrage"
              subtitle="Wir melden uns in der Regel innerhalb eines Werktags per E-Mail mit einem konkreten Vorschlag."
            />
          </aside>
        </div>
      </section>

      <AblaufFristen art="pacht" />
    </>
  );
}
