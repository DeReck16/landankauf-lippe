import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Windkraft verpachten — Vorranggebiete Kreis Lippe",
  description:
    "Liegt Ihre Fläche in einem Windenergiegebiet? Standortpachten erreichen fünf- bis sechsstellige Beträge pro Jahr, auch per Poolmodell. Kostenloser Flächen-Check.",
  alternates: { canonical: "/windkraft-verpachten" },
  openGraph: {
    title: "Windkraftfläche verpachten — Kreis Lippe & Umland",
    description:
      "Standortpachten moderner Windenergieanlagen erreichen fünf- bis sechsstellige Beträge pro Jahr — auch Nachbarflächen verdienen über Poolmodelle mit.",
  },
};

const faq = [
  {
    q: "Wie viel Pacht zahlt eine Windenergieanlage?",
    a: "Für die Standortfläche einer modernen Anlage werden je nach Windhöffigkeit und Anlagengröße regelmäßig fünf- bis sechsstellige Jahrespachten gezahlt, häufig als Kombination aus Festbetrag und Umsatzbeteiligung. Der Wettbewerb der Projektentwickler um gute Standorte hat die Konditionen in den letzten Jahren deutlich steigen lassen — deshalb lohnt es sich, mehrere Angebote einzuholen statt das erste zu unterschreiben.",
  },
  {
    q: "Meine Fläche ist klein — lohnt sich das überhaupt?",
    a: "Oft ja, dank Poolmodellen: Dabei werden alle Flurstücke eines Windfelds zusammengefasst, und jeder Eigentümer erhält einen jährlichen Anteil — auch wenn das eigene Flurstück nur überstrichen wird, als Abstandsfläche dient oder die Zuwegung trägt. Sie brauchen also kein Windrad auf dem eigenen Grundstück, um mitzuverdienen.",
  },
  {
    q: "Woher weiß ich, ob meine Fläche in einem Windenergiegebiet liegt?",
    a: "Die Windenergiegebiete legt der Regionalplan fest — für den Kreis Lippe der Regionalplan Ostwestfalen-Lippe, dessen Windenergie-Teilplan seit April 2025 in Kraft ist und rund 14.000 Hektar ausweist. Die Kulisse steht damit fest und ist knapp — umso wertvoller ist ein Flurstück, das darin liegt. Genau das prüfen wir im kostenlosen Flächen-Check für Ihr konkretes Flurstück.",
  },
  {
    q: "Geht Windkraft auch im Wald?",
    a: "Ja — in NRW vor allem auf Kalamitätsflächen: Wo Borkenkäfer oder Sturm den Bestand genommen haben, sind Windenergieanlagen planungsrechtlich möglich. Für Waldbesitzer mit Schadflächen kann das die mit Abstand ertragreichste Nachnutzung sein, während der übrige Wald normal weiterwächst. Als Forst-Spezialisten prüfen wir das besonders gern.",
  },
  {
    q: "Wie lange läuft ein Wind-Pachtvertrag und was passiert danach?",
    a: "Üblich sind 20 bis 30 Jahre, oft mit Verlängerungsoption. Der Betreiber ist zum vollständigen Rückbau verpflichtet und muss dafür bereits bei der Genehmigung eine Sicherheitsleistung stellen. Die Fläche bleibt durchgehend Ihr Eigentum.",
  },
  {
    q: "Was kostet mich die Prüfung?",
    a: "Nichts. Flächen-Check, Einschätzung und — bei Eignung — die Herstellung des Kontakts zu Projektentwicklern sind für Eigentümer kostenlos und unverbindlich. Wir sagen Ihnen auch ehrlich, wenn Ihre Fläche nicht in Frage kommt.",
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
        eyebrow="Energiepacht · Windenergie"
        title="Windkraftfläche verpachten — wenn der Standort stimmt, stimmt der Ertrag."
        subtitle="Standortpachten moderner Windenergieanlagen erreichen fünf- bis sechsstellige Beträge pro Jahr — und über Poolmodelle verdienen auch Nachbarflächen mit. Wir prüfen kostenlos, ob Ihr Flurstück in der Windkulisse liegt."
        primaryCta={{ href: "#anfrage", label: "Kostenloser Flächen-Check" }}
        secondaryCta={{ href: "/solarpark-verpachten", label: "Auch Solar prüfen" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Warum jetzt</span>
            <hr className="divider mt-3" />
            <h2>Die Windkulisse in OWL steht fest — und sie ist knapp</h2>
            <p>
              Nordrhein-Westfalen muss bis Ende 2032 rund <strong>1,8 Prozent der Landesfläche</strong> für Windenergie ausweisen — für Ostwestfalen-Lippe ist das bereits umgesetzt: Der Windenergie-Teilplan des <strong>Regionalplans OWL</strong> ist seit April 2025 in Kraft und weist rund <strong>14.000 Hektar</strong> Windenergiegebiete aus. Die Kulisse steht damit fest — und Projektentwickler sichern sich die Flurstücke darin teils Jahre vor dem ersten Spatenstich per Options- und Pachtvertrag.
            </p>
            <p>
              Wer ein Flurstück in oder nahe einer ausgewiesenen Windfläche besitzt, sitzt auf einem knappen Gut. Entsprechend haben sich die Pachtkonditionen entwickelt: Für Standortflächen moderner Anlagen werden regelmäßig <strong>fünf- bis sechsstellige Jahrespachten</strong> gezahlt, meist als Festbetrag plus Umsatzbeteiligung am Stromertrag.
            </p>

            <h2>Auch ohne eigenes Windrad mitverdienen: Poolmodelle</h2>
            <p>
              Ein Windfeld braucht mehr als den Mastfuß: Abstandsflächen, überstrichene Flächen (der Rotor ragt über Grundstücksgrenzen), Zuwegungen und Kabeltrassen. Moderne Projekte arbeiten deshalb mit <strong>Flächenpools</strong>: Alle beteiligten Flurstücke werden zusammengefasst, und jeder Eigentümer erhält einen jährlichen Anteil an der Gesamtpacht — auch die, auf denen keine Anlage steht.
            </p>
            <p>
              Das heißt konkret: Auch ein 0,5-Hektar-Streifen kann über Jahrzehnte jährliche Zahlungen bringen, wenn er im richtigen Gebiet liegt. Genau deshalb lohnt der Flächen-Check auch für kleine Flurstücke.
            </p>

            <h2>Windkraft auf Kalamitätsflächen im Wald</h2>
            <p>
              Für viele Lipper Waldbesitzer die spannendste Entwicklung: Auf <strong>Schadflächen</strong> — wo Borkenkäfer und Stürme den Fichtenbestand genommen haben — sind Windenergieanlagen in NRW planungsrechtlich möglich. Statt Jahrzehnte auf den nächsten Erntezeitpunkt einer Wiederaufforstung zu warten, kann eine Kalamitätsfläche als Windstandort ein Vielfaches des forstlichen Ertrags liefern, während der übrige Bestand normal weiterwächst. Als <Link href="/wald-verkaufen">Forst-Spezialisten</Link> prüfen wir diese Konstellation besonders genau.
            </p>

            <h2>So läuft es ab</h2>
            <ul>
              <li><strong>1. Flächen-Check (kostenlos):</strong> Sie nennen uns Gemarkung und Flurstück — wir prüfen die Lage zur Windkulisse des Regionalplans, Zuwegung und Umfeld.</li>
              <li><strong>2. Einschätzung:</strong> Sie bekommen eine ehrliche Einordnung: Vorranggebiet, Randlage mit Pool-Chance oder aktuell keine Perspektive.</li>
              <li><strong>3. Vermarktung:</strong> Bei Eignung stellen wir den Kontakt zu Projektentwicklern her — mit dem Ziel mehrerer konkurrierender Angebote.</li>
              <li><strong>4. Vertragsphase:</strong> Wir begleiten die Einordnung von Optionszahlung, Pachtstruktur, Poolverteilung und Rückbausicherheit; die finale Vertragsprüfung übernimmt Ihr Rechtsanwalt oder Notar.</li>
            </ul>
            <p>
              Für Sie als Eigentümer ist das komplette Verfahren <strong>kostenlos</strong>.
            </p>

            <h2>Worauf Sie beim Vertrag achten sollten</h2>
            <ul>
              <li><strong>Optionsphase klar geregelt:</strong> Windprojekte haben lange Planungs- und Genehmigungszeiten — die Optionszahlung sollte das angemessen vergüten</li>
              <li><strong>Pachtstruktur:</strong> Festbetrag plus Umsatzbeteiligung ist üblich — reine Festpacht kann bei guten Standorten Geld verschenken</li>
              <li><strong>Poolverteilung transparent:</strong> Wie werden Standort-, Abstands- und Wegeflächen gewichtet?</li>
              <li><strong>Rückbau:</strong> vollständige Rückbauverpflichtung mit Sicherheitsleistung</li>
              <li><strong>Wertsicherung</strong> der Zahlungen über die Laufzeit</li>
            </ul>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="windkraft-verpachten"
              defaultIntent="Energiepacht (Solar/Wind)"
              title="Kostenloser Wind-Flächen-Check"
              subtitle="Gemarkung und Flurstück genügen — wir prüfen die Lage zur Windkulisse und melden uns innerhalb von 24 Stunden mit einer ehrlichen Einschätzung."
            />
          </aside>
        </div>
      </section>

      <section className="section bg-grain">
        <div className="container-page">
          <span className="eyebrow">Häufige Fragen</span>
          <hr className="divider mt-3" />
          <h2 className="text-3xl md:text-4xl">Windkraft-Pacht: die häufigsten Fragen</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {faq.map((item) => (
              <div key={item.q} className="card">
                <h3 className="font-serif text-xl mb-2">{item.q}</h3>
                <p className="text-sm text-[color:var(--color-ink-soft)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
