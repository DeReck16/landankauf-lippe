import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ClickToReveal from "@/components/ClickToReveal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum und Anbieterkennzeichnung gemäß § 5 DDG der TR Vertriebs GmbH.",
  alternates: { canonical: "/impressum" },
  robots: { index: true, follow: false },
};

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Rechtliches" title="Impressum" subtitle="Anbieterkennzeichnung gemäß § 5 DDG (Digitale-Dienste-Gesetz)." />
      <section className="section">
        <div className="container-narrow prose-lippe">
          <h2>Anbieter</h2>
          <p>
            <strong>{site.contact.company}</strong><br />
            {site.contact.street}<br />
            {site.contact.zip} {site.contact.city}<br />
            {site.contact.country}
          </p>

          <h2>Kontakt</h2>
          <p>
            Telefon:{" "}
            <ClickToReveal
              encoded={site.contact.phoneEncoded}
              type="tel"
              label="Anzeigen"
              className="text-[color:var(--color-brand)] underline cursor-pointer"
              revealedClassName="text-[color:var(--color-brand)] underline"
            />
            <br />
            {site.contact.email
              ? <>E-Mail: <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></>
              : <>E-Mail: <a href={`mailto:${site.contact.emailFallback}`}>{site.contact.emailFallback}</a></>}
          </p>

          <h2>Vertretungsberechtigt</h2>
          <p>Geschäftsführer: {site.legal.managingDirector}</p>

          <h2>Registereintrag</h2>
          <p>
            Eingetragen im Handelsregister<br />
            Registergericht: {site.legal.registerCourt}<br />
            Registernummer: {site.legal.registerNumber}
          </p>

          {site.legal.vatId && (
            <>
              <h2>Umsatzsteuer-ID</h2>
              <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: {site.legal.vatId}</p>
            </>
          )}

          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>
            {site.legal.managingDirector}<br />
            Anschrift wie oben
          </p>

          <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>

          <h2>Online-Streitbeilegung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:&nbsp;
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr</a>.
          </p>

          <h2>Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>

          <h2>Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>

          <h2>Urheberrecht</h2>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </div>
      </section>
    </>
  );
}
