// Gemeinsame Metadaten-Bausteine für die öffentlichen Seiten.
//
// Warum es das gibt: Next.js führt Metadaten nur *flach* zusammen. Setzt eine
// Seite kein eigenes `openGraph`, erbt sie Titel und og:url der Startseite —
// Link-Vorschauen (WhatsApp, Facebook, LinkedIn) zeigen dann die Startseite.
// Setzt sie eines, fallen Vorschaubild, Sprache und Seitenname aus dem Layout
// weg. Deshalb baut jede Seite ihre Metadaten über `seitenMetadaten()`.
//
// Titel: Das Layout hängt „ | Lippe Forst“ an (14 Zeichen). Seitentitel daher
// höchstens ~46 Zeichen, damit das Suchergebnis nicht abgeschnitten wird.

import type { Metadata } from "next";
import { site } from "@/lib/site";

/** Vorschaubild aus app/opengraph-image.tsx (Text wie dort unter `alt`). */
export const OG_BILD = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Lippe Forst — Ackerland, Wiesen & Wald im Kreis Lippe verkaufen",
};

type SeitenMeta = {
  /** Seitentitel ohne Marke; das Layout ergänzt „| Lippe Forst“. */
  title: string;
  /** true = Titel genau so übernehmen (ohne Markenzusatz). */
  absolut?: boolean;
  description: string;
  /** Pfad der Seite, z. B. "/wald-verkaufen" — wird Canonical und og:url. */
  pfad: string;
  /** Abweichender Titel/Text nur für Link-Vorschauen. */
  ogTitle?: string;
  ogDescription?: string;
  robots?: Metadata["robots"];
};

export function seitenMetadaten(m: SeitenMeta): Metadata {
  const vollerTitel = m.absolut ? m.title : `${m.title} | ${site.name}`;
  const ogTitle = m.ogTitle ?? vollerTitel;
  const ogDescription = m.ogDescription ?? m.description;
  return {
    title: m.absolut ? { absolute: m.title } : m.title,
    description: m.description,
    alternates: { canonical: m.pfad },
    openGraph: {
      type: "website",
      locale: "de_DE",
      siteName: site.name,
      url: m.pfad,
      title: ogTitle,
      description: ogDescription,
      images: [OG_BILD],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [OG_BILD.url],
    },
    ...(m.robots ? { robots: m.robots } : {}),
  };
}

/**
 * Kürzt einen Text für <meta name="description"> auf höchstens ~160 Zeichen:
 * bevorzugt am Satzende, sonst an einem Komma/Gedankenstrich, sonst am Wortende.
 */
export function kurzBeschreibung(text: string, max = 158): string {
  if (text.length <= max) return text;
  const bereich = text.slice(0, max);
  const satz = bereich.lastIndexOf(". ");
  if (satz >= 90) return bereich.slice(0, satz + 1);
  const pause = Math.max(
    bereich.lastIndexOf(", "),
    bereich.lastIndexOf(" — "),
    bereich.lastIndexOf(" – ")
  );
  const ende = pause >= 100 ? pause : bereich.lastIndexOf(" ");
  return `${bereich.slice(0, ende > 0 ? ende : max).replace(/[\s,;:—–-]+$/, "")} …`;
}

type RatgeberMeta = {
  titel: string;
  beschreibung: string;
  pfad: string;
  /** ISO-Datum der Erstveröffentlichung */
  veroeffentlicht: string;
  /** ISO-Datum der letzten inhaltlichen Überarbeitung */
  aktualisiert: string;
};

/** JSON-LD für Ratgeber-Seiten: Article + BreadcrumbList. */
export function ratgeberSchema(r: RatgeberMeta) {
  const url = `${site.url}${r.pfad}`;
  const artikel = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: r.titel,
    description: r.beschreibung,
    inLanguage: "de-DE",
    datePublished: r.veroeffentlicht,
    dateModified: r.aktualisiert,
    image: `${site.url}${OG_BILD.url}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: site.name, url: site.url },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: { "@type": "ImageObject", url: `${site.url}/icon-512.png` },
    },
  };
  const brotkrumen = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Start", item: site.url },
      { "@type": "ListItem", position: 2, name: r.titel, item: url },
    ],
  };
  return [artikel, brotkrumen];
}
