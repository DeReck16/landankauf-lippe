import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import QuickValuation from "@/components/QuickValuation";
import { site } from "@/lib/site";

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
        subtitle="Wir kaufen Ackerland in allen 16 Lipper Kommunen und im angrenzenden Umland — auch verpachtet, auch aus einer Erbengemeinschaft."
        primaryCta={{ href: "#anfrage", label: "Unverbindlich bewerten" }}
        whatsappCta={{
          href: `https://wa.me/${site.contact.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Guten Tag, ich möchte mein Ackerland im Kreis Lippe verkaufen — bitte um eine diskrete Erstbewertung.")}`,
          label: "WhatsApp",
        }}
      />

      <section className="section border-b border-black/5">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.05fr] items-start">
          <div>
            <p className="eyebrow">Kurzantwort</p>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 leading-snug">Was ist Ackerland im Kreis Lippe wert?</h2>
            <p className="mt-4 text-lg leading-relaxed">Im Jahr 2024 wurden im Kreis Lippe <strong>75 Kauffälle über 163,67 Hektar</strong> Ackerland beurkundet — im Mittel <strong>5,26 €/m²</strong>, also rund <strong>52.600 € je Hektar</strong>. Nach oben und unten entscheidet vor allem die Bonität (Ackerzahl), dazu Zuschnitt, Hofnähe und Erschließung. Rechnen Sie Ihre Fläche rechts direkt durch — anonym, ohne Kontaktdaten.</p>
            <p className="mt-4 text-sm text-[color:var(--color-muted)] leading-relaxed">
              Quelle: Grundstücksmarktbericht 2025 für den Kreis Lippe (Berichtsjahr 2024),
              Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold.
               Der Bodenrichtwert liegt darunter: er ist ein geglätteter Lagewert, kein Kaufpreis.
            </p>
          </div>
          <div className="card">
            <QuickValuation
              compact
              defaultTyp="ackerland"
              ctaHref="#anfrage"
              heading="Was bringt mein Ackerland?"
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe order-1">
            <h2>Warum Ackerland im Kreis Lippe direkt verkaufen?</h2>
            <p>
              Der Markt für landwirtschaftliche Flächen in Ostwestfalen-Lippe ist eng. Nachfrage durch Landwirte, Investoren und Stiftungen ist hoch — was bedeutet, dass Sie als Verkäufer in der starken Position sind. Voraussetzung: Sie kennen den realen Marktwert und wissen, was bei einem Verkauf rechtlich beachtet werden muss.
            </p>
            <p>
              Wir kaufen Ackerland direkt. Das spart Ihnen die Maklerprovision (üblich: 3–5 % vom Kaufpreis), die Wartezeit für eine Vermarktung und die offene Aushängung. Sie bekommen eine ehrliche Wertindikation, einen klaren Zeitplan und einen Notartermin — fertig.
            </p>

            <h2>Bodenrichtwerte für Ackerland im Kreis Lippe</h2>
            <p>
              Zwei Zahlen, die oft verwechselt werden: Der <strong>Bodenrichtwert</strong> ist ein geglätteter Lagewert und liegt in Lippe je nach Gemarkung meist zwischen 1,40 €/m² und 4,50 €/m². Der <strong>tatsächlich gezahlte Kaufpreis</strong> liegt darüber — 2024 im Mittel bei 5,26 €/m² (rund 52.600 €/ha) über 75 Kauffälle. Wer nur den Bodenrichtwert kennt, verkauft tendenziell zu billig. Beide Werte sind öffentlich einsehbar: im <Link href="https://geoportal.kreislippe.de/geoportal/application/bodenrichtwerte" target="_blank" rel="noopener">Geoportal des Kreises</Link> und unter <Link href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</Link>.
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

            <h2>In welchen Gemeinden wir kaufen</h2>
            <p>
              Detmold, Lemgo, Bad Salzuflen, Horn-Bad Meinberg, Blomberg, Lage, Oerlinghausen, Schieder-Schwalenberg, Schlangen, Augustdorf, Barntrup, Dörentrup, Extertal, Kalletal, Leopoldshöhe und Lügde — dazu die angrenzenden Bereiche in den Kreisen Paderborn, Höxter, Herford und Gütersloh.
            </p>

            <h2>Genehmigungspflicht nach GrdstVG</h2>
            <p>
              Ab 1 ha greift in NRW das Grundstücksverkehrsgesetz. Der Kaufvertrag muss durch die Landwirtschaftskammer genehmigt werden, und das siedlungsrechtliche Vorkaufsrecht kann ausgeübt werden. Mehr dazu in unserem <Link href="/ratgeber/grundstuecksverkehrsgesetz">Ratgeber</Link>. Wir kennen den Ablauf und übernehmen die Koordination mit Notar und Behörde.
            </p>
          </article>
          <aside id="anfrage" className="order-2 lg:sticky lg:top-24 self-start">
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
