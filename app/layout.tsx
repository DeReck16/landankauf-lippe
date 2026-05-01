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
    images: [{ url: "/hero.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} – Fläche verkaufen, verpachten oder bewerten`,
    description: site.shortDescription,
    images: ["/hero.jpg"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
  verification: {
    google: "8FwDnnfsaIHjbfoNkJFXY6jqqdz2AwZ0oOIlfEovp0Q",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ldOrg = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name,
    image: `${site.url}/og.jpg`,
    url: site.url,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.contact.street,
      postalCode: site.contact.zip,
      addressLocality: site.contact.city,
      addressRegion: site.contact.state,
      addressCountry: "DE",
    },
    areaServed: [site.primaryArea.title, ...site.extendedArea.counties],
    description: site.longDescription,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: `${site.url}/kontakt`,
      areaServed: "DE",
      availableLanguage: "de",
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
