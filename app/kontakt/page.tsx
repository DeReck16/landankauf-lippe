import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { site, whatsappLink } from "@/lib/site";
import { seitenMetadaten } from "@/lib/seo";

export const metadata: Metadata = seitenMetadaten({
  title: "Kontakt",
  description:
    "E-Mail, WhatsApp oder Formular: Schreiben Sie uns, wenn Sie Ackerland, Wiese oder Wald im Kreis Lippe verkaufen, verpachten oder bewerten lassen möchten.",
  pfad: "/kontakt",
});

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Kontakt"
        title="Sprechen Sie mit uns — direkt, persönlich, ohne Umwege."
        subtitle="E-Mail, WhatsApp oder Formular — egal welchen Weg Sie wählen, wir antworten innerhalb von 24 Stunden. Erstgespräche sind immer kostenlos und unverbindlich."
      />

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="order-2 lg:order-1">
            <span className="eyebrow">Direkt erreichbar</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl font-serif">So erreichen Sie uns</h2>

            <div className="mt-6">
              <p className="text-sm text-[color:var(--color-muted)]">WhatsApp</p>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener nofollow"
                title="Öffnet einen WhatsApp-Chat mit Lippe Forst"
                className="text-base font-medium text-[color:var(--color-brand)] underline"
              >
                WhatsApp-Chat starten
              </a>
            </div>

            {site.contact.email && (
              <div className="mt-6">
                <p className="text-sm text-[color:var(--color-muted)]">E-Mail</p>
                <a
                  href={`mailto:${site.contact.email}`}
                  className="text-base font-medium text-[color:var(--color-brand-dark)] hover:text-[color:var(--color-brand)]"
                >
                  {site.contact.email}
                </a>
              </div>
            )}

            <div className="mt-6">
              <p className="text-sm text-[color:var(--color-muted)]">Anschrift</p>
              <p className="text-[color:var(--color-ink)]">
                {site.contact.company}<br />
                {site.contact.street}<br />
                {site.contact.zip} {site.contact.city}<br />
                {site.contact.country}
              </p>
            </div>

            <div className="mt-6">
              <p className="text-sm text-[color:var(--color-muted)]">Erreichbarkeit</p>
              <p className="text-[color:var(--color-ink-soft)]">{site.hours}</p>
            </div>

            <div className="mt-6 card bg-[color:var(--color-brand-soft)]">
              <p className="text-sm text-[color:var(--color-ink)] leading-relaxed">
                <strong>Diskretionshinweis:</strong> Alle Anfragen werden vertraulich behandelt. Ohne Ihre ausdrückliche Zustimmung geben wir Ihre Daten nicht weiter — auch nicht an Pächter, Nachbarn oder andere Landwirte. Über das Ergebnis entscheiden ausschließlich Sie.
              </p>
            </div>

            <div className="mt-6 text-sm text-[color:var(--color-ink-soft)] leading-relaxed">
              <p className="font-semibold text-[color:var(--color-ink)] mb-2">Was passiert nach Ihrer Anfrage?</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Ihre Anfrage geht per E-Mail an <span className="font-mono text-xs">{site.contact.email}</span> und wird zusätzlich in unserem geschützten Speicher gesichert.</li>
                <li>Wir bestätigen Eingang innerhalb weniger Stunden, in der Regel persönlich per E-Mail.</li>
                <li>Innerhalb von 24 Stunden bekommen Sie eine erste Wert- oder Beratungsindikation.</li>
                <li>Bei Interesse vereinbaren wir einen unverbindlichen Vor-Ort-Termin oder ein Telefonat.</li>
              </ol>
              <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                Datenfluss: Formular → verschlüsselt an unseren Server (Hosting: Vercel) → E-Mail an {site.contact.email} über den Versanddienst Resend, als Ausfallsicherung zusätzlich über Formspree; Sicherung im privaten Vercel-Speicher in Frankfurt. Zur Erfolgsmessung übermitteln wir gehashte Kontaktdaten an Google (Enhanced Conversions). Einzelheiten in der <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>.
              </p>
            </div>
          </div>
          <div id="formular" className="order-1 lg:order-2 scroll-mt-24">
            <LeadForm source="kontakt" defaultIntent="Allgemein" title="Schreiben Sie uns" subtitle="Wir melden uns innerhalb von 24 Stunden persönlich." />
          </div>
        </div>
      </section>
    </>
  );
}
