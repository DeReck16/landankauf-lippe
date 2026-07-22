import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import { site } from "@/lib/site";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import AdsConversions from "@/components/AdsConversions";
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
    default: `${site.name} – Ackerland, Wald & Wiesen im Kreis Lippe`,
    template: `%s | ${site.name}`,
  },
  description: site.shortDescription,
  authors: [{ name: site.contact.company }],
  creator: site.contact.company,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/feed.xml" },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: site.url,
    siteName: site.name,
    title: `${site.name} – Ackerland, Wald & Wiesen im Kreis Lippe`,
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

export const viewport: Viewport = {
  themeColor: "#1c2519",
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
      { "@type": "AdministrativeArea", name: "Kreis Lippe" },
      { "@type": "AdministrativeArea", name: "Ostwestfalen-Lippe" },
      ...site.extendedArea.counties.map((c) => ({
        "@type": "AdministrativeArea",
        name: c,
      })),
    ],
    description: site.longDescription,
    telephone: site.contact.phone,
    email: site.contact.email,
    vatID: site.legal.vatId,
    knowsAbout: [
      "Ankauf von Ackerland",
      "Ankauf von Wald- und Forstflächen",
      "Ankauf von Grünland und Wiesen",
      "Flächenbewertung nach Bodenrichtwert (BORIS NRW)",
      "Verpachtung landwirtschaftlicher Flächen",
      "Solarpark-Verpachtung und Freiflächen-Photovoltaik",
      "Windkraft-Flächen und Energiepacht",
      "Vertragsnaturschutz NRW und Ökopunkte",
      "Kalamitätsflächen und Käferholz",
      "Vermittlung von Lohnunternehmern",
      "Grundstücksverkehrsgesetz",
      "Kreis Lippe und Ostwestfalen-Lippe",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: site.contact.phone,
      url: `${site.url}/kontakt`,
      areaServed: "DE",
      availableLanguage: "de",
    },
    // Betreiber-Entität (Lippe Forst ist eine Marke der TR Vertriebs GmbH).
    // Bewusst als parentOrganization statt sameAs, damit die Firmen-Registry
    // (Elektronikhandel) NICHT den Forst-Brand fehl-etikettiert. Anker = North
    // Data (verifiziert, HRB 11734 + Bahnhofstr. 70b matchen exakt).
    parentOrganization: {
      "@type": "Organization",
      name: site.contact.company,
      url: "https://www.tr-vertrieb.de",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "HRB",
        value: `${site.legal.registerNumber} ${site.legal.registerCourt}`,
      },
      sameAs: [
        "https://www.northdata.com/TR+Vertriebs+GmbH,+Horn-Bad+Meinberg/Amtsgericht+Lemgo+HRB+11734",
        "https://implisense.com/en/companies/tr-vertriebs-gmbh-paderborn-DESB6SSSU996",
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
        <GoogleAnalytics gaId="G-0Y4K8M7RJS" />
        <Script id="google-ads-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('config', 'AW-18000118202');
          `}
        </Script>
        <AdsConversions
          whatsappLabel="enWZCPGV-7gcELqDkIdD"
          phoneLabel="V0goCPSV-7gcELqDkIdD"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldOrg) }}
        />
      </body>
    </html>
  );
}
