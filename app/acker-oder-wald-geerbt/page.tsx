import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import AblaufFristen from "@/components/AblaufFristen";
import { ratgeberSchema, seitenMetadaten } from "@/lib/seo";

// Landingpage „Acker oder Wald geerbt“ (Dennis 27.09.2026, Marktidee): was Erben jetzt tun
// können — ohne Steuerteil. Beide Wege getrennt: Direktankauf durch die TR Vertriebs GmbH
// (ohne Makler und Provision) oder Vermittlung (für Eigentümer kostenlos).

const TITEL = "Acker oder Wald geerbt? Was jetzt zu tun ist";
const BESCHREIBUNG =
  "Acker, Wiese oder Wald geerbt? Was jetzt zu tun ist, was eine Erbengemeinschaft gemeinsam entscheiden muss — und wie Sie behalten, verpachten oder verkaufen, ohne Provision.";
const PFAD = "/acker-oder-wald-geerbt";

export const metadata: Metadata = seitenMetadaten({
  title: TITEL,
  description: BESCHREIBUNG,
  pfad: PFAD,
});

const faq: { q: string; a: string }[] = [
  {
    q: "Muss ich die geerbte Fläche sofort verkaufen?",
    a: "Nein. Es gibt keine Pflicht, schnell zu entscheiden. Bestehende Pachtverträge laufen weiter, die Fläche bleibt Ihnen. Sinnvoll ist, zuerst die Lage zu klären (Grundbuch, Pacht, laufende Förderverpflichtungen) und dann in Ruhe zu entscheiden.",
  },
  {
    q: "Was kostet es, die Erben ins Grundbuch eintragen zu lassen?",
    a: "Die Berichtigung des Grundbuchs auf die Erben ist gebührenfrei, wenn der Antrag binnen zwei Jahren nach dem Erbfall beim Grundbuchamt eingeht. Kosten entstehen gegebenenfalls für den Erbnachweis (Erbschein oder beglaubigtes notarielles Testament mit Eröffnungsprotokoll).",
  },
  {
    q: "Können einzelne Miterben allein verkaufen?",
    a: "Über eine Fläche aus dem Nachlass können die Erben nur gemeinsam verfügen (§ 2040 BGB). Jeder Miterbe kann aber über seinen Anteil am gesamten Nachlass verfügen. Für einen Verkauf der Fläche müssen also alle mitziehen — oder die Erbengemeinschaft wird vorher auseinandergesetzt.",
  },
  {
    q: "Was kostet mich Ihre Hilfe?",
    a: "Die Wertindikation ist kostenlos. Kauft die TR Vertriebs GmbH die Fläche selbst, gibt es keinen Makler und keine Provision. Vermitteln wir einen Käufer oder Pächter, ist das für Sie als Eigentümer ebenfalls kostenlos; nur der Käufer bzw. Pächter zahlt im Erfolgsfall eine Provision.",
  },
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Erbe · Acker, Wiese, Wald"
        title="Acker oder Wald geerbt? Ihre Möglichkeiten — in Ruhe sortiert."
        subtitle="Eine geerbte Fläche wirft viele Fragen auf: Was ist sie wert, was läuft weiter, was muss die Erbengemeinschaft gemeinsam entscheiden? Hier ist der Überblick — ohne Druck und ohne Provision für Sie."
        primaryCta={{ href: "#anfrage", label: "Kostenlose Einschätzung" }}
        secondaryCta={{ href: "/flaeche-bewerten", label: "Wert selbst berechnen" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe min-w-0">
            <h2>Die ersten Schritte nach dem Erbfall</h2>
            <ul>
              <li>
                <strong>Erbnachweis:</strong> Erbschein vom Nachlassgericht oder notarielles Testament mit Eröffnungsprotokoll.
              </li>
              <li>
                <strong>Grundbuch berichtigen:</strong> gebührenfrei, wenn der Antrag binnen zwei Jahren nach dem Erbfall eingeht.
              </li>
              <li>
                <strong>Pachtverträge prüfen:</strong> Ein bestehender Pachtvertrag läuft weiter; die Erben treten an die Stelle des Verpächters. Pachtzins, Laufzeit und Kündigungsfristen stehen im Vertrag.
              </li>
              <li>
                <strong>Laufende Verpflichtungen:</strong> Vertragsnaturschutz, Aufforstungsförderung oder Ökokonto-Maßnahmen können weiterlaufen und gehen auf die Erben über — die Unterlagen dazu früh zusammensuchen.
              </li>
              <li>
                <strong>Beim Wald und bei Flächen im Außenbereich:</strong> die Verkehrssicherung an Wegen und Straßen, in der Regel die Mitgliedschaft in der Jagdgenossenschaft und Beiträge (etwa zur landwirtschaftlichen Berufsgenossenschaft) gehen mit über.
              </li>
            </ul>

            <h2>Erbengemeinschaft: gemeinsam entscheiden</h2>
            <p>
              Mehrere Erben bilden eine Erbengemeinschaft. Über eine Fläche aus dem Nachlass können sie nur gemeinsam verfügen (§ 2040 BGB). Das ist oft der schwierigste Teil — nicht der Markt. Bewährt hat sich, zuerst eine gemeinsame Grundlage zu schaffen: Was ist die Fläche wert, was bringt sie laufend, was will jeder?
            </p>
            <p>
              Übliche Lösungen: gemeinsam behalten und verpachten, gemeinsam verkaufen, oder ein Miterbe übernimmt die Fläche und zahlt die anderen aus. Die Teilungsversteigerung ist der letzte Ausweg — sie dauert lange und bringt selten den besten Preis.
            </p>

            <h2>Drei Wege — ehrlich verglichen</h2>
            <h3>1. Behalten und verpachten</h3>
            <p>
              Die Fläche bleibt in der Familie und bringt laufend Pacht. Wir vermitteln einen passenden Pächter — für Sie als Eigentümer kostenlos; den Pachtvertrag können Sie auf Wunsch online schließen. Mehr unter <Link href="/flaeche-verpachten">Fläche verpachten</Link>.
            </p>
            <h3>2. Verkaufen an die TR Vertriebs GmbH (Direktankauf)</h3>
            <p>
              Die TR Vertriebs GmbH (Betreiberin von Lippe Forst) kauft geeignete Flächen selbst — ohne Makler, ohne Provision, ohne öffentliche Vermarktung. Gerade für Erbengemeinschaften kann ein Käufer, der alle Miterben gleich behandelt und die Abwicklung mit dem Notar abstimmt, vieles vereinfachen.
            </p>
            <h3>3. Verkaufen an einen vermittelten Käufer</h3>
            <p>
              Wir stellen Ihre Fläche passenden Käufern vor — zuerst anonym, auf Wunsch in unserer <Link href="/flaechenboerse">Flächenbörse</Link> (nur mit Ihrer Zustimmung). Für Sie ist das kostenlos; nur der Käufer zahlt im Erfolgsfall eine Provision.
            </p>

            <h2>Was ist die geerbte Fläche wert?</h2>
            <p>
              Den ersten Anhaltspunkt geben die Bodenrichtwerte (BORIS NRW) und der Grundstücksmarktbericht des Kreises. Mit Gemarkung, Flur und Flurstück ermitteln wir Ihnen kostenlos eine Wertindikation — die Fläche, die Nutzung und den amtlichen Richtwert lesen wir aus dem Kataster NRW. Selbst ausprobieren können Sie es mit unserem <Link href="/flaeche-bewerten">Wertrechner</Link>.
            </p>
            <p className="text-sm text-[color:var(--color-muted)]">
              Rechtliche Fragen zur Erbauseinandersetzung klären der Notar bzw. Ihr Anwalt; eine Rechtsberatung im Einzelfall leisten wir nicht.
            </p>

            <h2>Häufige Fragen</h2>
            <div className="mt-4 space-y-4 not-prose">
              {faq.map((f) => (
                <details key={f.q} className="card group">
                  <summary className="cursor-pointer list-none flex justify-between items-center font-serif text-lg">
                    {f.q}
                    <span className="ml-4 text-[color:var(--color-brand)] group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="acker-oder-wald-geerbt"
              defaultIntent="Bewertung"
              title="Geerbte Fläche einschätzen lassen"
              subtitle="Gemarkung und Flurstück genügen — wir melden uns in der Regel innerhalb eines Werktags per E-Mail."
            />
          </aside>
        </div>
      </section>

      <AblaufFristen />

      {ratgeberSchema({
        titel: TITEL,
        beschreibung: BESCHREIBUNG,
        pfad: PFAD,
        veroeffentlicht: "2026-09-27",
        aktualisiert: "2026-09-27",
      }).map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }),
        }}
      />
    </>
  );
}
