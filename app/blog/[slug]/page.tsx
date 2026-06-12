import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import {
  ARTICLES,
  articlesSorted,
  CATEGORY_LABEL,
  getArticle,
} from "@/lib/blog";
import { site } from "@/lib/site";

type Params = { slug: string };

export const dynamicParams = false;

// Fallback-Hero pro Kategorie für Artikel ohne eigenes heroImage (OG/Schema).
const CATEGORY_HERO: Record<string, string> = {
  Wald: "/wald.jpg",
  Markt: "/acker.jpg",
  VNS: "/wiese.jpg",
  Recht: "/hero.jpg",
  Praxis: "/acker.jpg",
  Förderung: "/wiese.jpg",
};

function heroFor(a: { heroImage?: string; category: string }): string {
  return a.heroImage ?? CATEGORY_HERO[a.category] ?? "/hero.jpg";
}

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  const hero = heroFor(a);
  return {
    title: a.title,
    description: a.description,
    alternates: {
      canonical: `/blog/${a.slug}`,
      types: { "application/rss+xml": "/feed.xml" },
    },
    openGraph: {
      type: "article",
      title: a.title,
      description: a.description,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt ?? a.publishedAt,
      authors: [site.name],
      tags: a.keywords,
      images: [{ url: hero, width: 1600, height: 1066, alt: a.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description: a.description,
      images: [hero],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();

  const related = articlesSorted()
    .filter((x) => x.slug !== a.slug)
    .slice(0, 3);

  const formattedDate = new Date(a.publishedAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt ?? a.publishedAt,
    inLanguage: "de-DE",
    keywords: a.keywords.join(", "),
    articleSection: CATEGORY_LABEL[a.category],
    wordCount: a.content.split(/\s+/).length,
    image: `${site.url}${heroFor(a)}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${site.url}/blog/${a.slug}` },
    author: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: { "@type": "ImageObject", url: `${site.url}/icon` },
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Start", item: site.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
      { "@type": "ListItem", position: 3, name: a.title, item: `${site.url}/blog/${a.slug}` },
    ],
  };

  const faqLd = a.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: a.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <>
      <PageHero
        eyebrow={`${CATEGORY_LABEL[a.category]} · ${formattedDate} · ${a.readingMinutes} Min`}
        title={a.title}
        subtitle={a.description}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <div
              dangerouslySetInnerHTML={{ __html: a.content }}
            />

            {a.faq && a.faq.length > 0 && (
              <div className="mt-12">
                <h2>Häufige Fragen</h2>
                {a.faq.map((f) => (
                  <details
                    key={f.q}
                    className="group border-b border-[color:var(--color-line)] py-3"
                  >
                    <summary className="cursor-pointer font-medium list-none flex items-start justify-between gap-4">
                      {f.q}
                      <span aria-hidden className="text-[color:var(--color-muted)] transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-[color:var(--color-ink-soft)]">{f.a}</p>
                  </details>
                ))}
              </div>
            )}

            <div className="mt-12 border-t border-[color:var(--color-line)] pt-6">
              <p className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
                Stand: {formattedDate}
              </p>
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                Geschrieben von der Redaktion {site.name} ({site.contact.company}).
                Bei Rückfragen gern direkt an{" "}
                <Link href="/kontakt" className="text-[color:var(--color-brand)] underline">
                  uns wenden
                </Link>
                .
              </p>
            </div>

            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="font-serif text-2xl mb-4">Mehr aus dem Blog</h2>
                <ul className="space-y-3">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/blog/${r.slug}`}
                        className="text-[color:var(--color-brand)] hover:underline"
                      >
                        {r.title}
                      </Link>
                      <p className="text-xs text-[color:var(--color-muted)] mt-0.5">
                        {CATEGORY_LABEL[r.category]} ·{" "}
                        {new Date(r.publishedAt).toLocaleDateString("de-DE")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <aside className="lg:sticky lg:top-24 self-start space-y-6">
            <LeadForm
              source={`blog-${a.slug}`}
              defaultIntent={
                a.category === "VNS" ? "VNS / Ökopunkte" : "Bewertung"
              }
              title="Direkt anfragen"
              subtitle="Wir antworten innerhalb von 24 Stunden persönlich."
            />
          </aside>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
    </>
  );
}
