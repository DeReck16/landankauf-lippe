import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ClickToReveal from "@/components/ClickToReveal";
import { site } from "@/lib/site";
import { seitenMetadaten } from "@/lib/seo";

export const metadata: Metadata = seitenMetadaten({
  title: "Datenschutzerklärung",
  description: "Wie wir Ihre Daten bei einer Anfrage, im Kundenbereich und bei Online-Verträgen über Lippe Forst verarbeiten — DSGVO-konform.",
  pfad: "/datenschutz",
  robots: { index: true, follow: false },
});

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
            Wir geben Ihre Daten nicht ohne Ihre Einwilligung an Dritte weiter — auch nicht an Pächter, Nachbarn, andere Landwirte oder Behörden (zur Weitergabe an ein Gegenüber nach der Freigabe siehe Abschnitt 4). Eine Übermittlung erfolgt nur dann, wenn dies für die Bearbeitung Ihres Anliegens unerlässlich ist (z. B. an Notar, Lohnunternehmer oder Behörde), und nur mit Ihrer ausdrücklichen Zustimmung. Bei Anfragen zur Energiepacht (Solar/Wind) geben wir Ihre Kontakt- und Flächendaten erst nach Ihrer ausdrücklichen Freigabe an ausgewählte Projektentwickler weiter, damit diese Ihnen Angebote unterbreiten können.
          </p>
          <p>
            Wenn Sie eine Fläche anbieten oder suchen, gleichen wir Ihre Angaben (Flächenart, Größe, Lage, Kauf oder Pacht) intern mit anderen Anfragen ab, um passende Gegenstücke zu finden. Der jeweils anderen Seite nennen wir dabei zunächst nur allgemeine Eckdaten ohne Namen, Kontaktdaten oder Flurstück (z. B. „ca. 5 ha Grünland im Raum Kalletal“). Ihre Kontaktdaten geben wir erst weiter, wenn Sie dem ausdrücklich zugestimmt haben (siehe Abschnitt 4). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
          <p>
            Zur Zustellung Ihrer Anfrage nutzen wir den E-Mail-Versanddienst Resend (Resend, Inc., USA). Mit Resend besteht ein Auftragsverarbeitungsvertrag. Zusätzlich speichern wir jede Anfrage in einem zugriffsgeschützten Speicher unseres Hosters Vercel mit Standort Frankfurt am Main, damit keine Anfrage verloren geht.
          </p>
          <p>
            Als Ausfallsicherung übermitteln wir Ihre Anfrage außerdem an den Formulardienst Formspree (Formspree, Inc., USA), der sie uns per E-Mail zustellt. Formspree verarbeitet die Daten als Auftragsverarbeiter auf Servern in den USA; die Übermittlung stützt sich auf die EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Rechtsgrundlage ist unser berechtigtes Interesse, keine Anfrage durch einen technischen Ausfall zu verlieren (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
          <p>
            <strong>Ortsbestimmung über OpenStreetMap:</strong> Um passende Flächen und Gesuche nach Entfernung abzugleichen, übermittelt unser Server die Ortsangabe aus Ihrer Anfrage (nur den Ortsnamen, z. B. „Kalletal-Westorf“ — ohne Namen, Kontaktdaten oder Flurstück) an den Geodienst Nominatim der OpenStreetMap Foundation (St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS, Vereinigtes Königreich) und speichert die gefundenen Koordinaten. Die Anfrage stellt unser Server; Ihre IP-Adresse wird dabei nicht übermittelt. Rechtsgrundlage ist unser berechtigtes Interesse an einem zutreffenden Abgleich (Art. 6 Abs. 1 lit. f DSGVO); für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der EU-Kommission.
          </p>
          <p>
            <strong>Kontakt über WhatsApp und Telefon:</strong> Unsere Seiten enthalten einen Link zu WhatsApp (WhatsApp Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland). Daten fließen erst, wenn Sie den Link anklicken — dann öffnet sich WhatsApp, und WhatsApp verarbeitet Ihre Telefonnummer, die Nachricht und Nutzungsdaten nach seinen eigenen Datenschutzbestimmungen; eine Übermittlung in die USA ist dabei möglich (Meta ist nach dem EU-US Data Privacy Framework zertifiziert). Schreiben Sie uns über WhatsApp oder rufen Sie uns an, nutzen wir Ihre Angaben zur Bearbeitung Ihres Anliegens (Art. 6 Abs. 1 lit. b DSGVO). Ein Klick auf den WhatsApp- oder Telefon-Link wird außerdem als Conversion an Google Ads gemeldet (siehe Abschnitt 7). Wenn Sie WhatsApp nicht nutzen möchten, erreichen Sie uns per E-Mail oder über das Formular.
          </p>

          <h2>4. Kundenbereich, Online-Verträge und Dokumente</h2>
          <p>
            Wenn wir Ihnen eine passende Fläche oder einen passenden Interessenten vorstellen möchten, laden wir Sie in unseren Kundenbereich unter lippeforst.de/kunde ein. Dort erfassen Sie Ihre Angaben (Name, Anschrift, Telefon, gegebenenfalls Betrieb, ob Sie als Verbraucher oder Unternehmer handeln, bei Anbietern die Flurstücke), lesen den Vertrag und unterschreiben ihn online. Wir verarbeiten diese Daten, um den Vertrag abzuschließen und durchzuführen (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
          <p>
            <strong>Online-Unterschrift und Protokoll:</strong> Bei einer Unterschrift speichern wir den eingegebenen Namen, Ihre E-Mail-Adresse, Datum und Uhrzeit, Ihre IP-Adresse, die Kennung Ihres Browsers (User-Agent), die von Ihnen bestätigten Erklärungen und eine Prüfsumme (SHA-256) des angezeigten Vertragstexts. Das Protokoll ist Teil des Vertrags-PDF, das Sie per E-Mail erhalten. Es dient dem Nachweis, wer wann welchen Text unterzeichnet hat (Art. 6 Abs. 1 lit. b und lit. f DSGVO; unser berechtigtes Interesse ist die Beweissicherung).
          </p>
          <p>
            <strong>Weitergabe nach der Freigabe:</strong> Name, Anschrift, Telefonnummer, E-Mail-Adresse und gegebenenfalls Betrieb — bei Anbietern zusätzlich die Flurstücksangaben — geben wir nur an Ihr konkretes Gegenüber weiter, nachdem Sie dem Kontakt zugestimmt und in die Weitergabe eingewilligt haben (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen; bereits erfolgte Weitergaben bleiben davon unberührt. Schließen Sie über unseren Kundenbereich einen Pachtvertrag, sehen beide Vertragsparteien den Vertrag mit den Angaben beider Seiten. Bei einem Flächenkauf übermitteln wir die Eckdaten mit Ihrem Einverständnis an den gewünschten Notar.
          </p>
          <p>
            <strong>Dokumentenablage:</strong> Unterschriebene Verträge, Unterschriftsprotokolle und von uns abgelegte Dokumente liegen in einem zugriffsgeschützten Speicher unseres Hosters Vercel in Frankfurt am Main. Abrufbar sind sie nur nach Anmeldung — im Kundenbereich nur Ihre eigenen Dokumente und die Dokumente eines freigegebenen Vorgangs, an dem Sie beteiligt sind.
          </p>
          <p>
            <strong>E-Mails:</strong> Vertragsbestätigungen (mit PDF), Anmeldelinks, Eingangsbestätigungen und Mitteilungen zu Ihrem Vorgang versenden wir über den E-Mail-Dienst Resend (siehe Abschnitt 3). Nach einem erfolgreichen Abschluss bitten wir Sie im Kundenbereich unverbindlich um eine Bewertung; per E-Mail bitten wir nur darum, wenn Sie dem bei der Unterschrift ausdrücklich zugestimmt haben (Art. 6 Abs. 1 lit. a DSGVO) — auch diese Einwilligung können Sie jederzeit widerrufen.
          </p>
          <p>
            <strong>Kein Tracking:</strong> Im Kundenbereich laufen weder Google Analytics noch die Conversion-Messung von Google Ads.
          </p>

          <h2>5. Speicherdauer</h2>
          <p>
            Wir speichern Ihre Anfrage so lange, wie es zur Bearbeitung erforderlich ist. Bei zustande gekommenen Geschäftsbeziehungen gelten die gesetzlichen Aufbewahrungsfristen (insb. § 257 HGB, § 147 AO). Anschließend werden Ihre Daten gelöscht oder anonymisiert.
          </p>
          <p>
            Verträge, Unterschriftsprotokolle und die zugehörige Korrespondenz bewahren wir als Handels- und Geschäftsbriefe sechs Jahre auf, soweit sie Grundlage einer Buchung sind (z. B. einer Provisionsrechnung) acht Jahre (§ 257 HGB, § 147 AO); die Frist beginnt mit dem Ende des Kalenderjahres. Soweit die Makler- und Bauträgerverordnung gilt, bewahren wir die danach vorgeschriebenen Aufzeichnungen fünf Jahre auf (§ 14 MaBV). Danach werden die Daten gelöscht.
          </p>

          <h2>6. Cookies</h2>
          <p>
            Neben technisch notwendigen Cookies setzt diese Website Cookies zur Reichweiten- und Conversion-Messung ein (siehe Abschnitt 7). Dazu gehört ein Erstanbieter-Cookie („tr_gclid“, Speicherdauer 90 Tage), das bei einem Klick auf eine Google-Anzeige die Klick-Kennung speichert, sowie die von Google gesetzten Mess-Cookies.
          </p>
          <p>
            Im Kundenbereich setzen wir nur ein technisch notwendiges Sitzungs-Cookie („lf_kunde“, gilt nur für lippeforst.de/kunde, Speicherdauer 14 Tage), damit Sie angemeldet bleiben (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b DSGVO). Analyse- oder Werbe-Cookies gibt es dort nicht.
          </p>

          <h2>7. Google Analytics und Google Ads Conversion-Messung</h2>
          <p>
            Diese Website nutzt Google Analytics 4 und das Conversion-Tracking von Google Ads (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland). Damit messen wir, wie Besucher die Website nutzen und ob Anzeigen zu Anfragen führen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Messung und Verbesserung unseres Angebots).
          </p>
          <p>
            Wenn Sie unser Anfrageformular absenden, übermitteln wir zur Zuordnung der Anfrage zu einer Anzeige zusätzlich Ihre E-Mail-Adresse, Telefonnummer und Ihren Namen in gehashter (nicht im Klartext lesbarer) Form an Google („Enhanced Conversions“). Google ist nach dem EU-US Data Privacy Framework zertifiziert. Sie können dieser Verarbeitung jederzeit widersprechen (Art. 21 DSGVO) — kontaktieren Sie uns dazu formlos.
          </p>

          <h2>8. Ihre Rechte</h2>
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

          <h2>9. Aufsichtsbehörde</h2>
          <p>
            Zuständige Aufsichtsbehörde ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Postfach 20 04 44, 40102 Düsseldorf.
          </p>
        </div>
      </section>
    </>
  );
}
