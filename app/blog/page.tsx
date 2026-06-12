import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { articlesSorted, CATEGORY_LABEL } from "@/lib/blog";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog — Aktuelles aus Lippe zu Flächen, Förderung & Markt",
  description:
    "Aktuelle Beiträge zu Bodenrichtwerten, Vertragsnaturschutz, Förderprogrammen und Praxistipps für Eigentümer landwirtschaftlicher Flächen im Kreis Lippe.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/feed.xml" } },
  openGraph: {
    title: "Blog Lippe Forst — Aktuelles zu Flächen, Förderung & Markt",
    description:
      "Praxis-Beiträge für Lipper Eigentümer rund um Verkauf, Pacht, Vertragsnaturschutz und Wald.",
  },
};

export default function BlogIndex() {
  const articles = articlesSorted();

  const ld = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog Lippe Forst",
    url: `${site.url}/blog`,
    description:
      "Aktuelle Beiträge zu Bodenrichtwerten, Vertragsnaturschutz und Förderung im Kreis Lippe.",
    blogPost: articles.map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      url: `${site.url}/blog/${a.slug}`,
      datePublished: a.publishedAt,
      author: { "@type": "Organization", name: site.name },
    })),
  };

  return (
    <>
      <PageHero
        eyebrow="Blog & Aktuelles"
        title="Was Lipper Flächeneigentümer 2026 wissen sollten."
        subtitle="Förderfristen, Marktentwicklungen, Praxisbeispiele aus dem Kreis Lippe — direkt aus unserer täglichen Arbeit, nicht aus dem Lehrbuch."
      />

      <section className="section">
        <div className="container-page">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="card group flex flex-col"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-dark)] text-[11px] font-semibold uppercase tracking-wider">
                    {CATEGORY_LABEL[a.category]}
                  </span>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {new Date(a.publishedAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <h2 className="font-serif text-xl leading-snug mb-2 group-hover:text-[color:var(--color-brand)] transition-colors">
                  {a.title}
                </h2>
                <p className="text-sm text-[color:var(--color-ink-soft)] leading-relaxed flex-1">
                  {a.description}
                </p>
                <p className="mt-4 text-sm font-medium text-[color:var(--color-brand)] flex items-center gap-2">
                  Weiterlesen
                  <span className="text-xs text-[color:var(--color-muted)]">
                    · {a.readingMinutes} Min Lesezeit
                  </span>
                </p>
              </Link>
            ))}
          </div>

          {articles.length < 3 && (
            <div className="mt-12 max-w-2xl text-sm text-[color:var(--color-ink-soft)] border-t border-[color:var(--color-line)] pt-6">
              Wir veröffentlichen regelmäßig neue Beiträge zu Förderprogrammen,
              Marktdaten aus dem Lipper Land und Praxisbeispielen. Wenn Sie ein
              Thema vermissen oder eine konkrete Frage haben:{" "}
              <Link href="/kontakt" className="text-[color:var(--color-brand)] underline">
                schreiben Sie uns
              </Link>
              .
            </div>
          )}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
    </>
  );
}
