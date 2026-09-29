import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import OekopunkteRolle from "@/components/OekopunkteRolle";
import { seitenMetadaten } from "@/lib/seo";

// Gegenstück zu /services/vns-oekopunkte (dort Eigentümer): Wer Ökopunkte oder Kompensationsflächen SUCHT.
// Anlass 29.09.2026: Anfrage „Ökopunkte aus Erstaufforstung im Naturraum D34“ (LandVest) — die Seite „Ökopunkte verkaufen“
// beantwortete die Frage „nur beratend oder eigenes Ökokonto?“ nicht. Fachliche Quellen: Ökokonto-Verordnung NRW,
// LANUK-Arbeitsblatt 61 (Stand März 2026), LFoG NRW § 41, BfN-Naturräume; Rolle von Lippe Forst: lib/oekopunkte.ts.

export const metadata: Metadata = seitenMetadaten({
  title: "Ökopunkte kaufen NRW: Kompensationsflächen",
  description:
    "Ökopunkte oder Kompensationsflächen in NRW suchen? Ökokonto, Erstaufforstung, Naturraum — und was Lippe Forst im Kreis Lippe dafür tun kann und was nicht.",
  pfad: "/oekopunkte-kaufen",
  ogTitle: "Ökopunkte und Kompensationsflächen im Kreis Lippe suchen — was Lippe Forst tun kann",
});

const faq = [
  {
    q: "Haben Sie Ökopunkte zu verkaufen?",
    a: "Nein. Lippe Forst betreibt kein eigenes Ökokonto und hat keine eigenen, bereits anerkannten Ökopunkte. Wir können bei Eigentümern im Kreis Lippe anfragen, ob sie Flächen für Aufwertungsmaßnahmen einbringen würden, und Kontakte herstellen, sobald beide Seiten zugestimmt haben. Zusagen zu Menge, Preis oder Zeitpunkt können wir nicht geben.",
  },
  {
    q: "Liegt der Kreis Lippe im Naturraum D34?",
    a: "Überwiegend nicht. Naturraum D34 ist die Westfälische Tieflandsbucht (u. a. Münsterland und Hellwegbörden). Der Kreis Lippe liegt überwiegend im Weserbergland — Naturraum D36, in NRW der Kompensationsraum K03; Horn-Bad Meinberg gehört dazu. Für Vorhaben in D34 sind Flächen aus dem Kreis Lippe in der Regel nicht verwendbar. Gemeinden am westlichen Rand des Kreises können abweichen; die Zuordnung entscheidet im Einzelfall die zuständige Behörde.",
  },
  {
    q: "Wie funktioniert der Kauf von Ökopunkten in NRW?",
    a: "Entweder Sie erwerben Punkte aus einem bestehenden Ökokonto, die bereits anerkannt und eingebucht sind. Oder Sie finanzieren eine noch nicht umgesetzte Maßnahme vor: Sie wird vor Beginn bei der Unteren Naturschutzbehörde beantragt, die Fläche dinglich gesichert, die Maßnahme umgesetzt und abgenommen, erst dann werden die Punkte eingebucht. Die Refinanzierung erfolgt außerhalb des Ökokontos direkt zwischen Kontoinhaber und Eingriffsverursacher (§ 6 Abs. 5 Ökokonto-Verordnung NRW).",
  },
  {
    q: "Was kostet Ihre Vermittlung?",
    a: "Für Ihre Anfrage und unsere Suche fallen keine Kosten an. Ob und zu welchen Konditionen wir bei einem konkreten Treffer vermitteln, vereinbaren wir vorab schriftlich, bevor Kontaktdaten weitergegeben werden.",
  },
  {
    q: "Wie schnell erhalte ich eine Rückmeldung?",
    a: "In der Regel innerhalb eines Werktags per E-Mail. Wir sagen Ihnen ehrlich, ob wir helfen können — auch dann, wenn die Antwort Nein lautet.",
  },
  {
    q: "Wer ist Lippe Forst?",
    a: "Lippe Forst ist eine Marke der TR Vertriebs GmbH in Horn-Bad Meinberg. Wir kaufen und vermitteln Ackerland, Wiesen und Wald im Kreis Lippe und beraten Eigentümer zu Vertragsnaturschutz und Aufwertungsmaßnahmen.",
  },
];

