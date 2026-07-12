import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ClickToReveal from "@/components/ClickToReveal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Wie wir Ihre Daten bei einer Anfrage über Lippe Forst verarbeiten — DSGVO-konform.",
  alternates: { canonical: "/datenschutz" },
  robots: { index: true, follow: false },
};

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Rechtliches" title="Datenschutzerklärung" subtitle="Wie wir mit Ihren Daten umgehen — verständlich erklärt und DSGVO-konform." />
      <section className="section">
        <div className="container-narrow prose-lippe">
          <h2>1. Verantwortlicher</h2>
          <p>
            Verantwortlicher im Sinne der DSGVO ist:<br />
            {site.contact.company}<br />
            {site.contact.street}, {site.contact.zip} {site.contact.city}<br />
            {site.contact.phoneEncoded && (
              <>
                Telefon: <ClickToReveal
                  encoded={site.contact.phoneEncoded}
                  type="tel"
                  label="Anzeigen"
                  className="text-[color:var(--color-brand)] underline cursor-pointer"
                  revealedClassName="text-[color:var(--color-brand)] underline"
                /><br />
              </>
            )}
            E-Mail: {site.contact.email || site.contact.emailFallback}
          </p>

          <h2>2. Hosting</h2>
          <p>
            Diese Website wird bei der Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) gehostet. Beim Aufruf der Website werden technische Daten (IP-Adresse, Datum/Uhrzeit, User-Agent) verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb der Website). Vercel ist nach EU-US Data Privacy Framework zertifiziert.
          </p>

          <h2>3. Kontaktformular und Anfragen</h2>
          <p>
            Wenn Sie uns über das Formular oder per E-Mail kontaktieren, verarbeiten wir die von Ihnen angegebenen Daten (Name, E-Mail, Telefon, Angaben zu Ihrer Fläche und Ihre Nachricht) ausschließlich zur Bearbeitung Ihrer Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          </p>
          <p>
            Wir geben Ihre Daten nicht an Dritte weiter — auch nicht an Pächter, Nachbarn, andere Landwirte oder Behörden. Eine Übermittlung erfolgt nur dann, wenn dies für die Bearbeitung Ihres Anliegens unerlässlich ist (z. B. an Notar, Lohnunternehmer oder Behörde), und nur mit Ihrer ausdrücklichen Zustimmung. Bei Anfragen zur Energiepacht (Solar/Wind) geben wir Ihre Kontakt- und Flächendaten erst nach Ihrer ausdrücklichen Freigabe an ausgewählte Projektentwickler weiter, damit diese Ihnen Angebote unterbreiten können.
          </p>
          <p>
            Zur Zustellung Ihrer Anfrage nutzen wir den E-Mail-Versanddienst Resend (Resend, Inc., USA). Mit Resend besteht ein Auftragsverarbeitungsvertrag.
          </p>

          <h2>4. Speicherdauer</h2>
          <p>
            Wir speichern Ihre Anfrage so lange, wie es zur Bearbeitung erforderlich ist. Bei zustande gekommenen Geschäftsbeziehungen gelten die gesetzlichen Aufbewahrungsfristen (insb. § 257 HGB, § 147 AO). Anschließend werden Ihre Daten gelöscht oder anonymisiert.
          </p>

          <h2>5. Cookies</h2>
          <p>
            Neben technisch notwendigen Cookies setzt diese Website Cookies zur Reichweiten- und Conversion-Messung ein (siehe Abschnitt 6). Dazu gehört ein Erstanbieter-Cookie („tr_gclid", Speicherdauer 90 Tage), das bei einem Klick auf eine Google-Anzeige die Klick-Kennung speichert, sowie die von Google gesetzten Mess-Cookies.
          </p>

          <h2>6. Google Analytics und Google Ads Conversion-Messung</h2>
          <p>
            Diese Website nutzt Google Analytics 4 und das Conversion-Tracking von Google Ads (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland). Damit messen wir, wie Besucher die Website nutzen und ob Anzeigen zu Anfragen führen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Messung und Verbesserung unseres Angebots).
          </p>
          <p>
            Wenn Sie unser Anfrageformular absenden, übermitteln wir zur Zuordnung der Anfrage zu einer Anzeige zusätzlich Ihre E-Mail-Adresse, Telefonnummer und Ihren Namen in gehashter (nicht im Klartext lesbarer) Form an Google („Enhanced Conversions"). Google ist nach dem EU-US Data Privacy Framework zertifiziert. Sie können dieser Verarbeitung jederzeit widersprechen (Art. 21 DSGVO) — kontaktieren Sie uns dazu formlos.
          </p>

          <h2>7. Ihre Rechte</h2>
          <p>Sie haben das Recht:</p>
          <ul>
            <li>auf Auskunft über Ihre verarbeiteten Daten (Art. 15 DSGVO)</li>
            <li>auf Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>auf Löschung Ihrer Daten (Art. 17 DSGVO)</li>
            <li>auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            <li>eine erteilte Einwilligung jederzeit zu widerrufen (Art. 7 Abs. 3 DSGVO)</li>
            <li>auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
          </ul>

          <h2>8. Aufsichtsbehörde</h2>
          <p>
            Zuständige Aufsichtsbehörde ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Postfach 20 04 44, 40102 Düsseldorf.
          </p>
        </div>
      </section>
    </>
  );
}
