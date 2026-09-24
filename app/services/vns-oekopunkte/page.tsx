import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { seitenMetadaten } from "@/lib/seo";

export const metadata: Metadata = seitenMetadaten({
  title: "Ökopunkte verkaufen NRW & Vertragsnaturschutz",
  description:
    "Ökopunkte in NRW verkaufen? Wir prüfen Ihre Fläche kostenlos, stellen Ökokonto-Anträge und vermarkten Ausgleichspunkte im Kreis Lippe. VNS-Antrag bis 30.06.",
  pfad: "/services/vns-oekopunkte",
});

const faq = [
  {
    q: "Wie viel sind Ökopunkte in NRW wert?",
    a: "Je nach Maßnahme und Gebietskulisse zwischen ca. 0,80 und 3,50 € pro Ökopunkt. Ein Hektar Aufwertung (z. B. Acker zu Wiese) erzeugt häufig 50.000 bis 200.000 Punkte. Im Kreis Lippe und Umfeld liegt der erzielbare Verkaufspreis je nach Nachfragelage bei 1,20 bis 2,50 € pro Punkt — das entspricht einem Erlös von mehreren Zehntausend Euro pro Hektar bei Eigentumserhalt.",
  },
  {
    q: "Wann lohnt sich Vertragsnaturschutz NRW für mich?",
    a: "VNS lohnt sich vor allem für extensiv nutzbare Flächen: Steillagen, feuchte Grünlandparzellen, Streuobstwiesen, Bachauen und Flächen in FFH-Kulissen. Der Förderertrag liegt oft zwischen 345 und über 2.000 €/ha/Jahr — deutlich über dem erzielbaren Pachtpreis für schwer bewirtschaftbare Böden. Wir prüfen das kostenlos für Ihre konkrete Fläche.",
  },
  {
    q: "Ist Ökokonto und Ökopunkte dasselbe?",
    a: "Nicht ganz: Das Ökokonto ist das Instrument bei der UNB, in das Aufwertungsmaßnahmen eingebucht werden. Ökopunkte sind die darin gebuchte Einheit. Wer sein Ökokonto befüllt, kann die Punkte dann an Eingriffspflichtige (Bauträger, Infrastrukturprojekte, Kommunen) verkaufen.",
  },
  {
    q: "Kann ich Ökopunkte verkaufen, ohne Eigentümer zu sein?",
    a: "Grundsätzlich können auch Pächter Aufwertungsmaßnahmen im Ökokonto veranlassen, wenn der Eigentümer zustimmt. Die Punkte werden auf die Person oder Organisation gebucht, die die Maßnahme beauftragt. Wir klären das gemeinsam mit der UNB Kreis Lippe.",
  },
  {
    q: "Wie lange dauert ein VNS-Antrag im Kreis Lippe?",
    a: "Die Bearbeitung durch die UNB dauert in der Regel wenige Wochen. Die Verpflichtung startet immer zum 1. Januar des Folgejahres — deswegen ist die Antragsfrist 30.06. entscheidend. Für einen Start am 01.01.2028 ist das voraussichtlich der 30.06.2027. Wir bereiten alles vor, Sie müssen den Antrag nur final elektronisch über ELAN einreichen.",
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
        eyebrow="VNS · Ökokonto · Ausgleichsflächen"
        title="Vertragsnaturschutz und Ökopunkte — Förderung statt Stilllegung."
        subtitle="Schwierig zu bewirtschaftende Wiesen, FFH-Flächen, Hangbereiche und alte Streuobstwiesen sind oft kein Verlust — sondern eine echte Förder-Chance. Wir beraten Sie ganzheitlich und übernehmen den Behördenkram."
        primaryCta={{ href: "#anfrage", label: "Beratung anfragen" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Was wir abdecken</span>
            <hr className="divider mt-3" />
            <h2>Vertragsnaturschutz NRW (VNS)</h2>
            <p>
              Der Vertragsnaturschutz ist ein Förderprogramm des Landes NRW, mit dem extensive landwirtschaftliche Nutzung honoriert wird. Eigentümer und Bewirtschafter verpflichten sich in der Regel für fünf Jahre zu einer schonenden Bewirtschaftung — und erhalten dafür je nach Paket zwischen <strong>345 und über 2.000 €/ha/Jahr</strong>.
            </p>
            <p>
              Im Kreis Lippe spielt VNS vor allem in den Schutzgebietskulissen rund um die Egge, das Silberbachtal, das Externstein-Gebiet und in den Auen von Werre, Bega und Emmer eine Rolle. Wir wissen, welche Pakete in Ihrer Gemarkung zugelassen sind, und stimmen den Antrag mit der <Link href="https://www.biologischestationlippe.de" target="_blank" rel="noopener">Biologischen Station Lippe</Link> sowie der UNB Kreis Lippe ab.
            </p>

            <h3>Typische VNS-Pakete im Kreis Lippe</h3>
            <ul>
              <li>Extensive Mähwiesen mit später erster Mahd</li>
              <li>Streuobstwiesenpflege</li>
              <li>Acker → Grünland-Umwandlung mit langfristiger Sicherung</li>
              <li>Ackerextensivierung (Lerchenfenster, Stoppelbrache)</li>
              <li>Hecken- und Knickpflege</li>
            </ul>

            <h3>Antragsfrist: jeweils 30. Juni</h3>
            <p>
              Neue VNS-Verträge beginnen immer am 1. Januar. Der Grundantrag muss bis zum <strong>30. Juni des Vorjahres</strong> elektronisch über ELAN bei der UNB Kreis Lippe eingehen — für einen Start am 01.01.2028 also voraussichtlich bis 30.06.2027 (die Frist für 2027 ist am 30.06.2026 abgelaufen). Wer die Frist versäumt, verliert ein ganzes Jahr Förderung. Wenn Ihre Fläche dafür in Frage kommt, sprechen Sie uns rechtzeitig an.
            </p>

            <h2>Ökopunkte und Ökokonto</h2>
            <p>
              Über das Ökokonto können Sie auf Ihrer Fläche freiwillige Aufwertungsmaßnahmen durchführen (z. B. Hecke pflanzen, Acker zu Wiese umwandeln, Tümpel anlegen) und die dabei generierten <strong>Ökopunkte</strong> an Bauträger oder die öffentliche Hand verkaufen. Ein Hektar Aufwertung kann je nach Maßnahme einen vier- bis fünfstelligen einmaligen Erlös bringen — bei Eigentumserhalt.
            </p>
            <p>
              Wir prüfen, ob Ihre Fläche grundsätzlich geeignet ist, koordinieren mit der UNB die Maßnahmenplanung, organisieren die Umsetzung über regionale Lohnunternehmer und kümmern uns um die Vermarktung der Punkte.
            </p>

            <h2>Biotopbaumförderung NRW (Privatwald)</h2>
            <p>
              Sie haben Wald mit dicken Eichen, Buchen oder anderen Laubbäumen ab 40 cm Brusthöhendurchmesser? Über die <strong>Förderrichtlinie Privat- und Körperschaftswald NRW (FöRL)</strong> können Sie Bäume gegen einmalige Festbeträge dauerhaft als Biotopbäume sichern lassen — bis zu <strong>1.400 € pro Eiche</strong>. Antragsweg läuft über das Online-Portal wald.web.nrw.de mit Unterstützung des zuständigen Försters.
            </p>

            <h2>Was Sie von uns bekommen</h2>
            <ul>
              <li>Kostenfreie Erstprüfung Ihrer Fläche auf Eignung für VNS / Ökokonto / Biotopbaum</li>
              <li>Koordination mit Bio-Station Lippe, UNB Kreis Lippe, LWK NRW und Förster</li>
              <li>Antragsstellung über ELAN bzw. wald.web.nrw.de</li>
              <li>Bei Ökopunkten: Vermarktung und Vermittlung an Bedarfsträger</li>
              <li>Bei Bedarf: Vermittlung von Lohnunternehmern für die Umsetzung der Maßnahmen</li>
            </ul>

            <h2>Häufige Fragen zu Ökopunkten & Vertragsnaturschutz NRW</h2>
            <dl>
              {faq.map((item) => (
                <div key={item.q} className="mb-6">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-1">{item.a}</dd>
                </div>
              ))}
            </dl>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="vns-oekopunkte"
              defaultIntent="VNS / Ökopunkte"
              title="Förderberatung anfragen"
              subtitle="Wir prüfen Ihre Fläche kostenlos und melden uns innerhalb von 24 Stunden."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
