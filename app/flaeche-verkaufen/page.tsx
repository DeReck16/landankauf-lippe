import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Fläche verkaufen im Kreis Lippe — fair, regional, ohne Provision",
  description:
    "Ackerland, Wiese oder Wald im Kreis Lippe verkaufen? Wir kaufen direkt zum fairen Preis — ohne Makler, ohne Provision, mit voller Diskretion. Antwort innerhalb von 24 Stunden.",
  alternates: { canonical: "/flaeche-verkaufen" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Direktankauf"
        title="Landwirtschaftliche Fläche verkaufen — diskret, fair und ohne Maklerkette."
        subtitle="Wir kaufen Ackerland, Grünland und Waldgrundstücke im Kreis Lippe und der näheren Umgebung. Sie bekommen einen fairen Preis nach Bodenrichtwert, eine ehrliche Einschätzung innerhalb von 24 Stunden und einen klaren Ablauf bis zur Auszahlung."
        primaryCta={{ href: "#anfrage", label: "Kostenlose Wertindikation" }}
        secondaryCta={{ href: "/flaeche-bewerten", label: "Vorab kostenlos bewerten" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Warum Direktverkauf</span>
            <hr className="divider mt-3" />
            <h2>Drei Gründe, warum Verkäufer im Kreis Lippe direkt an uns verkaufen.</h2>
            <p>
              Der klassische Verkauf über einen Immobilienmakler kostet Zeit, Provision und Diskretion. Wir kaufen selbst — mit Eigenkapital, ohne Finanzierungsvorbehalt und ohne Aushängung. So sieht ein typischer Direktverkauf bei uns aus:
            </p>
            <h3>1. Fairer Preis nach Bodenrichtwert</h3>
            <p>
              Wir orientieren uns an den jährlich aktualisierten Bodenrichtwerten des Gutachterausschusses Kreis Lippe und an realen Vergleichsverkäufen aus den Gemeinden Detmold, Lemgo, Bad Salzuflen, Horn-Bad Meinberg, Blomberg, Lage und dem gesamten Lipper Land. Sie bekommen keine "Lockangebote", sondern eine Zahl, die wir auch erklären können.
            </p>
            <h3>2. Volle Diskretion ohne Aushängung</h3>
            <p>
              Ihre Fläche wird nicht ins Schaufenster gestellt. Es gibt kein Inserat, keine Ortstafel und keine offene Vermarktung. Nachbarn, Pächter oder andere Landwirte erfahren erst nach Ihrer Zustimmung von dem Verkauf — wenn überhaupt.
            </p>
            <h3>3. Sauberer Ablauf trotz komplexer Eigentumslage</h3>
            <p>
              Erbengemeinschaften, ungeklärte Grundbücher, mehrere Miteigentümer, laufende Pachtverträge oder noch eingetragene Wegerechte sind kein Problem. Wir haben den Ablauf für genau diese Fälle eingespielt — gemeinsam mit Notar, Grundbuchamt und ggf. Landwirtschaftskammer.
            </p>

            <h2>Welche Flächen wir ankaufen</h2>
            <ul>
              <li><strong>Ackerland</strong> — egal ob hofnah oder hofentfernt, ob mit oder ohne laufenden Pachtvertrag</li>
              <li><strong>Grünland und Wiesen</strong> — auch extensive Mähwiesen, Streuobst, Hangflächen, Talauen</li>
              <li><strong>Waldflächen und Forst</strong> — Mischbestand, Nadel- oder Laubwald, ab ca. 0,5 Hektar</li>
              <li><strong>Mischflächen</strong> — Acker mit Hecken, Knicks, Wegen oder Tümpeln</li>
              <li><strong>Schwerflächen</strong> — Hang, Moor, Naturschutz, FFH-Gebiet, Bodendenkmal</li>
            </ul>

            <h2>Was wir nicht verlangen</h2>
            <ul>
              <li>Keine Provision oder Maklergebühr</li>
              <li>Keine Bewertungsgebühr</li>
              <li>Keine Exklusivität — Sie sind frei, sich woanders umzuhören</li>
              <li>Keine versteckten Klauseln im Kaufvertrag</li>
            </ul>

            <h2>Das Grundstücksverkehrsgesetz und Sie</h2>
            <p>
              Bei landwirtschaftlichen Flächen ab 1 ha greift in NRW das Grundstücksverkehrsgesetz (GrdstVG). Das bedeutet: Der Kaufvertrag muss von der Landwirtschaftskammer genehmigt werden, und es kann ein <Link href="/ratgeber/grundstuecksverkehrsgesetz">siedlungsrechtliches Vorkaufsrecht</Link> ausgeübt werden. Wir kennen den Ablauf, koordinieren die Genehmigungsphase mit dem Notar und sorgen dafür, dass Sie nicht in der Bürokratie stecken bleiben.
            </p>

            <h2>Kommen wir ins Gespräch?</h2>
            <p>
              Schicken Sie uns eine kurze Nachricht über das Formular oder rufen Sie an. Sie bekommen innerhalb von 24 Stunden eine erste Einschätzung — kostenlos, unverbindlich und auf Augenhöhe.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="flaeche-verkaufen"
              defaultIntent="Verkaufen"
              title="Verkaufsanfrage"
              subtitle="Sie hören innerhalb von 24 Stunden persönlich von uns."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
