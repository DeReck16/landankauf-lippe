// Wertindikations-Modell auf Basis der Grundstücksmarktberichte Kreis Lippe 2025 und 2026
// (Berichtsjahre 2024 und 2025) und Erfahrungswerten. Werte sind Bandbreiten,
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
    // Flächengewichtetes Mittel 2024/2025: (163,67 ha × 5,26 + 221,58 ha × 3,80) / 385,25 ha ≈ 4,42 €/m².
    // Der Gutachterausschuss wertet das Preisniveau 2025 als konstant (Index 99) — der niedrigere
    // Jahresdurchschnitt 2025 kommt aus der Zusammensetzung der verkauften Flächen.
    mean: 4.42,
    spread: 0.4,
    basis:
      "Ackerland 2024 und 2025: 164 Kauffälle über 385 ha, Mittelwert ≈ 4,42 €/m² (2024 ≈ 5,26, 2025 ≈ 3,80 €/m²; Preisniveau laut Gutachterausschuss konstant). Bandbreite je nach Bonität (Ackerzahl), Zuschnitt und Lage.",
    hint:
      "Hochwertige Bonität (Ackerzahl > 60), guter Zuschnitt und Hofnähe ziehen den Wert nach oben.",
  },
  gruenland: {
    mean: 2.16,
    spread: 0.5,
    basis:
      "Grünland 2025: 24 Kauffälle, 33,84 ha, Mittelwert ≈ 2,16 €/m² (≈ 21.600 €/ha), Preise laut Gutachterausschuss gestiegen. Spanne stark abhängig von Bewirtschaftbarkeit.",
    hint:
      "Hangflächen und Schutzgebietskulissen liegen oft niedriger, aber Förderpotenzial (VNS) kann das deutlich aufwiegen.",
  },
  wald: {
    mean: 1.53,
    spread: 0.6,
    basis:
      "Forstwirtschaftliche Flächen 2025 (inkl. Aufwuchs): 28 Kauffälle, 45,00 ha, Mittelwert ≈ 1,53 €/m² (≈ 15.300 €/ha). Reine Bodenwerte ohne Aufwuchs liegen niedriger.",
    hint:
      "Hiebsreife Laubholzbestände erzielen deutlich höhere Werte. Junge Aufforstung und Käferflächen liegen am unteren Rand.",
  },
  bauland: {
    // Mittel der Spalte „mittlere Lage“ (16 Kommunen) im Grundstücksmarktbericht 2026: 150,6 €/m²
    mean: 150,
    spread: 0.55,
    basis:
      "Wohnbauland Kreis Lippe (Mittel der mittleren Lagen aller 16 Kommunen, Grundstücksmarktbericht 2026). Schwankt extrem zwischen Detmold/Bad Salzuflen (300+ €/m² gute Lage) und Lügde/Schwalenberg (60–90 €/m²).",
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
      "Grundstücksmarktberichte 2025 und 2026 für den Kreis Lippe (Berichtsjahre 2024 und 2025)",
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
