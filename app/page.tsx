import Image from "next/image";
import Link from "next/link";
import LeadForm from "@/components/LeadForm";
import ClickToReveal from "@/components/ClickToReveal";
import { site, services, flaechenTypen } from "@/lib/site";

const faq = [
  {
    q: "Wie schnell bekomme ich eine Preisindikation?",
    a: "Nach Eingang Ihrer Anfrage melden wir uns innerhalb von 24 Stunden mit einer ersten Wertindikation. Diese basiert auf den aktuellen Bodenrichtwerten des Gutachterausschusses Kreis Lippe sowie auf realen Vergleichsverkäufen, die wir aus der Region kennen.",
  },
  {
    q: "Fallen Maklergebühren oder Provisionen an?",
    a: "Nein. Wir kaufen direkt, ohne Maklerkette. Sie zahlen keine Provision, keine Bewertungsgebühr und keine versteckten Kosten. Die einzigen Kosten, die anfallen, sind die üblichen Notar- und Grundbuchkosten.",
  },
  {
    q: "Was ist, wenn die Fläche verpachtet ist?",
    a: "Wir kaufen Flächen auch mit laufendem Pachtvertrag. In den meisten Fällen übernehmen wir den Pachtvertrag mit. Ihr Pächter wird vor dem Verkauf transparent informiert. Vorkaufsrechte werden selbstverständlich beachtet.",
  },
  {
    q: "Mein Grundstück liegt in einer Erbengemeinschaft — geht das trotzdem?",
    a: "Ja, das ist sogar einer unserer Schwerpunkte. Wir haben Erfahrung mit Erbengemeinschaften, ungeklärten Grundbüchern und komplizierten Eigentumsverhältnissen. Wir helfen, gemeinsam mit Notar und Grundbuchamt eine saubere Lösung zu finden.",
  },
  {
    q: "Lohnt sich Vertragsnaturschutz oder Ökopunkte für meine Fläche?",
    a: "Häufig ja — gerade extensive Wiesen, schwer bewirtschaftbare Flächen oder Hangflächen erzielen mit VNS oder Ökopunkten oft deutlich höhere Erträge als die klassische Verpachtung. Wir prüfen das kostenlos für Ihre konkrete Fläche.",
  },
  {
    q: "Können Sie auch jemanden vermitteln, der die Fläche pflegt?",
    a: "Ja. Wir arbeiten mit verlässlichen Lohnunternehmern aus dem Kreis Lippe zusammen — von Mahd, Heuwerbung, Heckenpflege bis hin zu Forstarbeiten. Sagen Sie uns, was Sie brauchen, und wir bringen den passenden Betrieb ins Spiel.",
  },
  {
    q: "Gilt das Grundstücksverkehrsgesetz für meinen Verkauf?",
    a: "Bei landwirtschaftlichen Flächen ab 1 ha greift in NRW grundsätzlich das Grundstücksverkehrsgesetz (GrdstVG) inklusive Genehmigungspflicht und siedlungsrechtlichem Vorkaufsrecht. Wir kennen den Ablauf und kümmern uns mit Ihrem Notar darum, dass alles glatt läuft.",
  },
];

