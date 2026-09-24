import Link from "next/link";
import MobileNav from "@/components/MobileNav";

const nav = [
  { href: "/flaechenboerse", label: "Flächenbörse" },
  { href: "/flaeche-verkaufen", label: "Verkaufen" },
  { href: "/flaeche-verpachten", label: "Verpachten" },
  { href: "/solarpark-verpachten", label: "Solar & Wind" },
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
        <nav className="hidden xl:flex items-center gap-5 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-brand-dark)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/kontakt#formular"
            className="btn-primary text-sm h-10 px-5"
            aria-label="Anfrage senden"
          >
            Anfrage
          </Link>
          <MobileNav items={nav} />
        </div>
      </div>
    </header>
  );
}
