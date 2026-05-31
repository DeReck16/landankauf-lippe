import Link from "next/link";

/**
 * Cross-Domain Sister-Sites Block für TR-Verbund Footer.
 * Identisch in tr-immobilien.com, gewerbe-immobilien-lippe.de, lippeforst.de.
 * SEO: Topic-Cluster-Authority via kontextuelle Backlinks (rel="noopener", kein nofollow).
 */
const SITES = [
  {
    domain: "tr-immobilien.com",
    url: "https://www.tr-immobilien.com",
    name: "TR Immobilien GmbH",
    tagline: "Wohnimmobilien-Direktankauf Kreis Lippe — Haus, Wohnung, Mixed-Use.",
  },
  {
    domain: "gewerbe-immobilien-lippe.de",
    url: "https://gewerbe-immobilien-lippe.de",
    name: "Gewerbe Immobilien Lippe",
    tagline: "Gewerbehallen, Büros, Gewerbegrundstücke — Kreis Lippe & OWL.",
  },
  {
    domain: "lippeforst.de",
    url: "https://lippeforst.de",
    name: "Lippe Forst",
    tagline: "Wald, Acker, Forstdienstleistungen, VNS-Ökopunkte — Lipper Land.",
  },
];

export default function SisterSites({ currentDomain }: { currentDomain: string }) {
  const others = SITES.filter((s) => s.domain !== currentDomain);
  if (others.length === 0) return null;

  return (
    <div className="border-t border-white/10">
      <div className="container-page px-5 py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent,#a4d65e)] mb-5">
          Mehr aus dem TR-Verbund
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {others.map((s) => (
            <Link
              key={s.domain}
              href={s.url}
              rel="noopener"
              className="block group rounded-lg border border-white/10 hover:border-white/30 transition-colors p-4"
            >
              <p className="font-serif text-lg text-white group-hover:text-[color:var(--color-accent,#a4d65e)] transition-colors">
                {s.name}
              </p>
              <p className="mt-1 text-sm text-white/65">{s.tagline}</p>
              <p className="mt-2 text-xs text-white/40">{s.domain} →</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
