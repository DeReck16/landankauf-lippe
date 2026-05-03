// Lipper Gemeinden mit Lokal-SEO-relevanten Daten
// Bodenrichtwert-Quelle: Grundstücksmarktbericht 2025 für den Kreis Lippe

export type CitySlug =
  | "detmold"
  | "lemgo"
  | "bad-salzuflen"
  | "horn-bad-meinberg"
  | "blomberg"
  | "lage"
  | "oerlinghausen"
  | "schieder-schwalenberg"
  | "schlangen"
  | "augustdorf"
  | "barntrup"
  | "doerentrup"
  | "extertal"
  | "kalletal"
  | "leopoldshoehe"
  | "luegde";

export type City = {
  slug: CitySlug;
  name: string;
  display: string; // wie in Sätzen verwendet ("in Detmold")
  description: string; // 1-2 Sätze geographischer Kontext
  characteristics: string[]; // 3-5 Bullet-Points zu Lage/Boden
  baulandMittlereLage: number; // €/m² aus Grundstücksmarktbericht 2025
};

export const CITIES: City[] = [
  {
    slug: "detmold",
    name: "Detmold",
    display: "in Detmold",
    description:
      "Detmold ist Kreisstadt und das wirtschaftliche Zentrum des Kreises Lippe. Landwirtschaftliche Flächen finden sich vor allem in den Ortsteilen Heidenoldendorf, Hiddesen, Pivitsheide, Berlebeck und Heiligenkirchen — eingebettet zwischen Teutoburger Wald und Werretal.",
    characteristics: [
      "Hofnahe Ackerlagen mit hoher Bodenqualität (Ackerzahl 50–70) im Werretal",
      "Waldreiche Hänge des Teutoburger Waldes mit Buche und Eiche",
      "Erweiterte Schutzgebietskulisse rund um die Externsteine und das Donoper Teich-Gebiet",
      "Gute Anbindung an Pächter aus Augustdorf, Schlangen und Bad Meinberg",
    ],
    baulandMittlereLage: 215,
  },
  {
    slug: "lemgo",
    name: "Lemgo",
    display: "in Lemgo",
    description:
      "Lemgo bringt typische lipper Mischflächen zusammen: leichte Hanglagen am Begatal, Acker- und Grünlandflächen in den Ortsteilen Brake, Lieme, Welstorf, Matorf-Kirchheide. Hofstellen mit angeschlossenen Feldstücken sind hier häufig.",
    characteristics: [
      "Acker- und Grünlandflächen im fruchtbaren Begatal",
      "Bewirtschaftungsfreundliche Schläge in Lieme und Brake",
      "Forstanteile in den höher gelegenen Ortsteilen Voßheide und Welstorf",
      "Lange Tradition als Hansestadt mit etablierten landwirtschaftlichen Strukturen",
    ],
    baulandMittlereLage: 180,
  },
  {
    slug: "bad-salzuflen",
    name: "Bad Salzuflen",
    display: "in Bad Salzuflen",
    description:
      "Bad Salzuflen liegt im Norden des Kreises Lippe, an der Grenze zum Kreis Herford. Die Flächen reichen vom Werretal bis zu den Höhenzügen von Schötmar und Holzhausen — landwirtschaftlich wertvoll, mit Nähe zum Bielefelder Verdichtungsraum.",
    characteristics: [
      "Hochwertiges Ackerland an der Werre und im Salzetal",
      "Kurort-Schutzkulissen begrenzen Bauland und stützen den Wert landwirtschaftlicher Flächen",
      "Pflegerelevantes Grünland am Bega-Werre-Zusammenfluss",
      "Forstparzellen in Schötmar und Holzhausen",
    ],
    baulandMittlereLage: 185,
  },
  {
    slug: "horn-bad-meinberg",
    name: "Horn-Bad Meinberg",
    display: "in Horn-Bad Meinberg",
    description:
      "Horn-Bad Meinberg ist unsere Heimatgemeinde — wir kennen jeden Flurnamen zwischen den Externsteinen, Leopoldstal, Wehren und Belle. Hier liegt der Schwerpunkt unserer Eigenbewirtschaftung.",
    characteristics: [
      "FFH-Gebiet Egge mit hoher Vertragsnaturschutz-Eignung",
      "Hangwiesen und extensive Mähwiesen am Silberbach und Eichenkampbach",
      "Privatwald-Parzellen am Püngelsberg, Triftenberge, Wehren",
      "Ortsteile: Belle, Bellenberg, Holzhausen-Externsteine, Leopoldstal, Veldrom, Wehren, Schmedissen",
    ],
    baulandMittlereLage: 115,
  },
  {
    slug: "blomberg",
    name: "Blomberg",
    display: "in Blomberg",
    description:
      "Blomberg liegt im Osten des Kreises Lippe und ist landwirtschaftlich von gemischten Schlaglagen geprägt. Vom Distel-, Donop- und Reelkirchener Bereich bis zu den Talauen der Bega ziehen sich Acker, Grünland und kleinere Forstflächen.",
    characteristics: [
      "Ackerflächen mit moderaten Bodenpunkten in den Höhenlagen Donop und Reelkirchen",
      "Hofnahes Grünland im Begatal und an der Distel",
      "Privatwald in Brüntorf, Eschenbruch und Großenmarpe",
      "Bekannt für historische Stadtmauer und intakten Bauernhofbestand",
    ],
    baulandMittlereLage: 120,
  },
  {
    slug: "lage",
    name: "Lage",
    display: "in Lage",
    description:
      "Lage liegt zentral im Kreis Lippe, mit guten Verkehrsanbindungen und einem Mix aus Acker- und Grünland. Die Werre und Bega prägen die Landschaft.",
    characteristics: [
      "Sehr gute Ackerlagen entlang der Werre und Bega — Bodenpunkte bis 75",
      "Großflächige zusammenhängende Schläge in Heiden, Hörste, Müssen, Pottenhausen",
      "Geringer Forstanteil, dafür hohe Dichte an Vollerwerbsbetrieben",
      "Strategische Lage zwischen Detmold, Bielefeld und Bad Salzuflen",
    ],
    baulandMittlereLage: 185,
  },
  {
    slug: "oerlinghausen",
    name: "Oerlinghausen",
    display: "in Oerlinghausen",
    description:
      "Oerlinghausen liegt am südwestlichen Rand des Kreises Lippe, direkt am Teutoburger Wald. Die Hanglagen Richtung Senne und der Übergang zum Bielefelder Raum machen Oerlinghausen zur teuersten landwirtschaftlichen Lage in Lippe.",
    characteristics: [
      "Sehr nachgefragte Lage durch Nähe zur Stadt Bielefeld",
      "Hangflächen mit Sennecharakter im Süden",
      "Forstanteile rund um den Tönsberg und am Teutoburger Wald",
      "Bauerwartungs- und Bauland mit überdurchschnittlichen Werten",
    ],
    baulandMittlereLage: 235,
  },
  {
    slug: "schieder-schwalenberg",
    name: "Schieder-Schwalenberg",
    display: "in Schieder-Schwalenberg",
    description:
      "Schieder-Schwalenberg liegt im Osten des Kreises Lippe, mit hohen Forstanteilen und kleineren landwirtschaftlichen Schlägen. Die Bio-Station Lippe hat hier ihren Sitz — Vertragsnaturschutz-Anträge laufen direkt vor Ort.",
    characteristics: [
      "Hoher Waldanteil — Privatwald, Hofstellen mit angeschlossenen Forstparzellen",
      "Sitz der Biologischen Station Lippe (Domäne 2) — direkter VNS-Zugang",
      "Extensive Hangwiesen mit hoher VNS-Förderfähigkeit",
      "Schloss Schwalenberg und Künstlerkolonie als regionaler Marker",
    ],
    baulandMittlereLage: 70,
  },
  {
    slug: "schlangen",
    name: "Schlangen",
    display: "in Schlangen",
    description:
      "Schlangen liegt am Übergang zur Senne und damit am Schnittpunkt von Kreis Lippe und Kreis Paderborn. Sandige Senneböden prägen die Landwirtschaft, Wald spielt eine große Rolle.",
    characteristics: [
      "Sennecharakter mit leichten Sandböden und Trockenheits-Resilienz-Bedarf",
      "Großer Privatwaldanteil — Kiefer, Lärche, Buche, Eiche im Übergangsbereich",
      "Grenze zum Truppenübungsplatz Senne mit ökologisch wertvollen Heidekulissen",
      "Gute Lage für Photovoltaik-Pacht durch Sonneneinstrahlung und ebene Schläge",
    ],
    baulandMittlereLage: 185,
  },
  {
    slug: "augustdorf",
    name: "Augustdorf",
    display: "in Augustdorf",
    description:
      "Augustdorf liegt am Rand des Truppenübungsplatzes Senne — geprägt von sandigen Böden und einem hohen Wald- und Heideanteil. Landwirtschaftliche Flächen sind selten und entsprechend gefragt.",
    characteristics: [
      "Senneflächen mit hohem ökologischem Wert (FFH, NSG)",
      "Wenig klassisches Ackerland, dafür viel Grünland und Forst",
      "Truppenübungsplatz Senne als Nachbarschaft mit speziellen Auflagen",
      "Ökopunkte-Potenzial überdurchschnittlich",
    ],
    baulandMittlereLage: 245,
  },
  {
    slug: "barntrup",
    name: "Barntrup",
    display: "in Barntrup",
    description:
      "Barntrup ist eine kleine Stadt im Osten des Kreises Lippe. Landwirtschaft ist hier traditionell familiengeführt; Flächen werden oft über Generationen weitergegeben.",
    characteristics: [
      "Mischflächen in Sommersell, Selbeck, Alverdissen",
      "Forstanteile mit Mischwald in den Höhenlagen",
      "Niedrige Bodenrichtwerte — entsprechend interessant für günstigen Direktankauf",
      "Erbengemeinschaften häufig — wir haben hier einen Schwerpunkt",
    ],
    baulandMittlereLage: 95,
  },
  {
    slug: "doerentrup",
    name: "Dörentrup",
    display: "in Dörentrup",
    description:
      "Dörentrup liegt am Übergang zum Lipper Bergland. Acker- und Grünlandflächen wechseln sich mit kleineren Forstparzellen ab.",
    characteristics: [
      "Hügelige Lipper-Bergland-Landschaft",
      "Kleinteilige Schläge, viele Hofnachfolge-Themen",
      "Forstanteile in Bega, Wendlinghausen, Hillentrup",
      "Gute lokale Pächterstruktur",
    ],
    baulandMittlereLage: 100,
  },
  {
    slug: "extertal",
    name: "Extertal",
    display: "in Extertal",
    description:
      "Extertal liegt im Norden des Kreises Lippe, an der Grenze zu Niedersachsen. Landschaftlich abwechslungsreich, mit vielen kleineren Schlägen und Forstparzellen.",
    characteristics: [
      "Übergangslage zum Weserbergland",
      "Hoher Forstanteil (Buche, Eiche, Fichte)",
      "Grünlandflächen mit Pflegebedarf, oft VNS-relevant",
      "Geringere Bodenrichtwerte — guter Direktankauf-Markt",
    ],
    baulandMittlereLage: 70,
  },
  {
    slug: "kalletal",
    name: "Kalletal",
    display: "im Kalletal",
    description:
      "Das Kalletal liegt im Norden des Kreises Lippe und zieht sich entlang der Kalle. Landwirtschaft wird hier oft im Nebenerwerb betrieben, kombiniert mit Forst.",
    characteristics: [
      "Tal-Landschaft entlang der Kalle",
      "Mischbetriebe Acker / Grünland / Forst dominieren",
      "Renaturierungspotenzial entlang der Bach- und Aueflächen",
      "Hofnahe Schläge mit langen Pachthistorien",
    ],
    baulandMittlereLage: 90,
  },
  {
    slug: "leopoldshoehe",
    name: "Leopoldshöhe",
    display: "in Leopoldshöhe",
    description:
      "Leopoldshöhe liegt im westlichen Teil des Kreises Lippe, mit guter Anbindung an Bielefeld. Landwirtschaftlich wertvolle Schläge mit hoher Nachfrage.",
    characteristics: [
      "Sehr gute Ackerlagen mit Bodenpunkten 60+",
      "Bielefeld-Nähe macht den Markt eng — viel Pacht, wenig Verkauf",
      "Geringer Forstanteil",
      "Bauerwartungs- und Mischlagen mit Aufwertungspotenzial",
    ],
    baulandMittlereLage: 215,
  },
  {
    slug: "luegde",
    name: "Lügde",
    display: "in Lügde",
    description:
      "Lügde liegt ganz im Osten des Kreises Lippe an der Grenze zu Niedersachsen. Forstwirtschaft hat hier eine starke Tradition.",
    characteristics: [
      "Hoher Wald- und Forstanteil",
      "Talauen der Emmer mit pflegerelevantem Grünland",
      "Niedrige Bodenrichtwerte für Bauland — interessanter für Investoren mit langem Horizont",
      "Historische Stadt am Osterräderlauf",
    ],
    baulandMittlereLage: 90,
  },
];

