// Auswahlwerte des Anfrageformulars — gemeinsam genutzt von LeadForm und der
// Verwaltung (/admin), damit Matching und Formular dieselben Begriffe sprechen.

export const INTENTS = [
  "Verkaufen",
  "Verpachten",
  "Fläche gesucht (Pacht)",
  "Fläche gesucht (Kauf)",
  "Energiepacht (Solar/Wind)",
  "Bewertung",
  "VNS / Ökopunkte",
  "Lohnunternehmer",
  "Bauland-Beratung",
  "Allgemein",
] as const;

export type Intent = (typeof INTENTS)[number];

export const FLAECHENTYPEN = [
  "Ackerland",
  "Wiese / Grünland",
  "Wald / Forst",
  "Bauland",
  "Sonstiges",
] as const;

export type Flaechentyp = (typeof FLAECHENTYPEN)[number];

/** Gesuche: jemand sucht Fläche (Pächter, Käufer) — Gegenstück zu Verkaufen/Verpachten. */
export function isGesuchIntent(intent: string): boolean {
  return intent.startsWith("Fläche gesucht");
}
