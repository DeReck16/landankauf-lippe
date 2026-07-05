import Link from "next/link";
import ClickToReveal from "@/components/ClickToReveal";
import { site } from "@/lib/site";

const nav = [
  { href: "/flaeche-verkaufen", label: "Verkaufen" },
  { href: "/flaeche-verpachten", label: "Verpachten" },
  { href: "/flaeche-bewerten", label: "Bewerten" },
  { href: "/services/vns-oekopunkte", label: "VNS & Ökopunkte" },
  { href: "/services/lohnunternehmer", label: "Lohnunternehmer" },
  { href: "/blog", label: "Blog" },
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
            Lippe Forst
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
          <ClickToReveal
            encoded={site.contact.phoneEncoded}
            type="tel"
            label="Telefon anzeigen"
            className="hidden md:inline-flex items-center text-sm text-[color:var(--color-brand-dark)] hover:text-[color:var(--color-brand)] font-medium cursor-pointer"
            revealedClassName="hidden md:inline-flex items-center text-sm text-[color:var(--color-brand-dark)] hover:text-[color:var(--color-brand)] font-medium"
          />
          <Link
            href="/kontakt#formular"
            className="btn-primary text-sm h-10 px-5"
            aria-label="Anfrage senden"
          >
            Anfrage
          </Link>
        </div>
      </div>
    </header>
  );
}
