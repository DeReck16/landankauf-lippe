import { felder, kasten, p, paragraphen, type Block } from "../dokument";
import { FIRMA } from "../firma";
import type { KaufabsichtDaten, Vorlage } from "./typen";

// Kaufabsicht und Eckdaten für den Notar. Grundstückskaufverträge bedürfen der
// notariellen Beurkundung (§ 311b Abs. 1 BGB) — dieses Dokument verpflichtet
// deshalb ausdrücklich zu nichts. Es sammelt nur die verhandelten Eckdaten für
// den Vertragsentwurf des Notars.

function render(d: KaufabsichtDaten) {
  const para = paragraphen();
  const b: Block[] = [];

  b.push(
    kasten("Unverbindlich", [
      "Ein Grundstückskaufvertrag wird erst mit der notariellen Beurkundung geschlossen (§ 311b Abs. 1 BGB). Diese Kaufabsicht begründet keine Pflicht zum Kauf oder Verkauf, keine Reservierung und keine Zahlungspflicht zwischen den Parteien. Jede Partei kann bis zur Beurkundung ohne Angabe von Gründen Abstand nehmen.",
    ]),
    felder([
      ["Verkäufer", `${d.verkaeufer.name}, ${d.verkaeufer.anschrift}`],
      ["Käufer", `${d.kaeufer.name}${d.kaeufer.betrieb ? ` (${d.kaeufer.betrieb})` : ""}, ${d.kaeufer.anschrift}`],
    ]),
  );

  b.push(
    para("Kaufgegenstand"),
    felder(d.flaechen.map((f) => [f.bezeichnung, `${f.groesse}${f.nutzung ? ` · ${f.nutzung}` : ""}`] as [string, string])),
    p(`Gesamtfläche: ${d.gesamtFlaeche}. Maßgeblich sind die Angaben des Grundbuchs und des Liegenschaftskatasters, die der Notar einholt.`),
  );

  b.push(
    para("Kaufpreis und Übergabe"),
    p(`Die Parteien streben einen Kaufpreis von ${d.kaufpreis} an. Besitz, Nutzen und Lasten sollen übergehen: ${d.uebergabe || "nach Vereinbarung im notariellen Vertrag"}.`),
    p(`Bestehende Pacht- oder Nutzungsverhältnisse: ${d.bestehendePacht || "keine bekannt"}.`),
  );

  b.push(
    para("Notar und Genehmigungen"),
    p(`Gewünschter Notar: ${d.notarWunsch || "noch offen"}. Der Notar entwirft den Kaufvertrag, holt Grundbuchauszüge ein und berät beide Seiten unparteiisch.`),
    p(`Der Verkauf land- oder forstwirtschaftlicher Grundstücke von mehr als 1 ha bedarf in Nordrhein-Westfalen der Genehmigung nach dem Grundstückverkehrsgesetz (zuständig: ${d.genehmigungStelle}). Ab 2 ha kann ein siedlungsrechtliches Vorkaufsrecht bestehen, daneben andere gesetzliche Vorkaufsrechte. Der Notar prüft das und beantragt die Genehmigung; der Kaufvertrag wird erst mit ihr wirksam.`),
  );

  b.push(
    para("Weitergabe an den Notar"),
    p(`Beide Parteien sind damit einverstanden, dass ${FIRMA.marke} diese Eckdaten sowie Namen und Anschriften an den gewünschten Notar übermittelt, damit er den Vertragsentwurf vorbereiten kann.`),
  );

  b.push(
    para("Provision"),
    p(
      d.eigeneFlaeche
        ? `Die Fläche gehört dem Geschäftsführer der ${FIRMA.name} (Betreiberin von ${FIRMA.marke}) bzw. seiner Familie („eigene Fläche“); das ist dem Käufer offengelegt. Für diesen Kauf schuldet keine Partei ${FIRMA.marke} eine Provision.`
        : `Der Käufer schuldet ${FIRMA.marke} aufgrund seines gesonderten Nachweisvertrags eine Provision von ${d.provisionKaeufer}. Sie entsteht mit der notariellen Beurkundung des Kaufvertrags — bedarf er einer behördlichen Genehmigung (z. B. nach dem Grundstückverkehrsgesetz) oder steht er unter einer aufschiebenden Bedingung, erst mit seiner Wirksamkeit — und ist 14 Tage nach Zugang der Rechnung fällig. Der Verkäufer schuldet keine Provision.`,
    ),
  );

  b.push(para("Besonderes"), p(d.besonderes || "Keine besonderen Vereinbarungen."));

  b.push(
    para("Bestätigung"),
    p("Mit der Bestätigung im Kundenbereich erklären die Parteien nur, dass die Eckdaten ihren Gesprächen entsprechen, und bitten um Vorbereitung des notariellen Vertrags. Eine rechtliche oder steuerliche Beratung durch Lippe Forst erfolgt nicht."),
  );

  return {
    titel: "Kaufabsicht und Eckdaten für den Notar",
    untertitel: `unverbindlich · vorbereitet über ${FIRMA.marke} · Vorgang ${d.vorgang}`,
    bloecke: b,
  };
}

const P = (s: string) => `«${s}»`;

function platzhalter(eigeneFlaeche: boolean): KaufabsichtDaten {
  return {
    vorgang: P("Vorgang"),
    verkaeufer: { name: P("Name Verkäufer"), anschrift: P("Anschrift Verkäufer") },
    kaeufer: { name: P("Name Käufer"), anschrift: P("Anschrift Käufer"), betrieb: P("Betrieb") },
    flaechen: [{ bezeichnung: P("Gemarkung, Flur, Flurstück"), groesse: P("Größe"), nutzung: P("Nutzung") }],
    gesamtFlaeche: P("Gesamtfläche"),
    kaufpreis: P("Kaufpreis"),
    uebergabe: P("Übergabe"),
    bestehendePacht: P("bestehende Pacht"),
    notarWunsch: P("Notar"),
    besonderes: P("Besonderes"),
    provisionKaeufer: P("Provision Käufer"),
    genehmigungStelle: P("Genehmigungsbehörde"),
    eigeneFlaeche,
  };
}

export const KAUFABSICHT: Vorlage<KaufabsichtDaten> = {
  id: "kaufabsicht",
  version: "2026-09-27",
  titel: "Kaufabsicht / Eckdaten für den Notar",
  beschreibung: "Unverbindliche Zusammenfassung der verhandelten Eckdaten eines Flächenkaufs zur Vorbereitung der notariellen Beurkundung.",
  render,
  varianten: [
    { name: "Standard", daten: platzhalter(false) },
    { name: "eigene Fläche (ohne Provision)", daten: platzhalter(true) },
  ],
};
