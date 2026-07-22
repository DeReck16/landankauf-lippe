export const site = {
  name: "Lippe Forst",
  domain: "lippeforst.de",
  url: "https://lippeforst.de",
  shortDescription:
    "Lippe Forst — fairer Ankauf von Ackerland, Wiesen und Wald im Kreis Lippe. Persönlich, regional, ohne Maklergebühren.",
  longDescription:
    "Lippe Forst kauft, pachtet und bewertet Ackerland, Wiesen und Wald im Kreis Lippe und im Umland. Zusätzlich beraten wir bei Vertragsnaturschutz und Ökopunkten und vermitteln Lohnunternehmer für Mahd, Pflege und Forstarbeiten.",
  contact: {
    company: "TR Vertriebs GmbH",
    contactPerson: "Dennis Reckling",
    street: "Bahnhofstraße 70b",
    zip: "32805",
    city: "Horn-Bad Meinberg",
    region: "Kreis Lippe",
    state: "Nordrhein-Westfalen",
    country: "Deutschland",
    phone: "+49 176 38803064",
    phoneDisplay: "0176 38803064",
    whatsapp: "+4917638803064",
    phoneEncoded: "KzQ5MTc2Mzg4MDMwNjQ=",
    whatsappEncoded: "KzQ5MTc2Mzg4MDMwNjQ=",
    email: "info@tr-immobilien.com",
    emailFallback: "info@tr-immobilien.com",
  },
  legal: {
    registerCourt: "Amtsgericht Lemgo",
    registerNumber: "HRB 11734",
    managingDirector: "Dennis Reckling, Martin Thomann",
    managingDirectors: ["Dennis Reckling", "Martin Thomann"],
    vatId: "DE315563148",
  },
  hours: "Mo–Fr 9:00–18:00, Sa nach Vereinbarung",
  primaryArea: {
    title: "Kreis Lippe",
    cities: [
      "Detmold",
      "Lemgo",
      "Bad Salzuflen",
      "Horn-Bad Meinberg",
      "Blomberg",
      "Lage",
      "Oerlinghausen",
      "Schieder-Schwalenberg",
      "Schlangen",
      "Augustdorf",
      "Barntrup",
      "Dörentrup",
      "Extertal",
      "Kalletal",
      "Leopoldshöhe",
      "Lügde",
    ],
  },
  extendedArea: {
    title: "Angrenzende Kreise",
    note:
      "Auch in den umliegenden Kreisen aktiv — sprechen Sie uns an, auch wenn Ihre Fläche außerhalb des Kreises Lippe liegt.",
    counties: [
      "Kreis Höxter",
      "Kreis Paderborn",
      "Kreis Gütersloh",
      "Kreis Herford",
      "Stadt Bielefeld",
      "Kreis Hameln-Pyrmont",
      "Landkreis Schaumburg",
      "Kreis Minden-Lübbecke",
    ],
  },
} as const;

export const services = [
  {
    slug: "flaeche-verkaufen",
    title: "Fläche verkaufen",
    short: "Diskreter Direktankauf",
    description:
      "Wir kaufen Ihr Ackerland, Grünland oder Waldgrundstück direkt — ohne Makler, ohne Provision, mit fairem Marktpreis nach Bodenrichtwert.",
  },
  {
    slug: "flaeche-verpachten",
    title: "Fläche verpachten",
    short: "Langfristige Pachtverträge",
    description:
      "Sichere Pachteinnahmen ohne eigenen Aufwand. Wir bewirtschaften Ihre Fläche selbst oder vermitteln zuverlässige Pächter aus der Region.",
  },
  {
    slug: "solarpark-verpachten",
    title: "Solar & Wind",
    short: "Energiepacht für Ihre Fläche",
    description:
      "Solarpark-Pachten liegen bei 2.500–4.500 €/ha/Jahr, Windstandorte zahlen fünf- bis sechsstellige Jahrespachten. Wir prüfen kostenlos, ob Ihre Fläche in Frage kommt — und holen mehrere Angebote ein.",
  },
  {
    slug: "flaeche-bewerten",
    title: "Fläche bewerten",
    short: "Kostenlose Wertindikation",
    description:
      "Sie wollen wissen, was Ihre Fläche wirklich wert ist? Wir liefern eine fundierte Wertindikation auf Basis aktueller Bodenrichtwerte und realer Vergleichsverkäufe im Kreis Lippe — kostenlos und unverbindlich.",
  },
  {
    slug: "services/vns-oekopunkte",
    title: "VNS & Ökopunkte",
    short: "Förderung statt Stilllegung",
    description:
      "Vertragsnaturschutz NRW, Ökokonto und Ausgleichsflächen: Wir beraten Sie bei Antrag, Bewertung und Vermarktung — und holen das Maximum aus extensiven oder schwer bewirtschaftbaren Flächen heraus.",
  },
  {
    slug: "services/lohnunternehmer",
    title: "Lohnunternehmer",
    short: "Mahd, Pflege, Forstarbeiten",
    description:
      "Wir vermitteln verlässliche Lohnunternehmer aus dem Kreis Lippe für Mahd, Heuwerbung, Heckenpflege, Forstarbeit und alles, was rund um die Fläche anfällt.",
  },
] as const;

export const flaechenTypen = [
  { slug: "ackerland-verkaufen", label: "Ackerland", description: "Hofnah, hofentfernt, mit oder ohne Pächter", image: "/acker.webp" },
  { slug: "wiese-verkaufen", label: "Wiese / Grünland", description: "Inkl. extensiver Mähwiesen und Streuobstwiesen", image: "/wiese.webp" },
  { slug: "wald-verkaufen", label: "Wald / Forst", description: "Privatwald, Mischbestand, Nadelholz, Laubholz", image: "/wald.webp" },
] as const;
