import Link from "next/link";
import { site } from "@/lib/site";

const nav = [
  { href: "/flaeche-verkaufen", label: "Verkaufen" },
  { href: "/flaeche-verpachten", label: "Verpachten" },
  { href: "/flaeche-bewerten", label: "Bewerten" },
  { href: "/services/vns-oekopunkte", label: "VNS & Ökopunkte" },
  { href: "/services/lohnunternehmer", label: "Lohnunternehmer" },
  { href: "/ueber-uns", label: "Über uns" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-[color:var(--color-bg)]/85 border-b border-[color:var(--color-line)]">
      <div className="container-page flex items-center justify-between h-16 px-5">
        <Link href="/" className="flex items-center gap-2">
          <span aria-hidden className="block w-7 h-7 rounded-full bg-[color:var(--color-brand)] relative">
            <span className="absolute inset-1.5 rounded-full bg-[color:var(--color-accent)]/90" />
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">
            Landankauf Lippe
          </span>
        </Link>
        <nav className="hidden lg:flex items-center gap-6 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-brand-dark)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {site.contact.phone && (
            <a
              href={`tel:${site.contact.phone.replace(/\s/g, "")}`}
              className="hidden md:inline text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-brand-dark)]"
            >
              {site.contact.phoneDisplay}
            </a>
          )}
          <Link href="/kontakt" className="btn-primary text-sm py-2 px-4">
            Anfrage
          </Link>
        </div>
      </div>
    </header>
  );
}
