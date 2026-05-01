import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
};

function CtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function PageHero({ eyebrow, title, subtitle, primaryCta, secondaryCta }: Props) {
  return (
    <section className="bg-[color:var(--color-ink)] text-white">
      <div className="container-page px-5 py-20 md:py-24">
        <span className="eyebrow text-[color:var(--color-accent)]">{eyebrow}</span>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl md:text-5xl leading-[1.1] text-white">{title}</h1>
        <p className="mt-5 max-w-2xl text-white/85 text-lg leading-relaxed">{subtitle}</p>
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryCta && (
              <CtaLink href={primaryCta.href} className="btn-on-dark">
                {primaryCta.label}
              </CtaLink>
            )}
            {secondaryCta && (
              <CtaLink href={secondaryCta.href} className="btn-secondary border-white/40 text-white hover:bg-white/10">
                {secondaryCta.label}
              </CtaLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