export default function Page() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <PageHero
        eyebrow="Für Projektentwickler, Planer und Kommunen"
        title="Ökopunkte und Kompensationsflächen im Kreis Lippe suchen."
        subtitle="Wir haben keine fertigen Ökopunkte — aber Kontakte zu Eigentümern im Kreis Lippe, die Flächen für Aufwertungsmaßnahmen prüfen. Schildern Sie kurz, was Sie suchen; wir sagen Ihnen ehrlich, ob wir helfen können."
        primaryCta={{ href: "#anfrage", label: "Bedarf schildern" }}
        secondaryCta={{ href: "/services/vns-oekopunkte", label: "Für Eigentümer: Ökopunkte verkaufen" }}
      />

      <div className="container-page px-5 pt-10 md:pt-14">
        <OekopunkteRolle titel="Was Sie von uns erwarten können — und was nicht" />
      </div>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe min-w-0">
            <span className="eyebrow">Ökopunkte erwerben</span>
            <hr className="divider mt-3" />
            <h2>So kommen Sie in NRW an Ökopunkte</h2>
            <p>
              Es gibt zwei Wege. <strong>Erstens:</strong> Sie kaufen Punkte aus einem bestehenden Ökokonto — bereits anerkannt, bewertet und eingebucht. <strong>Zweitens:</strong> Sie finanzieren eine noch nicht umgesetzte Maßnahme vor. Dann wird die Maßnahme <strong>vor Beginn</strong> bei der Unteren Naturschutzbehörde beantragt, die Fläche dinglich gesichert (üblicherweise durch eine beschränkte persönliche Dienstbarkeit), die Maßnahme umgesetzt und abgenommen; erst danach werden die Punkte eingebucht.
            </p>
            <p>
              Die Refinanzierung erfolgt außerhalb des Ökokontos direkt zwischen Kontoinhaber und Eingriffsverursacher (§ 6 Abs. 5 <Link href="https://recht.nrw.de/lrgv/rechtsverordnung/16052008-verordnung-ueber-die-fuehrung-eines-oekokontos-nach-ss-32-des/" target="_blank" rel="noopener">Ökokonto-Verordnung NRW</Link>). Die Untere Naturschutzbehörde bestätigt der Zulassungsbehörde Eignung und Durchführung. Bewertet wird nach dem <Link href="https://www.lanuk.nrw.de/fileadmin/lanuvpubl/4_arbeitsblaetter/Arbeitsblatt_61.pdf" target="_blank" rel="noopener">Arbeitsblatt 61 des Landesamts für Natur, Umwelt und Klima NRW</Link> (Stand März 2026): 0 bis 10 Wertpunkte je Quadratmeter, Prognosehorizont 30 Jahre.
            </p>

            <h2>Naturraum und Kompensationsraum: D34, D36, K01, K03</h2>
            <p>
              Kompensation muss in der Regel im betroffenen Naturraum erfolgen (§ 15 Abs. 2 Bundesnaturschutzgesetz, § 7 Ökokonto-Verordnung). Die „D-Codes“ sind die Naturräumlichen Haupteinheitengruppen des Bundesamts für Naturschutz; das NRW-Ökokonto arbeitet mit Kompensationsräumen.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mt-3 border-collapse text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-brand-soft)] text-left">
                    <th className="p-3 border border-[color:var(--color-line)]">Naturraum (BfN)</th>
                    <th className="p-3 border border-[color:var(--color-line)]">Kompensationsraum NRW</th>
                    <th className="p-3 border border-[color:var(--color-line)]">Beispiele</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]"><strong>D34</strong> Westfälische Tieflandsbucht</td>
                    <td className="p-3 border border-[color:var(--color-line)]">K01 Münsterländer und Westfälisches Tiefland</td>
                    <td className="p-3 border border-[color:var(--color-line)]">Münsterland, Hellwegbörden, Ostmünsterland</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]"><strong>D36</strong> Unteres Weserbergland und Oberes Weser-Leinebergland</td>
                    <td className="p-3 border border-[color:var(--color-line)]">K03 Weser- und Weser-Leine-Bergland</td>
                    <td className="p-3 border border-[color:var(--color-line)]">größter Teil des Kreises Lippe, Lipper Bergland, Teutoburger Wald, Egge</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]"><strong>D38</strong> Bergisches Land, Sauerland</td>
                    <td className="p-3 border border-[color:var(--color-line)]">K04 Bergisches Land und Sauerland</td>
                    <td className="p-3 border border-[color:var(--color-line)]">Sauerland, Bergisches Land</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[color:var(--color-muted)]">
              Vereinfachte Zuordnung. Maßgeblich sind die Karte in Anlage 2 der Ökokonto-Verordnung und die Entscheidung der zuständigen Behörde; Gemeinden an den Rändern können abweichen.
            </p>

            <h2>Was Lippe Forst im Kreis Lippe tun kann</h2>
            <p>
              Der Kreis Lippe liegt überwiegend im Weserbergland (D36 / K03). Für Vorhaben in der Westfälischen Bucht (D34 / K01) sind Flächen aus dem Kreis Lippe deshalb in der Regel nicht verwendbar.
            </p>
            <p>
              Für Vorhaben im Weserbergland können wir bei Eigentümern anfragen, ob sie Flächen für Aufwertungsmaßnahmen einbringen würden. Das sind keine Zusagen, sondern Gespräche. Wir melden uns, sobald wir passende Eigentümer kennen — Kontaktdaten geben wir nur weiter, wenn beide Seiten zugestimmt haben. Ein eigenes Ökokonto betreiben wir nicht, und Preise oder Mengen können wir nicht zusagen.
            </p>

            <h2>Erstaufforstung: Was Käufer wissen sollten</h2>
            <ul>
              <li><strong>Genehmigung:</strong> Die Neuanlage von Wald ist nur mit Genehmigung der Forstbehörde zulässig (§ 41 Landesforstgesetz NRW); für den Kreis Lippe ist das Regionalforstamt Ostwestfalen-Lippe zuständig.</li>
              <li><strong>Ökokonto-Antrag vor Beginn:</strong> Bereits Umgesetztes wird nicht nachträglich anerkannt. Die Punkte stehen erst nach Abnahme der Maßnahme zur Verfügung.</li>
              <li><strong>Punktzahl:</strong> Junger Wald wird als „Jungwuchs bis Stangenholz“ mit 3 bis 6 Punkten je Quadratmeter bewertet (6 bei überwiegend lebensraumtypischen Baumarten; auf isolierten Flächen ein Punkt weniger). Von intensivem Acker (2 Punkte) aus sind das grob 30.000 bis 40.000 Punkte je Hektar.</li>
              <li><strong>Flächenkonflikte:</strong> Wertvolles Offenland wie artenreiche Wiesentäler gilt nicht als geeignet; in Gebieten mit mehr als 40 % Waldanteil hat der Waldumbau Vorrang. Im waldreichen Teutoburger Wald und in der Egge ist eine Erstaufforstung deshalb schwer durchzusetzen.</li>
              <li><strong>Dauerhaft:</strong> Was einmal Wald ist, bleibt rechtlich Wald; eine spätere Umwandlung braucht eine eigene Genehmigung.</li>
            </ul>
            <p>
              Ausführlicher, auch aus Sicht der Eigentümer: <Link href="/services/vns-oekopunkte">Ökopunkte, Ökokonto und Vertragsnaturschutz</Link>.
            </p>

            <h2>Was wir für eine Einschätzung brauchen</h2>
            <ul>
              <li><strong>Suchraum:</strong> Naturraum (D-Code) bzw. Kompensationsraum, Kreise oder Gemeinden</li>
              <li><strong>Umfang:</strong> gesuchte Ökopunkte oder Fläche in Hektar</li>
              <li><strong>Maßnahme:</strong> zum Beispiel Erstaufforstung, Grünlandextensivierung, Streuobst, Gewässer</li>
              <li><strong>Preisvorstellung und Form:</strong> bereits anerkannte Punkte aus einem Ökokonto oder Vorfinanzierung einer Maßnahme, Flächenkauf oder Pacht</li>
              <li><strong>Zeitrahmen:</strong> bis wann die Punkte gebraucht werden</li>
              <li><strong>Anerkennung:</strong> zuständige Untere Naturschutzbehörde und gewünschtes Bewertungsverfahren</li>
            </ul>

            <h2>Häufige Fragen</h2>
            <dl>
              {faq.map((item) => (
                <div key={item.q} className="mb-6">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-1">{item.a}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-[color:var(--color-muted)]">
              Stand: 29.09.2026. Diese Seite ersetzt keine Rechts-, Steuer- oder Fachberatung; Anerkennung, Punktzahl und Zuordnung zum Naturraum entscheiden die zuständigen Behörden.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="oekopunkte-kaufen"
              defaultIntent="Ökopunkte gesucht"
              defaultFlaechentyp="Sonstiges"
              title="Bedarf schildern"
              subtitle="Suchraum, Umfang und Maßnahme genügen — wir melden uns in der Regel innerhalb eines Werktags per E-Mail und sagen ehrlich, ob wir helfen können."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
