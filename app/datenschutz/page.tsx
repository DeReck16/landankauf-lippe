import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Wie wir Ihre Daten bei einer Anfrage über Landankauf Lippe verarbeiten — DSGVO-konform.",
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
            {site.contact.phone && <>Telefon: {site.contact.phoneDisplay}<br /></>}
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
            Wir geben Ihre Daten nicht an Dritte weiter — auch nicht an Pächter, Nachbarn, andere Landwirte oder Behörden. Eine Übermittlung erfolgt nur dann, wenn dies für die Bearbeitung Ihres Anliegens unerlässlich ist (z. B. an Notar, Lohnunternehmer oder Behörde) und nur mit Ihrer ausdrücklichen Zustimmung.
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
            Diese Website verwendet keine Tracking-Cookies und keine Werbe-Cookies. Es werden ausschließlich technisch notwendige Cookies gesetzt (z. B. zur Speicherung Ihrer Einstellungen während eines Besuchs). Eine Einwilligung ist hierfür nach § 25 Abs. 2 TDDDG nicht erforderlich.
          </p>

          <h2>6. Ihre Rechte</h2>
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

          <h2>7. Aufsichtsbehörde</h2>
          <p>
            Zuständige Aufsichtsbehörde ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Postfach 20 04 44, 40102 Düsseldorf.
          </p>
        </div>
      </section>
    </>
  );
}
