import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import ClickToReveal from "@/components/ClickToReveal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Telefon, WhatsApp oder Formular: Sprechen Sie uns an, wenn Sie Ackerland, Wiese oder Wald im Kreis Lippe verkaufen, verpachten oder bewerten lassen möchten.",
  alternates: { canonical: "/kontakt" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Kontakt"
        title="Sprechen Sie mit uns — direkt, persönlich, ohne Umwege."
        subtitle="Telefon, WhatsApp oder Formular — egal welchen Weg Sie wählen, wir antworten innerhalb von 24 Stunden. Erstgespräche sind immer kostenlos und unverbindlich."
      />

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="order-2 lg:order-1">
            <span className="eyebrow">Direkt erreichbar</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl font-serif">So erreichen Sie uns</h2>

            <div className="mt-6">
              <p className="text-sm text-[color:var(--color-muted)]">Telefon</p>
              <ClickToReveal
                encoded={site.contact.phoneEncoded}
                type="tel"
                label="Telefon anzeigen"
                className="font-serif text-2xl text-[color:var(--color-brand-dark)] hover:text-[color:var(--color-brand)] cursor-pointer"
                revealedClassName="font-serif text-2xl text-[color:var(--color-brand-dark)] hover:text-[color:var(--color-brand)]"
              />
            </div>

            <div className="mt-6">
              <p className="text-sm text-[color:var(--color-muted)]">WhatsApp</p>
              <a
                href={`https://wa.me/${site.contact.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener"
                className="text-base font-medium text-[color:var(--color-brand)] underline"
              >
                WhatsApp-Chat starten ({site.contact.phoneDisplay})
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
                <strong>Diskretionshinweis:</strong> Alle Anfragen werden vertraulich behandelt. Wir geben Ihre Daten nicht weiter, auch nicht an Pächter, Nachbarn oder andere Landwirte. Über das Ergebnis entscheiden ausschließlich Sie.
              </p>
            </div>

            <div className="mt-6 text-sm text-[color:var(--color-ink-soft)] leading-relaxed">
              <p className="font-semibold text-[color:var(--color-ink)] mb-2">Was passiert nach Ihrer Anfrage?</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Anfrage geht direkt an <span className="font-mono text-xs">{site.contact.email}</span> — kein Tool, kein Drittanbieter dazwischen.</li>
                <li>Wir bestätigen Eingang innerhalb weniger Stunden, in der Regel persönlich per Mail oder Anruf.</li>
                <li>Innerhalb von 24 Stunden bekommen Sie eine erste Wert- oder Beratungsindikation.</li>
                <li>Bei Interesse vereinbaren wir einen unverbindlichen Vor-Ort-Termin oder ein Telefonat.</li>
              </ol>
              <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                Datenfluss: Formular → verschlüsselt an unseren Server → Mail an {site.contact.email}. Backup in privatem Vercel Blob Storage. Keine Übermittlung an Marketing- oder CRM-Systeme.
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
