import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import OekopunkteRolle from "@/components/OekopunkteRolle";
import { seitenMetadaten } from "@/lib/seo";

export const metadata: Metadata = seitenMetadaten({
  title: "Ökopunkte NRW: verkaufen, kaufen, Preis",
  description:
    "Ökopunkte in NRW verkaufen oder kaufen: Preis, Ökokonto, Erstaufforstung und Vertragsnaturschutz erklärt — und was Lippe Forst dabei tut (und was nicht).",
  pfad: "/services/vns-oekopunkte",
  ogTitle: "Ökopunkte, Ökokonto und Vertragsnaturschutz in NRW — was für Ihre Fläche in Frage kommt",
});

const faq = [
  {
    q: "Betreibt Lippe Forst ein eigenes Ökokonto oder verkauft Ökopunkte?",
    a: "Nein. Lippe Forst betreibt kein eigenes Ökokonto und verkauft keine eigenen Ökopunkte. Wir prüfen Flächen von Eigentümern, stimmen uns mit der Unteren Naturschutzbehörde und der Biologischen Station Lippe ab und bringen Eigentümer mit Interessenten zusammen. Wer Ökopunkte oder Kompensationsflächen sucht, findet auf der Seite „Ökopunkte kaufen“, was wir dafür tun können und was nicht.",
  },
  {
    q: "Wie viel sind Ökopunkte in NRW wert?",
    a: "Es gibt keinen amtlichen Preis: Ökopunkte werden frei zwischen Eigentümer und Käufer verhandelt, je nach Maßnahme, Naturraum und Nachfrage. Öffentliche Orderbücher zeigen sehr weite Spannen — beim Marktplatz Ökopunktemarkt lagen am 25.08.2026 die Angebote für NRW zwischen 1,00 und 50,00 €, die Gesuche zwischen 0,10 und 6,50 € je Punkt (Wunschpreise, keine Abschlüsse). Belastbar wird ein Preis erst mit einem konkreten Käufer. Vom Erlös gehen Kosten ab: Herstellung und Pflege der Maßnahme, das Entgelt der Unteren Naturschutzbehörde, die Grundbucheintragung und gegebenenfalls eine Vermittlungsprovision.",
  },
  {
    q: "Wie viele Ökopunkte bringt ein Hektar?",
    a: "Das hängt vom Ausgangs- und vom Zielbiotop ab. Nach dem Arbeitsblatt 61 des Landesamts für Natur, Umwelt und Klima NRW (Stand März 2026) hat jeder Biotoptyp 0 bis 10 Wertpunkte je Quadratmeter; gutgeschrieben wird die Differenz zwischen dem Wert, den die Fläche nach 30 Jahren voraussichtlich erreicht, und dem heutigen Wert. Beispiel: Intensiver Acker (2 Punkte) wird zu artenreichem Grünland mit dem Prognosewert 6 — das sind vier Punkte mehr je Quadratmeter, also 40.000 Punkte je Hektar. Je nach Zielbiotop liegt die Spanne bei Acker zwischen 30.000 und 50.000 Punkten je Hektar.",
  },
  {
    q: "Kann ich Vertragsnaturschutz und Ökopunkte kombinieren?",
    a: "Nicht für dieselbe Aufwertung auf derselben Fläche. Eine Ökokonto-Maßnahme darf nicht mit öffentlichen Mitteln gefördert werden und muss über eine ohnehin bestehende Verpflichtung hinausgehen (§ 16 Bundesnaturschutzgesetz, Ökokonto-Verordnung NRW). Für eine Fläche im Vertragsnaturschutz scheidet dieselbe Aufwertung deshalb aus. Verschiedene Flächen lassen sich dagegen unterschiedlich nutzen.",
  },
  {
    q: "Kann ich Ökopunkte verkaufen, ohne Eigentümer zu sein?",
    a: "In der Regel nicht allein. Für das Ökokonto muss die uneingeschränkte Verfügungsbefugnis über die Fläche nachgewiesen werden, und die dingliche Sicherung — üblicherweise eine beschränkte persönliche Dienstbarkeit im Grundbuch — kann nur der Eigentümer bewilligen. Ein Pächter braucht deshalb mindestens die Mitwirkung des Eigentümers; ob die Untere Naturschutzbehörde ihn als Antragsteller akzeptiert, entscheidet sie im Einzelfall.",
  },
  {
    q: "Bringt eine Erstaufforstung Ökopunkte?",
    a: "Ja, aber mit Auflagen. Die Neuanlage von Wald braucht eine Genehmigung der Forstbehörde (§ 41 Landesforstgesetz NRW) und muss vor Beginn als Ökokonto-Maßnahme beantragt werden. Bei überwiegend lebensraumtypischen Baumarten bringt sie von Acker aus rechnerisch etwa 30.000 bis 40.000 Punkte je Hektar. Wertvolles Offenland wie artenreiche Wiesen gilt nicht als geeignete Fläche, und was einmal Wald ist, bleibt rechtlich Wald.",
  },
  {
    q: "In welchem Naturraum liegt der Kreis Lippe?",
    a: "Der Kreis Lippe liegt überwiegend im Weserbergland — Naturraum D36 (Unteres Weserbergland und Oberes Weser-Leinebergland), in NRW der Kompensationsraum K03; Horn-Bad Meinberg gehört dazu. Ökopunkte gelten in der Regel nur für Eingriffe im selben Naturraum bzw. Kompensationsraum. Vorhaben in der Westfälischen Bucht (Naturraum D34, Kompensationsraum K01) brauchen Punkte von dort. Gemeinden am westlichen Rand des Kreises können abweichen.",
  },
  {
    q: "Wann lohnt sich Vertragsnaturschutz NRW für mich?",
    a: "Vertragsnaturschutz lohnt sich vor allem für extensiv nutzbare Flächen: Steillagen, feuchte Grünlandparzellen, Streuobstwiesen, Bachauen und Flächen in FFH-Kulissen. Für extensive Wiesennutzung zahlt das Land je nach Paket etwa 380 bis 685 € je Hektar und Jahr, für Weidenutzung etwa 335 bis 680 €; für Sonderpakete sind höhere Sätze möglich, der Höchstbetrag liegt bei 2.280 € je Hektar und Jahr. Das liegt meist deutlich über dem Pachtpreis für schwer bewirtschaftbare Flächen. Wir prüfen kostenlos, ob Ihre Fläche in Frage kommt.",
  },
  {
    q: "Wie lange dauert ein VNS-Antrag im Kreis Lippe?",
    a: "Die Bearbeitung durch die Untere Naturschutzbehörde dauert in der Regel wenige Wochen, kann bei Nachforderungen und begrenzten Fördermitteln aber länger dauern. Die Verpflichtung startet immer zum 1. Januar des Folgejahres und läuft in der Regel fünf Jahre — deswegen ist die Antragsfrist 30.06. entscheidend. Für einen Start am 01.01.2028 ist das voraussichtlich der 30.06.2027. Wir bereiten alles vor, Sie reichen den Antrag final elektronisch über ELAN ein.",
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
        eyebrow="Ökopunkte · Ökokonto · Vertragsnaturschutz"
        title="Ökopunkte, Ökokonto und Vertragsnaturschutz — was für Ihre Fläche in Frage kommt."
        subtitle="Für Eigentümer: Wir prüfen kostenlos, ob eine Fläche für Vertragsnaturschutz oder eine Ausgleichsmaßnahme in Frage kommt. Für Projektentwickler und Planer: Wir bringen Sie mit Eigentümern im Kreis Lippe zusammen — ein eigenes Ökokonto betreiben wir nicht."
        primaryCta={{ href: "#anfrage", label: "Fläche prüfen lassen" }}
        secondaryCta={{ href: "/oekopunkte-kaufen", label: "Sie suchen Ökopunkte? Hier entlang" }}
      />

      <div className="container-page px-5 pt-10 md:pt-14">
        <OekopunkteRolle />
      </div>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe min-w-0">
            <span className="eyebrow">Für Eigentümer</span>
            <hr className="divider mt-3" />
            <h2>Vertragsnaturschutz NRW (VNS)</h2>
            <p>
              Der Vertragsnaturschutz ist ein Förderprogramm des Landes NRW, mit dem extensive landwirtschaftliche Nutzung honoriert wird. Eigentümer und Bewirtschafter verpflichten sich in der Regel für fünf Jahre zu einer schonenden Bewirtschaftung. Für extensive Wiesennutzung zahlt das Land je nach Paket <strong>etwa 380 bis 685 € je Hektar und Jahr</strong>, für extensive Weidenutzung etwa 335 bis 680 €; für Sonderpakete sind höhere Sätze möglich (Höchstbetrag 2.280 € je Hektar und Jahr; Sätze laut Naturschutzinformationen NRW, Stand 2025).
            </p>
            <p>
              Im Kreis Lippe spielt VNS vor allem in den Schutzgebietskulissen rund um die Egge, das Silberbachtal, das Externstein-Gebiet und in den Auen von Werre, Bega und Emmer eine Rolle. Wir stimmen den Antrag mit der <Link href="https://www.biologischestationlippe.de" target="_blank" rel="noopener">Biologischen Station Lippe</Link> und der Unteren Naturschutzbehörde des Kreises ab.
            </p>

            <h3>Typische VNS-Pakete im Kreis Lippe</h3>
            <ul>
              <li>Extensive Mähwiesen mit später erster Mahd</li>
              <li>Streuobstwiesenpflege</li>
              <li>Acker → Grünland-Umwandlung mit langfristiger Sicherung</li>
              <li>Ackerextensivierung (Lerchenfenster, Stoppelbrache)</li>
              <li>Hecken- und Knickpflege</li>
            </ul>
            <p>
              Ausgleichsflächen und Wald sind nicht VNS-förderfähig, und eine Ökokonto-Maßnahme darf nicht zusätzlich öffentlich gefördert werden — für dieselbe Aufwertung auf derselben Fläche gilt deshalb entweder VNS <em>oder</em> Ökokonto.
            </p>

            <h3>Antragsfrist: jeweils 30. Juni</h3>
            <p>
              Neue VNS-Verträge beginnen immer am 1. Januar. Der Grundantrag muss bis zum <strong>30. Juni des Vorjahres</strong> elektronisch über ELAN bei der Unteren Naturschutzbehörde Kreis Lippe eingehen — für einen Start am 01.01.2028 also voraussichtlich bis 30.06.2027 (die Frist für 2027 ist am 30.06.2026 abgelaufen). Wer die Frist versäumt, verliert ein ganzes Jahr Förderung. Wenn Ihre Fläche dafür in Frage kommt, sprechen Sie uns rechtzeitig an.
            </p>

            <h2>Ökopunkte und Ökokonto: So funktioniert es in NRW</h2>
            <p>
              Wer Natur und Landschaft beeinträchtigt — durch ein Baugebiet, eine Straße, ein Windrad oder einen Solarpark — muss das ausgleichen (§§ 13–17 Bundesnaturschutzgesetz). Das geht durch eine Maßnahme im Voraus: Über das <strong>Ökokonto</strong> wird eine Aufwertung anerkannt und in Ökopunkten gutgeschrieben, die der Verursacher später für seinen Eingriff nutzen kann. In NRW regeln das die §§ 31 und 32 Landesnaturschutzgesetz und die Ökokonto-Verordnung. Das Ökokonto führt die Untere Naturschutzbehörde des Kreises oder ein von ihr zugelassener Dritter.
            </p>
            <p>
              Der Ablauf: Die Maßnahme wird <strong>vor Beginn</strong> bei der Unteren Naturschutzbehörde beantragt, geprüft und bewertet, danach umgesetzt, abgenommen und als Punkte eingebucht. Eine nachträgliche Anerkennung bereits durchgeführter Maßnahmen ist nicht möglich. Den Verkauf der Punkte vereinbaren Kontoinhaber und Eingriffsverursacher direkt miteinander.
            </p>

            <h3>Wie viele Punkte eine Maßnahme bringt</h3>
            <p>
              Bewertet wird nach dem <Link href="https://www.lanuk.nrw.de/fileadmin/lanuvpubl/4_arbeitsblaetter/Arbeitsblatt_61.pdf" target="_blank" rel="noopener">Arbeitsblatt 61 des Landesamts für Natur, Umwelt und Klima NRW</Link> („Numerische Bewertung von Biotoptypen für die Eingriffsregelung“, Stand März 2026). Jeder Biotoptyp hat 0 bis 10 Wertpunkte je Quadratmeter. Maßgeblich ist der Wert, den die Fläche nach 30 Jahren voraussichtlich erreicht (Prognosewert). Gutgeschrieben wird die Differenz zum heutigen Wert, mal Fläche.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mt-3 border-collapse text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-brand-soft)] text-left">
                    <th className="p-3 border border-[color:var(--color-line)]">Biotoptyp (Auszug)</th>
                    <th className="p-3 border border-[color:var(--color-line)] text-right">Wertpunkte je m²</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]">Acker, intensiv, wenige Wildkräuter</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">2</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]">Acker, mäßig extensiv (nährstoffreicher Boden)</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">4</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]">Fettwiese, artenarm / mäßig artenreich</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">3 / 4</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]">Artenreiches Grünland (je nach Ausprägung)</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">5 bis 7</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]">Streuobstwiese mit Hochstämmen (Bäume unter 10 / 10–30 / über 30 Jahre)</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">5 / 6 / 7</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-[color:var(--color-line)]">Junger Wald (Jungwuchs bis Stangenholz), je nach Anteil lebensraumtypischer Baumarten</td>
                    <td className="p-3 border border-[color:var(--color-line)] text-right">3 bis 6</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[color:var(--color-muted)]">
              Vereinfachter Auszug. Maßgeblich sind die Ausprägung der konkreten Fläche und die Bewertung durch die Untere Naturschutzbehörde.
            </p>
            <p>
              <strong>Beispiel:</strong> Intensiver Acker (2 Punkte) wird zu artenreichem Grünland mit dem Prognosewert 6. Das sind vier Punkte mehr je Quadratmeter — <strong>40.000 Punkte je Hektar</strong>; je nach Zielbiotop 30.000 bis 50.000. Bei Flächen, die schon artenreiches Grünland sind, bringt eine Umwandlung dagegen kaum oder keine Punkte.
            </p>

            <h3>Was ein Ökopunkt kostet — und was vom Erlös abgeht</h3>
            <p>
              Es gibt keinen amtlichen Preis. Punkte werden frei verhandelt; öffentliche Orderbücher zeigen sehr weite Spannen (Ökopunktemarkt, Stand 25.08.2026: NRW-Angebote 1,00–50,00 €, Gesuche 0,10–6,50 € je Punkt — Wunschpreise, keine Abschlüsse). Zur Rechenillustration: 40.000 Punkte je Hektar sind bei 0,50 € je Punkt 20.000 €, bei 1,00 € je Punkt 40.000 € — vor Kosten. Zu den Kosten zählen die Herstellung und Pflege der Maßnahme, das Entgelt der Unteren Naturschutzbehörde, die Grundbucheintragung und gegebenenfalls eine Vermittlungsprovision. Verbindlich wird ein Preis erst mit einem konkreten Käufer.
            </p>

            <h3>Voraussetzungen, die man vorher kennen sollte</h3>
            <ul>
              <li><strong>Eigentümer:</strong> Nachzuweisen ist die uneingeschränkte Verfügungsbefugnis; die dingliche Sicherung (üblicherweise eine beschränkte persönliche Dienstbarkeit im Grundbuch) bewilligt der Eigentümer. Wie lange sie bindet, legt die Behörde fest.</li>
              <li><strong>Zusätzlichkeit:</strong> Die Maßnahme muss über bestehende Verpflichtungen hinausgehen und darf nicht mit öffentlichen Mitteln gefördert werden (§ 16 Bundesnaturschutzgesetz, Ökokonto-Verordnung NRW).</li>
              <li><strong>Antrag vor Beginn:</strong> Was ohne Antrag bereits umgesetzt wurde, wird nicht mehr anerkannt.</li>
              <li><strong>Naturraum:</strong> Punkte gelten in der Regel für Eingriffe im selben Naturraum bzw. Kompensationsraum. Der Kreis Lippe liegt überwiegend im Weserbergland (Naturraum D36, Kompensationsraum K03), nicht in der Westfälischen Bucht (D34).</li>
              <li><strong>Vorrang für Alternativen:</strong> Vorrangig wird geprüft, ob der Ausgleich durch Entsiegelung, Wiedervernetzung von Lebensräumen oder Bewirtschaftungs- und Pflegemaßnahmen erbracht werden kann, damit möglichst keine Flächen aus der Nutzung genommen werden (§ 15 Abs. 3 Bundesnaturschutzgesetz).</li>
            </ul>
            <p>
              Wer als Käufer der Punkte auftritt, sind vor allem Kommunen, Projektentwickler und Bauträger, Betreiber von Windenergie- und Solaranlagen sowie Träger von Straßen- und Leitungsvorhaben. Vermarktet wird über Stiftungen und Flächenagenturen, Poolbetreiber und Online-Marktplätze — oder direkt zwischen Kontoinhaber und Verursacher.
            </p>

            <h2>Erstaufforstung als Ökopunkte-Maßnahme</h2>
            <p>
              Wer Acker oder Grünland aufforstet, kann dafür Ökopunkte bekommen — in NRW aber nur mit Genehmigung und mit Einschränkungen:
            </p>
            <ul>
              <li><strong>Genehmigung:</strong> Die Neuanlage von Wald (Erstaufforstung) ist nur mit Genehmigung der Forstbehörde zulässig (§ 41 Landesforstgesetz NRW). Für den Kreis Lippe ist das Regionalforstamt Ostwestfalen-Lippe von Wald und Holz NRW zuständig. Versagt werden darf sie nur, wenn Ziele der Raumordnung, Belange von Naturschutz, Boden oder Landschaftspflege oder die Agrarstruktur entgegenstehen. In Landschaftsschutzgebieten kann der Landschaftsplan Aufforstungen zusätzlich einschränken.</li>
              <li><strong>Ökokonto:</strong> Zusätzlich muss die Maßnahme vor Beginn bei der Unteren Naturschutzbehörde beantragt werden. Junger Wald wird als „Jungwuchs bis Stangenholz“ bewertet: bei überwiegend lebensraumtypischen Baumarten mit dem Prognosewert 6, bei einem geringeren Anteil mit 3 bis 5; auf isoliert liegenden Flächen mitten im Offenland gibt es einen Punkt Abschlag (mindestens 3). Von intensivem Acker (2 Punkte) aus sind das grob 30.000 bis 40.000 Punkte je Hektar.</li>
              <li><strong>Was dagegen spricht:</strong> Die Aufforstung wertvoller Offenlandbiotope wie artenreicher Wiesentäler gilt nicht als geeigneter Ausgleich, und in Gebieten mit mehr als 40 % Waldanteil hat der Waldumbau Vorrang vor der Neuanlage von Wald (Hinweise des Landes zur Ökokonto-Verordnung, Stand 2008). Wald- und Gehölzflächen machen im Kreis Lippe rund 31 %, in Horn-Bad Meinberg rund 38 % der Fläche aus (IT.NRW, 31.12.2024).</li>
              <li><strong>Dauerhaft:</strong> Was einmal Wald ist, bleibt rechtlich Wald; eine spätere Umwandlung braucht eine eigene Genehmigung. Ob und wie eine Erstaufforstung derzeit gefördert wird, klären Sie vorab mit dem Regionalforstamt — eine Doppelförderung derselben Maßnahme mit Ökopunkten ist ausgeschlossen.</li>
            </ul>
            <p>
              Am ehesten in Betracht kommen Ackerflächen mit geringer Bodenwertigkeit am Waldrand, außerhalb von Schutzgebieten, ohne Leitungs- und Wegerechte, die dem Vorhaben entgegenstehen. Wir prüfen das gern grob vor — die Entscheidung treffen Forstbehörde und Untere Naturschutzbehörde.
            </p>

            <h2>Biotopbaumförderung NRW (Privatwald)</h2>
            <p>
              Sie haben Wald mit dicken Eichen, Buchen oder anderen Laubbäumen ab 40 cm Brusthöhendurchmesser? Über die <strong>Förderrichtlinie Privat- und Körperschaftswald NRW (FöRL)</strong> können Bäume gegen einmalige Festbeträge dauerhaft als Biotopbäume gesichert werden — bis zu <strong>1.400 € pro Eiche</strong>. Antragsweg über das Online-Portal wald.web.nrw.de mit Unterstützung des zuständigen Försters.
            </p>

            <h2>Was Sie als Eigentümer von uns bekommen</h2>
            <ul>
              <li>Kostenfreie Erstprüfung Ihrer Fläche auf Eignung für VNS, Ökokonto oder Biotopbaum (Lage, Schutzgebietskulisse, Nutzung, Pachtverhältnis)</li>
              <li>Abstimmung mit Biologischer Station Lippe, Unterer Naturschutzbehörde, Landwirtschaftskammer NRW und Forstbehörde</li>
              <li>Unterstützung bei der Antragsstellung über ELAN bzw. wald.web.nrw.de</li>
              <li>Auf Wunsch: Kontakt zu Interessenten, die Flächen oder Punkte suchen — Kontaktdaten geben wir nur weiter, wenn beide Seiten zugestimmt haben</li>
              <li>Bei Bedarf: Vermittlung von Lohnunternehmern für die Umsetzung der Maßnahmen</li>
            </ul>
            <p>
              Nicht dazu gehören ein eigenes Ökokonto, der Verkauf von Punkten in unserem Namen, Preis- oder Abnahmegarantien sowie Rechts- und Steuerberatung.
            </p>

            <h2>Sie suchen Ökopunkte oder Kompensationsflächen?</h2>
            <p>
              Projektentwickler, Planer und Kommunen finden auf der Seite <Link href="/oekopunkte-kaufen">Ökopunkte kaufen</Link>, was wir im Kreis Lippe für sie tun können — und was nicht.
            </p>

            <h2>Häufige Fragen zu Ökopunkten und Vertragsnaturschutz in NRW</h2>
            <dl>
              {faq.map((item) => (
                <div key={item.q} className="mb-6">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-1">{item.a}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-[color:var(--color-muted)]">
              Stand: 29.09.2026. Diese Seite ersetzt keine Rechts-, Steuer- oder Fachberatung; Anerkennung und Punktzahl entscheiden die zuständigen Behörden.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="vns-oekopunkte"
              defaultIntent="VNS / Ökopunkte"
              title="Fläche prüfen lassen"
              subtitle="Wir prüfen Ihre Fläche kostenlos und melden uns in der Regel innerhalb eines Werktags per E-Mail."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
