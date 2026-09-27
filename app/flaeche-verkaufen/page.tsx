import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import AblaufFristen from "@/components/AblaufFristen";
import { seitenMetadaten } from "@/lib/seo";

export const metadata: Metadata = seitenMetadaten({
  title: "Fläche verkaufen in Lippe – ohne Provision",
  description:
    "Ackerland, Wiese oder Wald im Kreis Lippe verkaufen? Wir kaufen selbst — ohne Makler, ohne Provision — oder vermitteln einen Käufer, für Sie kostenlos. Antwort meist binnen eines Werktags.",
  pfad: "/flaeche-verkaufen",
});

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Direktankauf oder Vermittlung"
        title="Landwirtschaftliche Fläche verkaufen — diskret, fair und ohne Provision für Sie."
        subtitle="Die TR Vertriebs GmbH (Betreiberin von Lippe Forst) kauft Ackerland, Grünland und Waldgrundstücke im Kreis Lippe und der näheren Umgebung selbst — oder wir vermitteln Ihnen einen passenden Käufer. Sie bekommen in der Regel innerhalb eines Werktags eine ehrliche Einschätzung per E-Mail und einen klaren Ablauf bis zur Auszahlung."
        primaryCta={{ href: "#anfrage", label: "Kostenlose Wertindikation" }}
        secondaryCta={{ href: "/flaeche-bewerten", label: "Vorab kostenlos bewerten" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Zwei Wege</span>
            <hr className="divider mt-3" />
            <h2>Selbst kaufen lassen oder vermitteln lassen — Sie entscheiden.</h2>
            <p>
              <strong>Weg A — Direktankauf:</strong> Die TR Vertriebs GmbH kauft Ihre Fläche selbst. Es gibt keinen Makler und keine Provision; Sie verhandeln direkt mit dem Käufer.
            </p>
            <p>
              <strong>Weg B — Vermittlung:</strong> Wir stellen Ihre Fläche passenden Käufern vor, zuerst anonym. Für Sie als Eigentümer ist das kostenlos; nur der Käufer zahlt im Erfolgsfall eine Provision. Auf beiden Wegen gilt:
            </p>
            <h3>1. Fairer Preis nach Bodenrichtwert</h3>
            <p>
              Wir orientieren uns an den jährlich aktualisierten Bodenrichtwerten des Gutachterausschusses Kreis Lippe und an den Kaufpreisen, die der Grundstücksmarktbericht für Detmold, Lemgo, Bad Salzuflen, Horn-Bad Meinberg, Blomberg, Lage und das gesamte Lipper Land ausweist. Sie bekommen keine „Lockangebote“, sondern eine Zahl, die wir auch erklären können.
            </p>
            <h3>2. Volle Diskretion ohne Aushängung</h3>
            <p>
              Kein Aushang, keine Ortstafel, kein Inserat mit Ihrem Namen oder Flurstück. In unsere Flächenbörse kommt eine Fläche nur anonym und nur mit Ihrer ausdrücklichen Zustimmung. Nachbarn, Pächter oder andere Landwirte erfahren erst nach Ihrer Zustimmung von dem Verkauf — wenn überhaupt.
            </p>
            <h3>3. Sauberer Ablauf trotz komplexer Eigentumslage</h3>
            <p>
              Erbengemeinschaften, ungeklärte Grundbücher, mehrere Miteigentümer, laufende Pachtverträge oder noch eingetragene Wegerechte sind kein Problem. Wir haben den Ablauf für genau diese Fälle eingespielt — gemeinsam mit Notar, Grundbuchamt und ggf. Landwirtschaftskammer.
            </p>

            <h2>Welche Flächen wir kaufen oder vermitteln</h2>
            <ul>
              <li><strong>Ackerland</strong> — egal ob hofnah oder hofentfernt, ob mit oder ohne laufenden Pachtvertrag</li>
              <li><strong>Grünland und Wiesen</strong> — auch extensive Mähwiesen, Streuobst, Hangflächen, Talauen</li>
              <li><strong>Waldflächen und Forst</strong> — Mischbestand, Nadel- oder Laubwald, ab ca. 0,5 Hektar</li>
              <li><strong>Mischflächen</strong> — Acker mit Hecken, Knicks, Wegen oder Tümpeln</li>
              <li><strong>Schwerflächen</strong> — Hang, Moor, Naturschutz, FFH-Gebiet, Bodendenkmal</li>
            </ul>

            <h2>Was wir nicht verlangen</h2>
            <ul>
              <li>Keine Provision oder Maklergebühr — beim Direktankauf nicht und bei der Vermittlung nicht</li>
              <li>Keine Bewertungsgebühr</li>
              <li>Keine Exklusivität — Sie sind frei, sich woanders umzuhören</li>
              <li>Keine versteckten Klauseln im Kaufvertrag</li>
            </ul>

            <h2>Das Grundstücksverkehrsgesetz und Sie</h2>
            <p>
              Für land- oder forstwirtschaftliche Flächen von mehr als 1 ha braucht der Kaufvertrag in NRW eine Genehmigung nach dem Grundstückverkehrsgesetz (GrdstVG); zuständig ist die Kreisstelle der Landwirtschaftskammer als Landesbeauftragte. Ab 2 ha kann zusätzlich ein <Link href="/ratgeber/grundstuecksverkehrsgesetz">siedlungsrechtliches Vorkaufsrecht</Link> ausgeübt werden. Die Behörde entscheidet binnen eines Monats, in Ausnahmefällen binnen zwei oder drei Monaten. Den Antrag stellt der Notar; wir kennen den Ablauf und stimmen uns mit ihm ab, damit Sie nicht in der Bürokratie stecken bleiben.
            </p>

            <h2>Kommen wir ins Gespräch?</h2>
            <p>
              Schicken Sie uns eine kurze Nachricht über das Formular, per E-Mail oder WhatsApp. Sie bekommen in der Regel innerhalb eines Werktags eine erste Einschätzung per E-Mail — kostenlos, unverbindlich und auf Augenhöhe.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="flaeche-verkaufen"
              defaultIntent="Verkaufen"
              title="Verkaufsanfrage"
              subtitle="Antwort in der Regel innerhalb eines Werktags per E-Mail."
            />
          </aside>
        </div>
      </section>

      <AblaufFristen art="kauf" />
    </>
  );
}
