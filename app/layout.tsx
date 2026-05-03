import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { site } from "@/lib/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} – Ackerland, Wiesen & Wald im Kreis Lippe verkaufen`,
    template: `%s | ${site.name}`,
  },
  description: site.shortDescription,
  keywords: [
    "Ackerland verkaufen Lippe",
    "Wiese verkaufen Kreis Lippe",
    "Wald verkaufen NRW",
    "Grünland verkaufen Detmold",
    "Landwirtschaftliche Fläche verkaufen",
    "Fläche verpachten Lippe",
    "Bodenrichtwert Kreis Lippe",
    "Vertragsnaturschutz NRW",
    "Ökopunkte Ostwestfalen",
    "Lohnunternehmer Lippe Mahd",
  ],
  authors: [{ name: site.contact.company }],
  creator: site.contact.company,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: site.url,
    siteName: site.name,
    title: `${site.name} – Ackerland, Wiesen & Wald im Kreis Lippe verkaufen`,
    description: site.shortDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} – Fläche verkaufen, verpachten oder bewerten`,
    description: site.shortDescription,
  },
  robots: { index: true, follow: true },
  verification: {
    google: "8FwDnnfsaIHjbfoNkJFXY6jqqdz2AwZ0oOIlfEovp0Q",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ldOrg = {
    "@context": "https://schema.org",
    "@type": ["RealEstateAgent", "LocalBusiness"],
    "@id": `${site.url}#org`,
    name: site.name,
    legalName: site.contact.company,
    image: `${site.url}/opengraph-image`,
    logo: `${site.url}/icon`,
    url: site.url,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.contact.street,
      postalCode: site.contact.zip,
      addressLocality: site.contact.city,
      addressRegion: site.contact.state,
      addressCountry: "DE",
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: site.primaryArea.title },
      ...site.extendedArea.counties.map((n) => ({ "@type": "AdministrativeArea", name: n })),
    ],
    description: site.longDescription,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: `${site.url}/kontakt`,
      areaServed: "DE",
      availableLanguage: "de",
    },
    knowsLanguage: "de",
    knowsAbout: [
      "Direktankauf landwirtschaftlicher Flächen",
      "Ackerland Verkauf",
      "Grünland Verkauf",
      "Privatwald Verkauf",
      "Flächenverpachtung",
      "Vertragsnaturschutz NRW",
      "Ökopunkte Ausgleichsflächen",
      "Forstwirtschaftliche Beratung",
      "Erbengemeinschaften Grundstück",
      "Bauland Beratung Kreis Lippe",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Leistungen Lippe Forst",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Fläche verkaufen",
            description: "Direktankauf von Ackerland, Grünland und Wald im Kreis Lippe — ohne Maklerprovision.",
            url: `${site.url}/flaeche-verkaufen`,
            areaServed: { "@type": "AdministrativeArea", name: site.primaryArea.title },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Fläche verpachten",
            description: "Pachtübernahme oder Pächtervermittlung für landwirtschaftliche Flächen im Kreis Lippe.",
            url: `${site.url}/flaeche-verpachten`,
            areaServed: { "@type": "AdministrativeArea", name: site.primaryArea.title },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Fläche bewerten",
            description: "Kostenlose Wertindikation auf Basis von Bodenrichtwerten und Vergleichsverkäufen.",
            url: `${site.url}/flaeche-bewerten`,
            areaServed: { "@type": "AdministrativeArea", name: site.primaryArea.title },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "VNS und Ökopunkte Beratung",
            description: "Vertragsnaturschutz NRW, Ökokonto und Ausgleichsflächen — Antrag und Vermarktung.",
            url: `${site.url}/services/vns-oekopunkte`,
            areaServed: { "@type": "AdministrativeArea", name: site.primaryArea.title },
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Lohnunternehmer-Vermittlung",
            description: "Mahd, Heuwerbung, Heckenpflege, Forstarbeit — regionale Lohnunternehmer aus dem Kreis Lippe.",
            url: `${site.url}/services/lohnunternehmer`,
            areaServed: { "@type": "AdministrativeArea", name: site.primaryArea.title },
          },
        },
      ],
    },
  };

  return (
    <html
      lang="de"
      className={`${inter.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppFloat />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldOrg) }}
        />
      </body>
    </html>
  );
}
