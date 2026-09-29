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
  "Ökopunkte gesucht",
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

/**
 * Nachfrage nach Ökopunkten bzw. Kompensationsflächen (Projektentwickler, Planer, Kommunen) — Gegenstück zu
 * „VNS / Ökopunkte“ (Eigentümer fragen nach Förderung). Kein Flächen-Gesuch im Sinne von Pacht/Kauf: kein
 * Matching, keine Börse, kein Nachweisvertrag; die Anfrage wird persönlich beantwortet (lib/portal/antwort.ts).
 */
export function isOekopunkteNachfrage(intent: string): boolean {
  return intent === "Ökopunkte gesucht";
}
