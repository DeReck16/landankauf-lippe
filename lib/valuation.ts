// Wertindikations-Modell auf Basis Grundstücksmarktbericht Kreis Lippe 2025
// (Berichtsjahr 2024) und Erfahrungswerten. Werte sind Bandbreiten,
// keine Verkehrswertgutachten.

export type FlaechenTyp = "ackerland" | "gruenland" | "wald" | "bauland";

export type ValuationInput = {
  typ: FlaechenTyp;
  groesseHa: number;
  gemeinde?: string;
  qualitaet?: "schwach" | "durchschnitt" | "stark"; // Bonität / Bestand / Lage
};

export type ValuationResult = {
  perM2Range: [number, number];
  totalRange: [number, number];
  basis: string;
  hint: string;
  sources: string[];
};

const DATA: Record<FlaechenTyp, { mean: number; spread: number; basis: string; hint: string }> = {
  ackerland: {
    mean: 5.26,
    spread: 0.4,
    basis:
      "Ackerland 2024: 75 Kauffälle, 163,67 ha, Mittelwert ≈ 5,26 €/m² (≈ 52.600 €/ha). Bandbreite je nach Bonität (Ackerzahl), Zuschnitt und Lage.",
    hint:
      "Hochwertige Bonität (Ackerzahl > 60), guter Zuschnitt und Hofnähe ziehen den Wert nach oben.",
  },
  gruenland: {
    mean: 1.89,
    spread: 0.5,
    basis:
      "Grünland 2024: 24 Kauffälle, 34,32 ha, Mittelwert ≈ 1,89 €/m² (≈ 18.900 €/ha). Spanne stark abhängig von Bewirtschaftbarkeit.",
    hint:
      "Hangflächen und Schutzgebietskulissen liegen oft niedriger, aber Förderpotenzial (VNS) kann das deutlich aufwiegen.",
  },
  wald: {
    mean: 1.34,
    spread: 0.6,
    basis:
      "Forstwirtschaftliche Flächen 2024 (inkl. Aufwuchs): 15 Kauffälle, 22,44 ha, Mittelwert ≈ 1,34 €/m² (≈ 13.400 €/ha). Reine Bodenwerte ohne Aufwuchs liegen niedriger.",
    hint:
      "Hiebsreife Laubholzbestände erzielen deutlich höhere Werte. Junge Aufforstung und Käferflächen liegen am unteren Rand.",
  },
  bauland: {
    mean: 165,
    spread: 0.55,
    basis:
      "Wohnbauland Kreis Lippe (Mittel der mittleren Lagen aller 16 Kommunen, Bodenrichtwerte 2025). Schwankt extrem zwischen Detmold/Bad Salzuflen (300+ €/m² gute Lage) und Lügde/Schwalenberg (60–90 €/m²).",
    hint:
      "Stadt-/Gemeindename ist hier entscheidend — bitte konkrete Lage nennen, dann ermitteln wir den Wert spezifischer.",
  },
};

const QUALITY_FACTOR: Record<NonNullable<ValuationInput["qualitaet"]>, number> = {
  schwach: 0.75,
  durchschnitt: 1.0,
  stark: 1.3,
};

const GEMEINDE_FACTOR: Record<string, number> = {
  // groessere/zentralere Lagen tendenziell etwas höher
  detmold: 1.1,
  lemgo: 1.05,
  "bad salzuflen": 1.1,
  oerlinghausen: 1.05,
  blomberg: 0.95,
  "horn-bad meinberg": 0.95,
  lage: 1.0,
  schlangen: 1.0,
  augustdorf: 1.0,
  "schieder-schwalenberg": 0.85,
  barntrup: 0.9,
  dörentrup: 0.9,
  doerentrup: 0.9,
  extertal: 0.9,
  kalletal: 0.9,
  leopoldshöhe: 1.05,
  leopoldshoehe: 1.05,
  lügde: 0.85,
  luegde: 0.85,
};

export function valuate(input: ValuationInput): ValuationResult {
  const data = DATA[input.typ];
  const qualF = QUALITY_FACTOR[input.qualitaet ?? "durchschnitt"];
  const gemKey = (input.gemeinde ?? "").trim().toLowerCase();
  const gemF = GEMEINDE_FACTOR[gemKey] ?? 1.0;

  const factor = qualF * gemF;
  const center = data.mean * factor;

  const lower = center * (1 - data.spread);
  const upper = center * (1 + data.spread);

  const totalLower = lower * input.groesseHa * 10_000;
  const totalUpper = upper * input.groesseHa * 10_000;

  return {
    perM2Range: [round(lower, 2), round(upper, 2)],
    totalRange: [roundTo(totalLower, 100), roundTo(totalUpper, 100)],
    basis: data.basis,
    hint: data.hint,
    sources: [
      "Grundstücksmarktbericht 2025 für den Kreis Lippe (Berichtsjahr 2024)",
      "Bodenrichtwerte BORIS NRW",
      "Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold",
    ],
  };
}

function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function roundTo(v: number, step: number) {
  return Math.round(v / step) * step;
}

export const flaechenTypOptions: { value: FlaechenTyp; label: string }[] = [
  { value: "ackerland", label: "Ackerland" },
  { value: "gruenland", label: "Grünland / Wiese" },
  { value: "wald", label: "Wald / Forst" },
  { value: "bauland", label: "Bauland (mittlere Lage)" },
];

export const qualityOptions = [
  { value: "schwach", label: "Eher schwach (z. B. Hang, geringe Bonität, schwerer Zugang)" },
  { value: "durchschnitt", label: "Durchschnittlich (guter Lipper Standard)" },
  { value: "stark", label: "Stark (top Bonität, beste Lage, hofnah)" },
] as const;

export const gemeindeOptions = [
  "Augustdorf",
  "Bad Salzuflen",
  "Barntrup",
  "Blomberg",
  "Detmold",
  "Dörentrup",
  "Extertal",
  "Horn-Bad Meinberg",
  "Kalletal",
  "Lage",
  "Lemgo",
  "Leopoldshöhe",
  "Lügde",
  "Oerlinghausen",
  "Schieder-Schwalenberg",
  "Schlangen",
  "Andere / außerhalb Kreis Lippe",
];