export default function Home() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((q) => ({
      "@type": "Question",
      name: q.q,
      acceptedAnswer: { "@type": "Answer", text: q.a },
    })),
  };

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[color:var(--color-ink)] text-white">
        <Image
          src="/hero.jpg"
          alt="Felder, Wiesen und Wald im Kreis Lippe — Teutoburger Wald in der Abenddämmerung"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(28,37,25,0.55) 0%, rgba(28,37,25,0.85) 100%), radial-gradient(60% 60% at 70% 20%, rgba(200,155,60,0.18), transparent 70%), radial-gradient(50% 50% at 10% 90%, rgba(47,93,58,0.45), transparent 70%)",
          }}
        />
        <div className="container-page relative px-5 pt-20 pb-24 md:pt-28 md:pb-32 grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
          <div>
            <span className="eyebrow text-[color:var(--color-accent)]">Kreis Lippe · Ostwestfalen</span>
            <h1 className="mt-3 text-4xl md:text-6xl leading-[1.05] font-serif">
              Ihre Fläche verdient<br />einen guten Nachfolger.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed">
              Wir kaufen, pachten und bewerten Ackerland, Wiesen und Wald im Kreis Lippe — fair, regional, persönlich. Ohne Makler, ohne Provision, ohne Druck.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/flaeche-bewerten" className="btn-on-dark">Kostenlose Wertindikation</Link>
              <ClickToReveal
                encoded={site.contact.phoneEncoded}
                type="tel"
                label="Telefon anzeigen"
                className="btn-secondary border-white/40 text-white hover:bg-white/10 cursor-pointer"
                revealedClassName="btn-secondary border-white/40 text-white hover:bg-white/10"
              />
            </div>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm text-white/70 max-w-xl">
              <div>
                <p className="font-serif text-2xl text-white">24 h</p>
                <p>Antwortzeit</p>
              </div>
              <div>
                <p className="font-serif text-2xl text-white">0 %</p>
                <p>Provision</p>
              </div>
              <div>
                <p className="font-serif text-2xl text-white">100 %</p>
                <p>Diskretion</p>
              </div>
              <div>
                <p className="font-serif text-2xl text-white">Lippe</p>
                <p>Lokal verwurzelt</p>
              </div>
            </div>
          </div>
          <div id="anfrage" className="lg:pl-6">
            <div className="rounded-2xl bg-white/95 text-[color:var(--color-ink)] p-2 shadow-2xl">
              <LeadForm
                source="hero"
                title="Was ist Ihre Fläche wert?"
                subtitle="Tragen Sie Ihre Daten ein — wir melden uns innerhalb von 24 Stunden mit einer ehrlichen Einschätzung."
              />
            </div>
          </div>
        </div>
      </section>

      {/* WAS WIR ANBIETEN */}
      <section className="section bg-grain">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="eyebrow">Was wir anbieten</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl md:text-4xl">Fünf Wege, mit Ihrer Fläche das Richtige zu tun.</h2>
            <p className="mt-4 text-[color:var(--color-ink-soft)] text-lg">
              Verkauf, Pacht, faire Bewertung, Naturschutz-Förderung oder einfach jemand, der mäht — wir sind Ihr Ansprechpartner für alles, was rund um Ihre Fläche im Kreis Lippe ansteht.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link key={s.slug} href={`/${s.slug}`} className="card group">
                <p className="eyebrow">{s.short}</p>
                <h3 className="mt-2 font-serif text-2xl">{s.title}</h3>
                <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">{s.description}</p>
                <p className="mt-5 text-sm font-medium text-[color:var(--color-brand)] group-hover:translate-x-0.5 transition-transform">
                  Mehr erfahren →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WERTE */}
      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-2 items-start">
          <div>
            <span className="eyebrow">Unser Versprechen</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl md:text-4xl">Boden ist mehr als Quadratmeter.</h2>
            <p className="mt-5 text-[color:var(--color-ink-soft)] text-lg leading-relaxed">
              Wir kommen selbst aus dem Kreis Lippe — aus Leopoldstal, Horn-Bad Meinberg. Wir kennen die Flurstücke entlang der Egge, die alten Eichen am Püngelsberg, die Wiesen am Triftenberge.
            </p>
            <p className="mt-4 text-[color:var(--color-ink-soft)] leading-relaxed">
              Flächen, die wir übernehmen, werden nicht zerstückelt, nicht spekulativ weitergereicht und nicht versiegelt. Wir bewirtschaften sie selbst, verpachten an verlässliche regionale Landwirte oder bringen sie in Vertragsnaturschutz und Ökopunkte ein. Was wir kaufen, bleibt im Lipper Land.
            </p>
            <ul className="mt-6 space-y-2 prose-lippe">
              <li><strong>Direkter Ankauf</strong> ohne Maklerkette und ohne Versteckspiel.</li>
              <li><strong>Faire Preise</strong> auf Basis aktueller Bodenrichtwerte des Gutachterausschusses Lippe.</li>
              <li><strong>Erbengemeinschaften & komplexe Eigentumslagen</strong> sind unser Spezialgebiet.</li>
              <li><strong>Diskretion</strong> ist Standard — kein Schaufenster, keine Aushängung, keine Anzeige.</li>
            </ul>
            <div className="mt-8">
              <Link href="/ueber-uns" className="btn-secondary">Über uns</Link>
            </div>
          </div>
          <div className="grid gap-4">
            {flaechenTypen.map((t) => (
              <Link key={t.slug} href={`/${t.slug}`} className="card group overflow-hidden p-0 flex flex-col">
                <div className="relative h-44 w-full overflow-hidden">
                  <Image
                    src={t.image}
                    alt={`${t.label} im Kreis Lippe`}
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <p className="eyebrow">Direktankauf</p>
                  <h3 className="font-serif text-2xl mt-1">{t.label}</h3>
                  <p className="text-sm text-[color:var(--color-ink-soft)] mt-1">{t.description}</p>
                  <p className="mt-3 text-sm font-medium text-[color:var(--color-brand)]">
                    {t.label.split(" ")[0]} verkaufen →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* BAULAND */}
      <section className="py-16 px-5 bg-[color:var(--color-accent-soft)]">
        <div className="container-page grid gap-8 md:grid-cols-[1fr_auto] items-center">
          <div>
            <span className="eyebrow">Auch außerhalb des Kerngebiets</span>
            <h2 className="mt-2 font-serif text-2xl md:text-3xl">Sie haben Bauland — oder potenzielles Bauland?</h2>
            <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed max-w-2xl">
              Bauland ist nicht unser Schwerpunkt — aber wir beraten und kaufen auch hier. Erschlossene Grundstücke, Hofstellen mit Bauerwartungsland, Innenbereichsflächen nach § 34 BauGB oder Außenbereichsflächen mit Aussicht auf Bebauungsplan: sprechen Sie uns an, wir verschaffen Ihnen einen Überblick.
            </p>
          </div>
          <Link href="/kontakt" className="btn-primary whitespace-nowrap self-start md:self-center">Bauland anfragen</Link>
        </div>
      </section>

      {/* PROZESS */}
      <section className="section bg-[color:var(--color-brand)] text-white">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="eyebrow text-[color:var(--color-accent)]">In 4 Schritten</span>
            <hr className="divider mt-3 bg-[color:var(--color-accent)]" />
            <h2 className="text-3xl md:text-4xl text-white">So einfach läuft es ab.</h2>
            <p className="mt-4 text-white/85 text-lg">
              Vom ersten Kontakt bis zur Auszahlung — ohne Bürokratie, ohne unklare Termine.
            </p>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4 text-white/90">
            {[
              { n: "01", t: "Anfrage", d: "Sie nennen uns Größe, Lage und Anliegen — telefonisch oder über das Formular." },
              { n: "02", t: "Indikation", d: "Innerhalb von 24 Stunden erhalten Sie eine erste, ehrliche Preisindikation." },
              { n: "03", t: "Vor-Ort-Termin", d: "Wir schauen uns die Fläche gemeinsam an — kostenlos und unverbindlich." },
              { n: "04", t: "Notar & Auszahlung", d: "Termin beim Notar Ihrer Wahl — Auszahlung erfolgt innerhalb weniger Wochen." },
            ].map((s) => (
              <li key={s.n} className="border-l-2 border-white/30 pl-5">
                <p className="font-serif text-3xl text-[color:var(--color-accent)]">{s.n}</p>
                <h3 className="mt-1 text-white text-xl">{s.t}</h3>
                <p className="mt-2 text-sm text-white/80 leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* REGION */}
      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr] items-start">
          <div>
            <span className="eyebrow">Einsatzgebiet</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl md:text-4xl">Schwerpunkt Kreis Lippe — auch im Umland aktiv.</h2>
            <p className="mt-4 text-[color:var(--color-ink-soft)] text-lg leading-relaxed">
              Wir kennen den Kreis Lippe wie unsere Westentasche und sind regelmäßig auch in den angrenzenden Kreisen unterwegs. Sprechen Sie uns an, auch wenn Ihre Fläche etwas weiter weg liegt.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card">
              <p className="eyebrow">Primärgebiet</p>
              <h3 className="mt-1 font-serif text-xl">{site.primaryArea.title}</h3>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)] leading-relaxed">
                {site.primaryArea.cities.join(" · ")}
              </p>
            </div>
            <div className="card">
              <p className="eyebrow">{site.extendedArea.title}</p>
              <h3 className="mt-1 font-serif text-xl">Umliegende Kreise</h3>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)] leading-relaxed">
                {site.extendedArea.counties.join(" · ")}
              </p>
              <p className="mt-3 text-xs text-[color:var(--color-muted)]">{site.extendedArea.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-grain">
        <div className="container-narrow">
          <span className="eyebrow">Häufige Fragen</span>
          <hr className="divider mt-3" />
          <h2 className="text-3xl md:text-4xl">Was Verkäufer am häufigsten wissen wollen.</h2>
          <div className="mt-10 space-y-4">
            {faq.map((q, i) => (
              <details key={i} className="card group">
                <summary className="cursor-pointer list-none flex justify-between items-center font-serif text-lg">
                  {q.q}
                  <span className="ml-4 text-[color:var(--color-brand)] group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">{q.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container-narrow text-center">
          <h2 className="text-3xl md:text-4xl">Bereit für ein erstes Gespräch?</h2>
          <p className="mt-4 text-[color:var(--color-ink-soft)] text-lg">
            Rufen Sie uns an oder schreiben Sie uns eine Nachricht — wir melden uns innerhalb von 24 Stunden.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/kontakt" className="btn-primary">Anfrage starten</Link>
            <ClickToReveal
              encoded={site.contact.phoneEncoded}
              type="tel"
              label="Telefon anzeigen"
              className="btn-secondary cursor-pointer"
              revealedClassName="btn-secondary"
            />
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}