export type FlaechenTypSlug = "ackerland" | "wiese" | "wald";

export const FLAECHENTYPEN: {
  slug: FlaechenTypSlug;
  label: string;
  pluralGenitiv: string;
  description: string;
}[] = [
  {
    slug: "ackerland",
    label: "Ackerland",
    pluralGenitiv: "Ackerflächen",
    description: "Klassisches Ackerland — egal ob hofnah oder hofentfernt, mit oder ohne laufenden Pachtvertrag. Wir bewerten Ihre Fläche nach Bonität (Ackerzahl), Zuschnitt und Erschließung.",
  },
  {
    slug: "wiese",
    label: "Wiese / Grünland",
    pluralGenitiv: "Wiesen",
    description: "Grünland, extensive Mähwiesen, Streuobstwiesen, Hangflächen, Talauen — gerade schwer bewirtschaftbare Flächen erzielen über VNS oder Ökopunkte oft mehr als die klassische Pacht.",
  },
  {
    slug: "wald",
    label: "Wald / Forst",
    pluralGenitiv: "Wald- und Forstflächen",
    description: "Privatwald in Misch- oder Reinbestand, Käfer- oder Sturmwurfflächen, Aufforstungs­bestände — wir bewerten Bodenwert plus Aufwuchs und prüfen Förderpotenziale wie die Biotopbaum-Förderung NRW.",
  },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function cityTypeRoutes(): { city: CitySlug; type: FlaechenTypSlug }[] {
  const out: { city: CitySlug; type: FlaechenTypSlug }[] = [];
  for (const c of CITIES) {
    for (const t of FLAECHENTYPEN) {
      out.push({ city: c.slug, type: t.slug });
    }
  }
  return out;
}
