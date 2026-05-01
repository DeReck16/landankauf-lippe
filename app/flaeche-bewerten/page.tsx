import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import QuickValuation from "@/components/QuickValuation";

export const metadata: Metadata = {
  title: "Fläche bewerten lassen — kostenlose Wertindikation für den Kreis Lippe",
  description:
    "Was ist meine Fläche wert? Erhalten Sie eine kostenlose, fundierte Wertindikation für Ackerland, Grünland oder Wald im Kreis Lippe — auf Basis der Bodenrichtwerte und realer Vergleichsverkäufe.",
  alternates: { canonical: "/flaeche-bewerten" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Wertindikation · Anonym &amp; sofort"
        title="Was ist meine Fläche wirklich wert?"
        subtitle="Sofortige anonyme Bandbreite über das Tool unten — und auf Wunsch eine ausführliche, schriftliche Wertindikation mit Bodenrichtwert, Vergleichsverkäufen und Förderpotenzial. Kostenlos, unverbindlich, diskret."
        primaryCta={{ href: "#sofort", label: "Sofort-Indikation (anonym)" }}
        secondaryCta={{ href: "#anfrage", label: "Schriftliche Bewertung anfragen" }}
      />

      <section id="sofort" className="section bg-grain">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="eyebrow">Sofort &amp; anonym · keine Daten an uns</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl md:text-4xl">In 30 Sekunden zur Bandbreite.</h2>
            <p className="mt-4 text-[color:var(--color-ink-soft)]">
              Eingaben werden ausschließlich in Ihrem Browser verarbeitet — wir sehen nichts. Datengrundlage: Grundstücksmarktbericht 2025 für den Kreis Lippe und tatsächlich gezahlte Kaufpreise 2024.
            </p>
          </div>
          <div className="mt-8 max-w-3xl">
            <QuickValuation />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <span className="eyebrow">Wie wir bewerten</span>
            <hr className="divider mt-3" />
            <h2>Drei Werte, die zusammen zählen.</h2>
            <h3>1. Bodenrichtwert</h3>
            <p>
              Der Gutachterausschuss für Grundstückswerte im Kreis Lippe veröffentlicht jährlich offizielle Bodenrichtwerte für landwirtschaftliche Flächen. Diese sind im Geoportal des Kreises kostenlos einsehbar (boris.nrw.de und geoportal.kreislippe.de) und bilden die <strong>Grundlage</strong> jeder seriösen Wertindikation. Mehr dazu in unserem <Link href="/ratgeber/bodenrichtwerte-lippe">Ratgeber zu Bodenrichtwerten Lippe</Link>.
            </p>
            <h3>2. Vergleichsverkäufe</h3>
            <p>
              Bodenrichtwerte sind Mittelwerte. Der echte Marktpreis ergibt sich aus dem, was vergleichbare Flächen in den letzten 12–24 Monaten in Ihrer Gemarkung tatsächlich erzielt haben. Wir kennen Verkäufe in Detmold, Lemgo, Bad Salzuflen, Horn-Bad Meinberg, Blomberg und im Übrigen Lipper Land.
            </p>
            <h3>3. Spezifische Eigenschaften</h3>
            <p>
              Größe, Zuschnitt, Hangneigung, Erschließung, Bodenpunkte, laufende Pachtverträge, eingetragene Lasten, Schutzgebietskulisse (FFH, NSG, Wasserschutz) — all das beeinflusst den Preis nach oben oder unten. Schwierige Flächen sind nicht automatisch wertlos: Eine Hangwiese am FFH-Gebiet kann über Vertragsnaturschutz oder Ökopunkte überraschend lukrativ sein.
            </p>

            <h2>Was Sie als Eigentümer von uns bekommen</h2>
            <ul>
              <li>Erste Wertindikation per Telefon oder E-Mail innerhalb von 24 Stunden</li>
              <li>Ausführliche schriftliche Einschätzung mit Begründung — auf Wunsch</li>
              <li>Hinweis auf Förderpotenziale wie VNS, Ökopunkte oder Photovoltaik-Pacht</li>
              <li>Kein Drängen auf Verkauf, keine versteckten Kosten</li>
            </ul>

            <h2>Wann lohnt sich eine Wertindikation?</h2>
            <ul>
              <li>Vor einem Verkauf — um nicht unter Wert zu verkaufen</li>
              <li>Im Rahmen einer Erbauseinandersetzung</li>
              <li>Vor Pachtverhandlungen (gerade bei Pachterneuerung)</li>
              <li>Zur Vermögensplanung oder Steuererklärung</li>
              <li>Wenn Sie einen Käufer haben und sicher sein wollen, dass das Angebot fair ist</li>
            </ul>
          </article>
          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="flaeche-bewerten"
              defaultIntent="Bewertung"
              title="Bewertungsanfrage"
              subtitle="Kostenlos und unverbindlich. Antwort innerhalb von 24 Stunden."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
