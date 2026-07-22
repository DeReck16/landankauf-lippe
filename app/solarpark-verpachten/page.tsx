import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Solarpark verpachten — Pacht 2.500–4.500 €/ha",
  description:
    "Acker oder Grünland für Photovoltaik verpachten? Solarpark-Pacht 2.500–4.500 €/ha/Jahr. Kostenloser Flächen-Check im Kreis Lippe: Eignung, Netznähe, Potenzial.",
  alternates: { canonical: "/solarpark-verpachten" },
  openGraph: {
    title: "Fläche für Solarpark verpachten — Kreis Lippe & Umland",
    description:
      "Solarpark-Pachten liegen bei 2.500–4.500 €/ha/Jahr — ein Vielfaches der Ackerpacht. Kostenloser Flächen-Check: Eignung, Netznähe, Pachtpotenzial.",
  },
};

const faq = [
  {
    q: "Wie viel Pacht zahlt ein Solarpark pro Hektar?",
    a: "Aktuell werden für Freiflächen-Photovoltaik in der Regel 2.500 bis 4.500 € je Hektar und Jahr gezahlt, an sehr guten Standorten (Netznähe, große zusammenhängende Fläche, privilegierte Kulisse) auch um 5.000 €. Zum Vergleich: Die durchschnittliche Ackerpacht in NRW liegt bei rund 659 €/ha — Solar-Pacht ist also ein Vielfaches davon.",
  },
  {
    q: "Welche Flächen eignen sich für einen Solarpark?",
    a: "Gefragt sind zusammenhängende Flächen ab etwa 5 Hektar (besser 10 und mehr), möglichst eben oder nach Süden geneigt, ohne Schutzgebietsstatus und mit erreichbarem Netzanschluss. Flächen im 500-Meter-Streifen entlang von Autobahnen und Schienenwegen sind EEG-seitig privilegiert und besonders gefragt. Auch ertragsschwache Böden sind geeignet — für die Pachthöhe zählt der Standort, nicht die Bodenpunkte.",
  },
  {
    q: "Wie lange läuft ein Solar-Pachtvertrag?",
    a: "Üblich sind 20 bis 40 Jahre, oft als Grundlaufzeit mit Verlängerungsoptionen. Wichtig: In der Planungs- und Genehmigungsphase wird meist nur eine reduzierte Optionszahlung fällig — die volle Pacht fließt ab Baubeginn bzw. Inbetriebnahme. Auf saubere Regelungen zu Laufzeit, Indexierung und Rückbau achten wir bei der Einordnung mit.",
  },
  {
    q: "Was passiert am Ende der Laufzeit mit meiner Fläche?",
    a: "Seriöse Verträge enthalten eine Rückbauverpflichtung mit Sicherheitsleistung (z. B. Bürgschaft): Der Betreiber muss die Anlage vollständig entfernen und die Fläche zurückgeben. Die Fläche bleibt während der gesamten Laufzeit Ihr Eigentum und kann danach wieder landwirtschaftlich genutzt werden.",
  },
  {
    q: "Kann ich statt zu verpachten auch verkaufen?",
    a: "Ja. Manche Eigentümer verkaufen die Fläche lieber — bei nachgewiesener Solar-Eignung teils mit deutlichem Aufschlag auf den landwirtschaftlichen Bodenwert. Wir zeigen Ihnen beide Rechnungen: langfristige Pacht gegen Einmalerlös. Zum Verkauf beraten wir Sie unter Fläche verkaufen.",
  },
  {
    q: "Was kostet der Solar-Flächen-Check?",
    a: "Nichts. Wir prüfen Flurstück, Größe, Kulisse und Netznähe kostenlos und unverbindlich und sagen Ihnen ehrlich, ob sich eine Vermarktung lohnt — auch dann, wenn die Antwort Nein lautet. Für Eigentümer entstehen in keinem Schritt Kosten.",
  },
  {
    q: "Was ist Agri-Photovoltaik?",
    a: "Bei Agri-PV wird die Fläche doppelt genutzt: Module stehen hoch aufgeständert oder senkrecht in Reihen, dazwischen läuft die Bewirtschaftung weiter. Das kann interessant sein, wenn Sie die landwirtschaftliche Nutzung nicht aufgeben wollen. Die Pacht liegt meist unter der klassischer Freiflächenanlagen, dafür bleibt der Ertrag aus der Bewirtschaftung erhalten.",
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
        eyebrow="Energiepacht · Photovoltaik"
        title="Fläche für einen Solarpark verpachten — das Vielfache der Ackerpacht."
        subtitle="Freiflächen-Photovoltaik zahlt aktuell 2.500 bis 4.500 € je Hektar und Jahr — über Jahrzehnte, wertgesichert, ohne eigenen Aufwand. Wir prüfen kostenlos, ob Ihre Fläche im Kreis Lippe oder Umland dafür in Frage kommt."
        primaryCta={{ href: "#anfrage", label: "Kostenloser Flächen-Check" }}
        secondaryCta={{ href: "/windkraft-verpachten", label: "Auch Wind prüfen" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Die Rechnung</span>
            <hr className="divider mt-3" />
            <h2>Was Solar-Pacht wirklich bringt</h2>
            <p>
              Während die klassische Ackerpacht in NRW im Schnitt bei rund <strong>659 € je Hektar und Jahr</strong> liegt (<Link href="/ratgeber/pachtpreise-ackerland-nrw">alle Zahlen hier</Link>), zahlen Projektentwickler für geeignete Solarflächen aktuell in der Regel <strong>2.500 bis 4.500 € je Hektar und Jahr</strong> — an sehr guten Standorten auch um 5.000 €. Das ist das Vier- bis Siebenfache, vertraglich gesichert über 20 bis 40 Jahre, meist mit Wertsicherungsklausel.
            </p>
            <table className="w-full mt-3 border-collapse text-sm">
              <thead>
                <tr className="bg-[color:var(--color-brand-soft)] text-left">
                  <th className="p-3 border border-[color:var(--color-line)]">Nutzung</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">Pacht €/ha/Jahr</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Ackerpacht NRW (Ø Bestand)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">ca. 659 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Grünlandpacht Kreis Lippe</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">180 – 380 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Freiflächen-Photovoltaik</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right"><strong>2.500 – 4.500 €</strong></td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Top-Standorte (Netznähe, privilegierte Kulisse)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">bis ca. 5.000 €</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-[color:var(--color-muted)]">
              Marktübliche Bandbreiten Stand 2026; der erzielbare Wert hängt von Standort, Netznähe und Flächenzuschnitt ab.
            </p>

            <h2>Welche Flächen gesucht werden</h2>
            <ul>
              <li><strong>Größe:</strong> zusammenhängend ab ca. 5 ha — je größer, desto besser die Konditionen</li>
              <li><strong>Netznähe:</strong> Umspannwerk oder Mittelspannung in erreichbarer Entfernung</li>
              <li><strong>Kulisse:</strong> Streifen entlang von Autobahnen und Schienenwegen sind besonders gefragt — bis 200 m baurechtlich privilegiert (§ 35 BauGB), bis 500 m EEG-vergütungsfähig</li>
              <li><strong>Topografie:</strong> eben oder leicht nach Süden geneigt, keine Schutzgebiete</li>
              <li><strong>Boden:</strong> gerade ertragsschwache Standorte sind geeignet — die Bodenpunkte spielen für die Solar-Pacht kaum eine Rolle</li>
            </ul>
            <p>
              Ob am Ende gebaut werden darf, entscheidet in der Regel die Kommune über die Bauleitplanung — nur im 200-Meter-Streifen entlang von Autobahnen und mehrgleisigen Schienenwegen sind Solarparks seit 2023 baurechtlich privilegiert und auch ohne Bebauungsplan genehmigungsfähig (§ 35 BauGB). Die EEG-Kulisse bestimmt zusätzlich die Vergütungsseite. Genau deshalb beginnt alles mit einem ehrlichen Flächen-Check: Wir prüfen Flurstück, Zuschnitt, Kulisse und Netznähe, bevor irgendjemand Zeit investiert.
            </p>

            <h2>So läuft es ab</h2>
            <ul>
              <li><strong>1. Flächen-Check (kostenlos):</strong> Sie nennen uns Gemarkung und Flurstück — wir prüfen Größe, Lage, Kulisse und Netznähe und geben Ihnen eine ehrliche Einschätzung samt Pachtspanne.</li>
              <li><strong>2. Vermarktung:</strong> Ist die Fläche geeignet, stellen wir den Kontakt zu Projektentwicklern her und sorgen dafür, dass mehrere Angebote entstehen — nicht das erstbeste.</li>
              <li><strong>3. Vertragsphase:</strong> Wir begleiten die Einordnung der Konditionen: Laufzeit, Optionszahlung während der Planung, Indexierung, Rückbausicherheit. Die finale Vertragsprüfung gehört in die Hände Ihres Rechtsanwalts oder Notars.</li>
              <li><strong>4. Laufende Pacht:</strong> Ab Baubeginn bzw. Inbetriebnahme fließt die volle Pacht — über die gesamte Laufzeit, während die Fläche Ihr Eigentum bleibt.</li>
            </ul>
            <p>
              Für Sie als Eigentümer ist das komplette Verfahren <strong>kostenlos</strong> — vom Check bis zum Vertragsabschluss.
            </p>

            <h2>Worauf Sie beim Vertrag achten sollten</h2>
            <ul>
              <li>Reduzierte <strong>Optionszahlung</strong> in der Planungsphase klar geregelt (Planungs- und Genehmigungsphasen können mehrere Jahre dauern)</li>
              <li><strong>Rückbauverpflichtung mit Sicherheitsleistung</strong> (Bürgschaft) — die Fläche muss am Ende geräumt zurückkommen</li>
              <li><strong>Wertsicherung / Indexierung</strong> der Pacht über die Laufzeit</li>
              <li>Regelungen für <strong>Wegerechte, Kabeltrassen und Nebenflächen</strong> — auch die werden vergütet</li>
              <li>Bei verpachteten Flächen: laufende <strong>Landpachtverträge</strong> und Kündigungsfristen frühzeitig mitdenken</li>
            </ul>

            <h2>Agri-PV: Bewirtschaftung und Pacht kombinieren</h2>
            <p>
              Wer die landwirtschaftliche Nutzung nicht aufgeben will, kann über <strong>Agri-Photovoltaik</strong> nachdenken: hoch aufgeständerte oder senkrecht stehende Module, zwischen denen weiter gewirtschaftet wird. Die Pacht liegt unter der klassischer Freiflächenanlagen, dafür bleibt der Bewirtschaftungsertrag erhalten. Ob das für Ihre Fläche sinnvoll ist, gehört mit in den Flächen-Check.
            </p>

            <h2>Verpachten oder verkaufen?</h2>
            <p>
              Nicht für jeden ist die 30-Jahres-Pacht die richtige Antwort. Flächen mit nachgewiesener Solar-Eignung erzielen beim <Link href="/flaeche-verkaufen">Verkauf</Link> teils deutliche Aufschläge auf den landwirtschaftlichen Bodenwert. Wir legen Ihnen beide Rechnungen nebeneinander — Pacht über die Laufzeit gegen Einmalerlös heute — und Sie entscheiden.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="solarpark-verpachten"
              defaultIntent="Energiepacht (Solar/Wind)"
              title="Kostenloser Solar-Flächen-Check"
              subtitle="Gemarkung und Flurstück genügen — wir prüfen Eignung, Kulisse und Netznähe und melden uns innerhalb von 24 Stunden mit einer ehrlichen Einschätzung."
            />
          </aside>
        </div>
      </section>

      <section className="section bg-grain">
        <div className="container-page">
          <span className="eyebrow">Häufige Fragen</span>
          <hr className="divider mt-3" />
          <h2 className="text-3xl md:text-4xl">Solarpark-Pacht: die häufigsten Fragen</h2>
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
