import type { Rolle } from "./model";

// Erklärungen, die vor der Unterschrift einzeln angehakt werden. Der genaue
// Wortlaut landet im Unterschriftsprotokoll.

export type ErklaerungDef = { id: string; text: string; pflicht: boolean; tipp: string };

/**
 * Freiwillige Einwilligung in EINE Bitte um eine Bewertung per E-Mail nach dem
 * Abschluss. Eine solche Feedback-Mail gilt als Werbung (BGH, 10.07.2018,
 * VI ZR 225/17) und braucht daher eine Einwilligung (§ 7 Abs. 2 Nr. 2 UWG).
 * Der Danke-Hinweis im Kundenbereich ist davon unabhängig.
 */
export const BEWERTUNG_EINWILLIGUNG: ErklaerungDef = {
  id: "bewertung",
  pflicht: false,
  text: "Freiwillig: Nach einem erfolgreichen Abschluss darf mich Lippe Forst einmal per E-Mail um eine Bewertung bitten. Diese Einwilligung kann ich jederzeit widerrufen, z. B. per Antwort auf die E-Mail.",
  tipp: "Freiwillig — ohne Haken schicken wir Ihnen keine Bitte um eine Bewertung per E-Mail. Auf Ihren Vertrag hat das keinen Einfluss.",
};

export function erklaerungenKundenvertrag(rolle: Rolle, verbraucher: boolean, provision: string): ErklaerungDef[] {
  if (rolle === "anbieter") {
    return [
      {
        id: "vertrag",
        pflicht: true,
        text: "Ich habe die Vereinbarung vollständig gelesen und bin mit ihr einverstanden. Mir ist bekannt, dass ich als Anbieter keine Provision zahle.",
        tipp: "Pflicht: Bestätigt, dass Sie den Text oben gelesen haben und ihm zustimmen.",
      },
      {
        id: "berechtigt",
        pflicht: true,
        text: "Ich bin Eigentümer der angebotenen Fläche(n) oder zur Verpachtung bzw. zum Verkauf berechtigt; bei mehreren Eigentümern handle ich mit deren Einverständnis.",
        tipp: "Pflicht: Nur Eigentümer oder Berechtigte können Flächen anbieten.",
      },
      {
        id: "weitergabe",
        pflicht: true,
        text: "Ich willige ein, dass Lippe Forst meinen Namen, meine Anschrift, Telefonnummer, E-Mail-Adresse und die Flächenangaben an einen Interessenten weitergibt, nachdem ich dem konkreten Kontakt zugestimmt habe. Die Einwilligung kann ich jederzeit mit Wirkung für die Zukunft widerrufen.",
        tipp: "Pflicht: Ohne diese Einwilligung kann Lippe Forst keinen Kontakt herstellen. Weitergegeben wird erst nach Ihrer Zustimmung zum konkreten Interessenten.",
      },
      {
        id: "datenschutz",
        pflicht: true,
        text: "Ich habe die Datenschutzhinweise (lippeforst.de/datenschutz) zur Kenntnis genommen.",
        tipp: "Pflicht: Die Datenschutzhinweise öffnen sich über den Link unten in einem neuen Tab.",
      },
      BEWERTUNG_EINWILLIGUNG,
    ];
  }
  const liste: ErklaerungDef[] = [
    {
      id: "vertrag",
      pflicht: true,
      text: `Ich habe den Nachweis- und Vermittlungsvertrag vollständig gelesen und bin mit ihm einverstanden. Mir ist bekannt, dass ich nur im Erfolgsfall eine Provision schulde: ${provision}.`,
      tipp: "Pflicht: Bestätigt, dass Sie den Vertrag oben gelesen haben und die Provisionsregel kennen.",
    },
    {
      id: "weitergabe",
      pflicht: true,
      text: "Ich willige ein, dass Lippe Forst meinen Namen, meine Anschrift, Telefonnummer, E-Mail-Adresse und gegebenenfalls meinen Betrieb an einen Anbieter weitergibt, nachdem ich dem konkreten Kontakt zugestimmt habe. Die Einwilligung kann ich jederzeit mit Wirkung für die Zukunft widerrufen.",
      tipp: "Pflicht: Ohne diese Einwilligung kann Lippe Forst keinen Kontakt herstellen. Weitergegeben wird erst nach Ihrer Zustimmung zum konkreten Anbieter.",
    },
    {
      id: "datenschutz",
      pflicht: true,
      text: "Ich habe die Datenschutzhinweise (lippeforst.de/datenschutz) zur Kenntnis genommen.",
      tipp: "Pflicht: Die Datenschutzhinweise öffnen sich über den Link unten in einem neuen Tab.",
    },
  ];
  if (verbraucher) {
    liste.push(
      {
        id: "widerrufsbelehrung",
        pflicht: true,
        text: "Ich habe die Widerrufsbelehrung und das Muster-Widerrufsformular zur Kenntnis genommen.",
        tipp: "Pflicht: Die Widerrufsbelehrung steht im Vertragstext oben; Sie erhalten sie zusätzlich als PDF per E-Mail.",
      },
      {
        id: "beginnwunsch",
        pflicht: false,
        text: "Freiwillig: Ich verlange ausdrücklich, dass Lippe Forst schon vor Ablauf der Widerrufsfrist mit der Leistung beginnt, mir also passende Flächen vorstellt und Kontakte freigibt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlen muss und dass mein Widerrufsrecht erlischt, sobald Lippe Forst die Leistung vollständig erbracht hat.",
        tipp: "Freiwillig: Ohne Haken gibt Lippe Forst Kontakte erst nach Ablauf der 14-tägigen Widerrufsfrist frei. Sie können den Wunsch auch später im Kundenbereich erklären.",
      },
    );
  }
  liste.push(BEWERTUNG_EINWILLIGUNG);
  return liste;
}

export function erklaerungenPachtvertrag(rolle: Rolle): ErklaerungDef[] {
  return [
    {
      id: "pachtvertrag",
      pflicht: true,
      text:
        rolle === "anbieter"
          ? "Ich habe den Landpachtvertrag vollständig gelesen und schließe ihn als Verpächter verbindlich ab."
          : "Ich habe den Landpachtvertrag vollständig gelesen und schließe ihn als Pächter verbindlich ab.",
      tipp: "Pflicht: Bestätigt, dass Sie den Vertragstext oben gelesen haben.",
    },
    {
      id: "textform",
      pflicht: true,
      text: "Mir ist bekannt, dass der Vertrag in Textform (§ 585a BGB) geschlossen wird und mit der Unterschrift der zweiten Partei zustande kommt.",
      tipp: "Pflicht: Der Vertrag wird erst verbindlich, wenn beide Seiten unterschrieben haben.",
    },
  ];
}

export function erklaerungenKaufabsicht(): ErklaerungDef[] {
  return [
    {
      id: "eckdaten",
      pflicht: true,
      text: "Die Eckdaten entsprechen unseren Gesprächen. Mir ist bekannt, dass diese Kaufabsicht unverbindlich ist und ein Kaufvertrag erst mit der notariellen Beurkundung zustande kommt.",
      tipp: "Pflicht: Bestätigt nur die Eckdaten — Sie verpflichten sich damit nicht zum Kauf oder Verkauf.",
    },
    {
      id: "notar",
      pflicht: true,
      text: "Ich bin einverstanden, dass Lippe Forst die Eckdaten, Namen und Anschriften an den gewünschten Notar übermittelt.",
      tipp: "Pflicht: Nur so kann der Notar den Vertragsentwurf vorbereiten.",
    },
  ];
}
