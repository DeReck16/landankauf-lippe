import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import { CITIES, FLAECHENTYPEN, cityTypeRoutes, getCity } from "@/lib/cities";
import { site } from "@/lib/site";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return cityTypeRoutes().map((r) => ({
    slug: `${r.type}-verkaufen-${r.city}`,
  }));
}

function parseSlug(slug: string) {
  // Format: <type>-verkaufen-<city>
  // Type ist immer ein einzelnes Wort, City kann mit Bindestrich sein.
  const m = slug.match(/^([a-z]+)-verkaufen-(.+)$/);
  if (!m) return null;
  const [, typeSlug, citySlug] = m;
  const type = FLAECHENTYPEN.find((t) => t.slug === typeSlug);
  const city = getCity(citySlug);
  if (!type || !city) return null;
  return { type, city };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const p = parseSlug(slug);
  if (!p) return {};
  const { type, city } = p;
  const title = `${type.label} verkaufen ${city.name} — Direktankauf ohne Provision`;
  const desc = `Sie wollen ${type.label} ${city.display} verkaufen? Wir kaufen direkt — fair, diskret, ohne Maklergebühr. Antwort innerhalb von 24 Stunden.`;
  return {
    title,
    description: desc,
    alternates: { canonical: `/${slug}` },
    openGraph: { title, description: desc },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const p = parseSlug(slug);
  if (!p) notFound();
  const { type, city } = p;

  const otherTypes = FLAECHENTYPEN.filter((t) => t.slug !== type.slug);
  const neighborCities = CITIES.filter((c) => c.slug !== city.slug).slice(0, 6);

  const defaultFlaechentyp =
    type.slug === "ackerland" ? "Ackerland" :
    type.slug === "wiese" ? "Wiese / Grünland" : "Wald / Forst";

  const ld = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: `${type.label} Direktankauf`,
    name: `${type.label} verkaufen ${city.name}`,
    description: `Direktankauf von ${type.pluralGenitiv} in der Stadt/Gemeinde ${city.name}, Kreis Lippe.`,
    provider: {
      "@type": "RealEstateAgent",
      name: site.name,
      url: site.url,
      address: {
        "@type": "PostalAddress",
        streetAddress: site.contact.street,
        postalCode: site.contact.zip,
        addressLocality: site.contact.city,
        addressRegion: site.contact.state,
        addressCountry: "DE",
      },
    },
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: { "@type": "AdministrativeArea", name: "Kreis Lippe" },
    },
  };

  return (
    <>
      <PageHero
        eyebrow={`${type.label} · ${city.name}`}
        title={`${type.label} verkaufen ${city.display} — fair, diskret, ohne Provision.`}
        subtitle={`${type.description} Wir kaufen ${type.pluralGenitiv} ${city.display} direkt — auf Basis aktueller Bodenrichtwerte und realer Vergleichsverkäufe.`}
        primaryCta={{ href: "#anfrage", label: "Kostenlose Indikation" }}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Warum {type.label} {city.display} verkaufen?</h2>
            <p>{city.description}</p>
            <ul>
              {city.characteristics.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>

            <h2>Was wir Ihnen bieten</h2>
            <ul>
              <li><strong>Direkter Ankauf</strong> ohne Maklerkette und ohne Provision</li>
              <li><strong>Faire Wertindikation</strong> in 24 h, basierend auf Grundstücksmarktbericht 2025 und realen Vergleichsverkäufen {city.display}</li>
              <li><strong>Diskretion</strong> — kein Inserat, keine Aushängung, keine Weitergabe Ihrer Daten</li>
              <li><strong>Erbengemeinschaften</strong> sind unser Spezialgebiet — wir koordinieren mit Notar, Grundbuchamt und allen Miteigentümern</li>
              <li><strong>Pachtverhältnisse</strong> übernehmen wir; Vorkaufsrechte beachten wir selbstverständlich</li>
            </ul>

            <h2>Marktdaten {city.name}</h2>
            <p>
              Bauland in mittlerer Lage liegt {city.display} laut Grundstücksmarktbericht 2025 bei rund <strong>{city.baulandMittlereLage} €/m²</strong>. Für landwirtschaftliche Flächen orientieren wir uns am Kreismittel: Ackerland ø ~5,26 €/m², Grünland ø ~1,89 €/m², Wald (mit Aufwuchs) ø ~1,34 €/m². Lokale Abweichungen je nach Bonität, Zuschnitt und Erschließung sind die Regel — wir bewerten Ihre Fläche konkret.
            </p>
            <p>
              <Link href="/ratgeber/bodenrichtwerte-lippe">Mehr Hintergrund: Bodenrichtwerte Kreis Lippe</Link>
            </p>

            <h2>Auch interessant für Eigentümer {city.display}</h2>
            <ul>
              <li><Link href="/services/vns-oekopunkte">Vertragsnaturschutz NRW &amp; Ökopunkte</Link> — Förderung statt Stilllegung</li>
              <li><Link href="/services/lohnunternehmer">Lohnunternehmer-Vermittlung</Link> für Mahd, Pflege, Forstarbeit</li>
              <li><Link href="/flaeche-verpachten">Verpachtung</Link> als Alternative zum Verkauf</li>
              <li><Link href="/flaeche-bewerten">Sofort-Wertindikation</Link> kostenlos und anonym</li>
            </ul>

            <h2>Andere Flächentypen {city.display}</h2>
            <ul>
              {otherTypes.map((t) => (
                <li key={t.slug}>
                  <Link href={`/${t.slug}-verkaufen-${city.slug}`}>{t.label} verkaufen {city.name}</Link>
                </li>
              ))}
            </ul>

            <h2>{type.label} verkaufen in der Umgebung von {city.name}</h2>
            <ul>
              {neighborCities.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${type.slug}-verkaufen-${c.slug}`}>{type.label} verkaufen {c.name}</Link>
                </li>
              ))}
            </ul>
          </article>

          <aside id="anfrage" className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source={slug}
              defaultIntent="Verkaufen"
              defaultFlaechentyp={defaultFlaechentyp as never}
              title={`${type.label}-Verkaufsanfrage`}
              subtitle={`Wir melden uns innerhalb von 24 Stunden mit einer ehrlichen Einschätzung Ihrer Fläche ${city.display}.`}
            />
          </aside>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
    </>
  );
}
