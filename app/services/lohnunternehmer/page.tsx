import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Lohnunternehmer im Kreis Lippe — Mahd, Pflege, Forstarbeit",
  description:
    "Wir vermitteln verlässliche Lohnunternehmer aus dem Kreis Lippe für Mahd, Heuwerbung, Heckenpflege, Forstarbeiten und mehr. Faire Preise, kurze Wege, regionale Betriebe.",
  alternates: { canonical: "/services/lohnunternehmer" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Vermittlung"
        title="Lohnunternehmer aus dem Lipper Land — verlässlich, regional, fair."
        subtitle="Sie haben eine Fläche, die gemäht, gepflegt oder bewirtschaftet werden muss — aber niemanden, der das macht? Wir bringen Sie mit dem passenden Lohnunternehmer aus dem Kreis Lippe zusammen."
        primaryCta={{ href: "#anfrage", label: "Lohnunternehmer anfragen" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Was wir vermitteln</span>
            <hr className="divider mt-3" />
            <h2>Leistungen unserer Partnerbetriebe</h2>
            <ul>
              <li><strong>Mahd & Heuwerbung</strong> — Schlegelmäher, Kreiselmäher, Schwadenwerber, Pressen (Rund-, Quaderballen)</li>
              <li><strong>Mulchen & Pflege extensiver Flächen</strong> — auch Hangflächen mit Ferngesteuertem oder spezialisiertem Gerät</li>
              <li><strong>Heckenpflege & Knickrückschnitt</strong> — fachgerecht, im naturschutzkonformen Zeitfenster</li>
              <li><strong>Aussaat, Düngung, Pflanzenschutz</strong> — wenn die Fläche aktiv bewirtschaftet wird</li>
              <li><strong>Bodenbearbeitung & Drainage</strong> — Pflügen, Grubbern, Mulchsaat, Drainagepflege</li>
              <li><strong>Forstarbeiten</strong> — Holzernte, Rückeunternehmen, Brennholzaufarbeitung, Pflanzungen, Verbissschutz</li>
              <li><strong>Naturschutzpflege</strong> — Umsetzung von VNS-Auflagen, Renaturierung, Streuobstpflege, Biotopbaum-Markierung</li>
              <li><strong>Wegebau und Erschließung</strong> — Wirtschaftswege, kleinere Erdarbeiten</li>
            </ul>

            <h2>Wie funktioniert die Vermittlung?</h2>
            <ol className="list-decimal pl-5 mt-4 space-y-2 text-[color:var(--color-ink-soft)]">
              <li>Sie schildern uns kurz, was auf Ihrer Fläche zu tun ist (Größe, Lage, Termin).</li>
              <li>Wir schlagen Ihnen 1–2 passende Betriebe aus unserem Netzwerk vor.</li>
              <li>Sie bekommen ein konkretes Angebot — direkt vom Betrieb, ohne Aufschlag.</li>
              <li>Sie entscheiden, ob und mit wem Sie arbeiten möchten.</li>
            </ol>

            <h2>Warum über uns und nicht direkt?</h2>
            <p>
              Sie können natürlich direkt einen Betrieb anrufen. Aber wer ruft schon gerne fünfmal an, um ein Angebot für eine 2-Hektar-Wiese in Schwalenberg zu bekommen? Wir kennen die Betriebe, wissen wer auch kleine Aufträge nimmt, wer fairen Stundensatz nimmt und wer in welcher Saison überhaupt Kapazität hat. Und für Sie kostet diese Vermittlung nichts.
            </p>

            <h2>Kombination mit Verkauf, Pacht oder Förderung</h2>
            <p>
              Lohnunternehmer-Vermittlung ist häufig Teil eines größeren Pakets: Wir verpachten Ihre Fläche an einen unserer Partner, kümmern uns parallel um den VNS-Antrag und vermitteln den Lohnunternehmer für die naturschutzkonforme Mahd. So haben Sie für alles, was rund um Ihre Fläche anfällt, einen einzigen Ansprechpartner.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="lohnunternehmer"
              defaultIntent="Lohnunternehmer"
              title="Lohnunternehmer anfragen"
              subtitle="Beschreiben Sie kurz, was zu tun ist — wir machen den passenden Vorschlag."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
