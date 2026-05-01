import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Ackerland verkaufen Kreis Lippe — Direktankauf ohne Provision",
  description:
    "Sie wollen Ackerland im Kreis Lippe verkaufen? Wir kaufen direkt — fair, diskret, ohne Maklerkette. Detmold, Lemgo, Bad Salzuflen, Horn-Bad Meinberg und ganz Lippe.",
  alternates: { canonical: "/ackerland-verkaufen" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ackerland · Kreis Lippe"
        title="Ackerland im Kreis Lippe verkaufen — direkt, fair, ohne Provision."
        subtitle="Wir kaufen Ackerland in allen Lipper Gemeinden: Detmold, Lemgo, Bad Salzuflen, Horn-Bad Meinberg, Blomberg, Lage, Oerlinghausen, Schieder-Schwalenberg, Schlangen, Augustdorf, Barntrup, Dörentrup, Extertal, Kalletal, Leopoldshöhe und Lügde — und auch im Umland."
        primaryCta={{ href: "#anfrage", label: "Ackerland-Anfrage" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Warum Ackerland im Kreis Lippe direkt verkaufen?</h2>
            <p>
              Der Markt für landwirtschaftliche Flächen in Ostwestfalen-Lippe ist eng. Nachfrage durch Landwirte, Investoren und Stiftungen ist hoch — was bedeutet, dass Sie als Verkäufer in der starken Position sind. Voraussetzung: Sie kennen den realen Marktwert und wissen, was bei einem Verkauf rechtlich beachtet werden muss.
            </p>
            <p>
              Wir kaufen Ackerland direkt. Das spart Ihnen die Maklerprovision (üblich: 3–5 % vom Kaufpreis), die Wartezeit für eine Vermarktung und die offene Aushängung. Sie bekommen eine ehrliche Wertindikation, einen klaren Zeitplan und einen Notartermin — fertig.
            </p>

            <h2>Bodenrichtwerte für Ackerland im Kreis Lippe</h2>
            <p>
              Die offiziellen Bodenrichtwerte des Gutachterausschusses Lippe sind im <Link href="https://geoportal.kreislippe.de/geoportal/application/bodenrichtwerte" target="_blank" rel="noopener">Geoportal des Kreises</Link> sowie unter <Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link> kostenlos einsehbar. Sie liegen je nach Lage und Bodenqualität typischerweise zwischen <strong>1,40 €/m² und 4,50 €/m²</strong> (entspricht 14.000–45.000 €/ha). Premium-Lagen mit hoher Bonität liegen darüber, schwere oder schlecht erschlossene Flächen darunter.
            </p>
            <p>
              Wichtig: Der Bodenrichtwert ist ein Mittelwert. Für eine konkrete Wertindikation brauchen wir Größe, Gemarkung, Flurstück und Pachtstatus — die Auswertung machen wir kostenlos über unser <Link href="/flaeche-bewerten">Bewertungs-Tool</Link>.
            </p>

            <h2>Verpachtetes Ackerland verkaufen</h2>
            <p>
              Ihre Fläche ist verpachtet? Kein Problem. Wir kaufen auch mit laufendem Pachtvertrag und übernehmen den bestehenden Vertrag. Der Pächter wird vor dem Verkauf transparent informiert — und kann ggf. sein gesetzliches Vorkaufsrecht prüfen. In der Regel laufen solche Verkäufe völlig geräuschlos ab.
            </p>

            <h2>Ackerland aus Erbengemeinschaft verkaufen</h2>
            <p>
              Erbengemeinschaften sind unser Spezialgebiet. Wir koordinieren mit allen Miteigentümern, bringen das Grundbuch auf den aktuellen Stand und sorgen für eine saubere Abwicklung — auch wenn die Eigentümer in unterschiedlichen Bundesländern oder im Ausland leben.
            </p>

            <h2>Genehmigungspflicht nach GrdstVG</h2>
            <p>
              Ab 1 ha greift in NRW das Grundstücksverkehrsgesetz. Der Kaufvertrag muss durch die Landwirtschaftskammer genehmigt werden, und das siedlungsrechtliche Vorkaufsrecht kann ausgeübt werden. Mehr dazu in unserem <Link href="/ratgeber/grundstuecksverkehrsgesetz">Ratgeber</Link>. Wir kennen den Ablauf und übernehmen die Koordination mit Notar und Behörde.
            </p>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ackerland-verkaufen"
              defaultIntent="Verkaufen"
              defaultFlaechentyp="Ackerland"
              title="Ackerland-Verkaufsanfrage"
              subtitle="Antwort innerhalb von 24 Stunden — diskret und unverbindlich."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
