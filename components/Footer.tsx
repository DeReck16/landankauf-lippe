import Link from "next/link";
import SisterSites from "@/components/SisterSites";
import { site, services } from "@/lib/site";
import { CITIES, FLAECHENTYPEN } from "@/lib/cities";

export default function Footer() {
  const year = new Date().getFullYear();

  // Top-Cities für SEO-Footer (volle Liste auf der Sitemap)
  const featuredCities = [
    "detmold",
    "lemgo",
    "bad-salzuflen",
    "horn-bad-meinberg",
    "blomberg",
    "lage",
    "oerlinghausen",
    "schieder-schwalenberg",
  ];

  return (
    <footer className="bg-[color:var(--color-ink)] text-[#dcdfd8] mt-24">
      {/* Keyword-Cluster Sektion: Wir helfen Eigentümern in ... */}
      <div className="border-b border-white/10">
        <div className="container-page px-5 py-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent)] mb-5">
            Lokal aktiv im Kreis Lippe
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {FLAECHENTYPEN.map((t) => (
              <div key={t.slug}>
                <h4 className="font-serif text-lg text-white mb-3">{t.label} verkaufen</h4>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-white/65">
                  {featuredCities.map((cs) => {
                    const c = CITIES.find((x) => x.slug === cs);
                    if (!c) return null;
                    return (
                      <li key={cs}>
                        <Link
                          href={`/${t.slug}-verkaufen-${c.slug}`}
                          className="hover:text-white"
                        >
                          {t.label} {c.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/45">
            Weitere Gemeinden im Kreis Lippe:{" "}
            {CITIES.filter((c) => !featuredCities.includes(c.slug))
              .map((c) => c.name)
              .join(", ")}
            . Sprechen Sie uns an, wir kaufen auch dort.
          </p>
        </div>
      </div>

      <div className="container-page px-5 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span aria-hidden className="block w-7 h-7 rounded-full bg-[color:var(--color-brand)] relative">
              <span className="absolute inset-1.5 rounded-full bg-[color:var(--color-accent)]/90" />
            </span>
            <span className="font-serif text-lg font-semibold text-white">{site.name}</span>
          </div>
          <p className="text-sm leading-relaxed text-white/70 max-w-md">
            {site.longDescription}
          </p>
          <p className="mt-6 text-sm text-white/60">
            {site.contact.company}<br />
            {site.contact.street}, {site.contact.zip} {site.contact.city}
          </p>
          <p className="mt-2 text-sm text-white/60 flex flex-wrap gap-x-3 gap-y-1 items-center">
            <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="hover:text-white">
              {site.contact.phoneDisplay}
            </a>
            <span className="opacity-50">·</span>
            <a
              href={`https://wa.me/${site.contact.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener"
              className="hover:text-white"
            >
              WhatsApp
            </a>
            {site.contact.email && (
              <>
                <span className="opacity-50">·</span>
                <a href={`mailto:${site.contact.email}`} className="hover:text-white">
                  {site.contact.email}
                </a>
              </>
            )}
          </p>
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Leistungen</h4>
          <ul className="space-y-2 text-sm text-white/70">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/${s.slug}`} className="hover:text-white">{s.title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Mehr</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link href="/flaeche-bewerten" className="hover:text-white">Sofort-Wertindikation</Link></li>
            <li><Link href="/blog" className="hover:text-white">Blog &amp; Aktuelles</Link></li>
            <li><Link href="/ratgeber/bodenrichtwerte-lippe" className="hover:text-white">Bodenrichtwerte Lippe</Link></li>
            <li><Link href="/ratgeber/grundstuecksverkehrsgesetz" className="hover:text-white">Grundstücksverkehrsgesetz</Link></li>
            <li><Link href="/ueber-uns" className="hover:text-white">Über uns</Link></li>
            <li><Link href="/kontakt" className="hover:text-white">Kontakt</Link></li>
          </ul>
        </div>
      </div>
      <SisterSites currentDomain="lippeforst.de" />

      <div className="border-t border-white/10">
        <div className="container-page px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {year} {site.contact.company}. Alle Rechte vorbehalten.</p>
          <div className="flex gap-5">
            <Link href="/impressum" className="hover:text-white">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
