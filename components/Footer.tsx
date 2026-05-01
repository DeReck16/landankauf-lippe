import Link from "next/link";
import { site, services } from "@/lib/site";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[color:var(--color-ink)] text-[#dcdfd8] mt-24">
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
          {(site.contact.phone || site.contact.email) && (
            <p className="mt-2 text-sm text-white/60">
              {site.contact.phone && (
                <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="hover:text-white">
                  {site.contact.phoneDisplay}
                </a>
              )}
              {site.contact.phone && site.contact.email && " · "}
              {site.contact.email && (
                <a href={`mailto:${site.contact.email}`} className="hover:text-white">
                  {site.contact.email}
                </a>
              )}
            </p>
          )}
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
          <h4 className="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Region</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link href="/ackerland-verkaufen" className="hover:text-white">Ackerland verkaufen Lippe</Link></li>
            <li><Link href="/wiese-verkaufen" className="hover:text-white">Wiese verkaufen Lippe</Link></li>
            <li><Link href="/wald-verkaufen" className="hover:text-white">Wald verkaufen Lippe</Link></li>
            <li><Link href="/ratgeber/bodenrichtwerte-lippe" className="hover:text-white">Bodenrichtwerte Lippe</Link></li>
            <li><Link href="/ratgeber/grundstuecksverkehrsgesetz" className="hover:text-white">Grundstücksverkehrsgesetz</Link></li>
            <li><Link href="/kontakt" className="hover:text-white">Kontakt</Link></li>
          </ul>
        </div>
      </div>
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
