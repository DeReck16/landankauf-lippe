import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Über uns — Landankauf Lippe aus dem Lipper Land",
  description:
    "Hinter Landankauf Lippe steht die TR Vertriebs GmbH aus Horn-Bad Meinberg. Lokal verwurzelt, persönlich erreichbar, mit eigenem Bezug zu Wald und Wiese im Kreis Lippe.",
  alternates: { canonical: "/ueber-uns" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Über uns"
        title="Aus dem Lipper Land — für das Lipper Land."
        subtitle="Wir kommen aus Horn-Bad Meinberg, kennen die Egge wie unsere Westentasche und bewirtschaften selbst Wald- und Wiesenflächen im Kreis Lippe. Wer hier Land verkauft, verpachtet oder bewerten lässt, hat es mit jemandem zu tun, der das Thema lebt."
        primaryCta={{ href: "/kontakt", label: "Kontakt aufnehmen" }}
      />

      <section className="section">
        <div className="container-narrow prose-lippe">
          <h2>Wer hinter Landankauf Lippe steht</h2>
          <p>
            Hinter Landankauf Lippe steht die <strong>{site.contact.company}</strong> mit Sitz in {site.contact.city}, geführt von {site.contact.contactPerson}. Wir sind kein bundesweit tätiger Makler, kein Investmentfonds und keine anonyme Plattform. Wir sind das Unternehmen aus dem Lipper Land, das Sie auch im Dorf treffen können.
          </p>

          <h2>Warum wir das machen</h2>
          <p>
            Wir bewirtschaften eigene Wald- und Wiesenflächen im Bereich Leopoldstal, Horn-Bad Meinberg, an der Egge und um den Püngelsberg. Wir kennen den Förster, den Jäger und den Lohnunternehmer, die hier arbeiten. Aus dieser Praxis ist das Geschäftsmodell entstanden: Wir kaufen, pachten und bewirtschaften Flächen — und beraten andere Eigentümer auf dem gleichen Weg.
          </p>

          <h2>Unsere Grundregeln</h2>
          <ul>
            <li><strong>Direkt</strong> — kein Maklerkette, kein Provisionsaufschlag, kein Inserat.</li>
            <li><strong>Diskret</strong> — was Sie uns sagen, bleibt zwischen uns.</li>
            <li><strong>Ehrlich</strong> — wir nennen Preise, die wir auch begründen können.</li>
            <li><strong>Nachhaltig</strong> — was wir kaufen, bleibt im Lipper Land. Keine Spekulation, keine Versiegelung.</li>
          </ul>

          <h2>Mit wem wir zusammenarbeiten</h2>
          <p>
            Für VNS- und Naturschutzberatung arbeiten wir mit der <Link href="https://www.biologischestationlippe.de" target="_blank" rel="noopener">Biologischen Station Lippe</Link>, der UNB Kreis Lippe und der Landwirtschaftskammer NRW (Kreisstelle Lippe-Höxter) zusammen. Für forstliche Themen mit Wald und Holz NRW. Für Lohnarbeiten mit etablierten Betrieben aus dem Kreis. Für rechtliche und notarielle Themen mit Notaren der Region.
          </p>

          <h2>Sie haben Fragen?</h2>
          <p>
            <Link href="/kontakt">Kontaktieren Sie uns gerne</Link> — telefonisch, per E-Mail oder über das Formular. Eine erste Einschätzung Ihrer Fläche bekommen Sie immer kostenlos.
          </p>
        </div>
      </section>
    </>
  );
}
