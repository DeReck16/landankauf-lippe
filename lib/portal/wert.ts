import type { KatasterDaten, LeadView } from "@/lib/admin/model";
import { CITIES, type City } from "@/lib/cities";
import { valuate, type FlaechenTyp } from "@/lib/valuation";

// Wertindikation für Antwortschreiben und Einladungen (Dennis 27.09.2026: „zuerst die
// Wertindikation, dann beide Wege, dann Vereinbarung/Börse“). Vorrang hat der amtliche
// Bodenrichtwert am Flurstück (BORIS NRW, lib/portal/kataster.ts), sonst — nur in Lippe —
// der Durchschnitt aus dem Grundstücksmarktbericht Kreis Lippe 2026 (lib/valuation.ts, wie
// das Bewertungstool der Website). Für Verpachtungen die Pachtspanne der Website.
// Ohne Server-Abhängigkeit (Tests).

export const TYP_NAME: Record<FlaechenTyp, string> = { ackerland: "Ackerland", gruenland: "Grünland", wald: "Wald", bauland: "Bauland" };

export function wertTyp(flaechentyp: string): FlaechenTyp | null {
  if (flaechentyp === "Ackerland") return "ackerland";
  if (flaechentyp === "Wiese / Grünland") return "gruenland";
  if (flaechentyp === "Wald / Forst") return "wald";
  if (flaechentyp === "Bauland") return "bauland";
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

const ALIAS: [RegExp, string][] = [
  [/(^|[^a-z])bad meinberg([^a-z]|$)/, "horn-bad-meinberg"],
  [/(^|[^a-z])horn([^a-z]|$)/, "horn-bad-meinberg"],
  [/(^|[^a-z])(schieder|schwalenberg)([^a-z]|$)/, "schieder-schwalenberg"],
  [/(^|[^a-z])salzuflen([^a-z]|$)/, "bad-salzuflen"],
];

/** Lipper Gemeinde im Ortstext — ganze Wörter („Hanglage“ ist nicht Lage), längste Namen zuerst. */
export function gemeindeAus(ort: string): City | null {
  const o = norm(ort);
  if (!o) return null;
  for (const c of [...CITIES].sort((a, b) => b.name.length - a.name.length)) {
    const n = norm(c.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(o)) return c;
  }
  for (const [re, slug] of ALIAS) if (re.test(o)) return CITIES.find((c) => c.slug === slug) ?? null;
  return null;
}

export const euro2 = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const euroRund = (n: number) => (Math.round(n / 1000) * 1000).toLocaleString("de-DE");
export const qm = (ha: number) => Math.round(ha * 10_000).toLocaleString("de-DE");

export type Wert = { satz: string; kurz: string; hint: string | null };

/** Wertindikation wie im Bewertungstool; Bauland nach dem Bodenrichtwert der Gemeinde (mittlere Lage). */
export function wertindikation(typ: FlaechenTyp, ha: number | null, city: City | null): Wert | null {
  if (typ === "bauland") {
    if (!city) return null;
    const w = city.baulandMittlereLage;
    const gesamt = ha != null && ha > 0 && ha <= 1 ? ` Für Ihre rund ${qm(ha)} m² wären das bei mittlerer Lage etwa ${euroRund(w * ha * 10_000)} €.` : "";
    return {
      satz: `Wohnbauland in mittlerer Lage liegt ${city.display} laut Grundstücksmarktbericht Kreis Lippe 2026 bei rund ${w} € je m² (Bodenrichtwert).${gesamt}`,
      kurz: `Bauland mittlere Lage ${city.name}: ${w} €/m²${gesamt ? ` · ≈ ${euroRund(w * ha! * 10_000)} €` : ""}`,
      hint: null,
    };
  }
  if (ha == null || ha <= 0) return null;
  const r = valuate({ typ, groesseHa: ha, gemeinde: city?.name.toLowerCase() });
  const [a, b] = r.perM2Range;
  const qmZahl = ha * 10_000;
  return {
    satz: `${TYP_NAME[typ]} ${city ? city.display : "im Kreis Lippe"} liegt nach unserer Auswertung des Grundstücksmarktberichts Kreis Lippe 2026 derzeit bei etwa ${euro2(a)} bis ${euro2(b)} € je m². Für Ihre rund ${qm(ha)} m² ergibt das grob ${euroRund(a * qmZahl)} bis ${euroRund(b * qmZahl)} €.`,
    kurz: `${euro2(a)}–${euro2(b)} €/m² · ${euroRund(a * qmZahl)}–${euroRund(b * qmZahl)} €`,
    hint: r.hint,
  };
}

const datumTag = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

type Brw = NonNullable<KatasterDaten["brw"]>;

/**
 * Nutzungsart der Zone in Worten für die Verwaltung („Acker“, „Grünland“, „Landwirtschaft“ bei Sammelzone bzw.
 * Eintrag ohne Nutzungsart, „Forst, ohne Aufwuchs“, „Wohnbau“) — damit man sieht, welche Zone gilt.
 */
export function brwNutzungKurz(b: Brw): string {
  if (b.art === "forstwirtschaft") return "Forst, ohne Aufwuchs";
  if (b.art === "wohnbau") return "Wohnbau";
  return b.nuta === "A" ? "Acker" : b.nuta === "GR" ? "Grünland" : "Landwirtschaft";
}

/** Bodenrichtwert in einer Zeile für die Verwaltung: „Bodenrichtwert 4,00 €/m² (Acker, Stichtag 01.01.2026, Zone 8301)“. */
export function brwZeile(b: Brw): string {
  return `Bodenrichtwert ${euro2(b.wert)} €/m² (${brwNutzungKurz(b)}, Stichtag ${datumTag(b.stichtag)}, Zone ${b.zone})`;
}

/**
 * Warnung für die Verwaltung, wenn die Zone nicht sicher zur Fläche passt — sonst null. Drei Fälle: Eintrag noch
 * ohne Nutzungsart (ältere Abfrage, wird neu abgefragt), Flächenart unklar (Acker oder Grünland?) und keine Zone
 * der gesuchten Nutzungsart am Flurstück. Eine Sammelzone („L“, Landwirtschaft ohne Unterscheidung) passt immer.
 */
export function brwWarnung(b: Brw): string | null {
  if (b.art !== "landwirtschaft") return null;
  if (b.nuta === undefined) return "Ältere Abfrage — Acker und Grünland waren nicht unterschieden, der Wert kann zur falschen Nutzungsart gehören. Wird beim nächsten Lauf neu abgefragt.";
  if (b.nuta === "L") return null;
  if (!b.gewuenscht) return `Flächenart nicht eindeutig — Zone für ${brwNutzungKurz(b)} genommen. Bitte prüfen, ob Acker oder Grünland gemeint ist.`;
  if (b.nuta !== b.gewuenscht) return `Keine ${b.gewuenscht === "A" ? "Acker" : "Grünland"}-Zone am Flurstück gefunden — der Wert gilt für ${brwNutzungKurz(b)}.`;
  return null;
}

/** Nutzungsart im Text an den Kunden („Ackerland“, „Grünland“; ohne Angabe wie bisher „landwirtschaftliche Flächen“). */
function brwArtText(b: Brw): string {
  if (b.art === "forstwirtschaft") return "Waldflächen (Boden ohne Aufwuchs)";
  if (b.art === "wohnbau") return "Wohnbauland";
  return b.nuta === "A" ? "Ackerland" : b.nuta === "GR" ? "Grünland" : "landwirtschaftliche Flächen";
}

/**
 * Wertindikation aus dem amtlichen Bodenrichtwert am Flurstück (BORIS NRW) — genauer als der Kreisdurchschnitt.
 * Der Text nennt die Nutzungsart der Zone; fehlte am Flurstück die passende, steht dort die tatsächlich gewählte
 * (z. B. „für Grünland“ bei einer Ackerfläche) — die Verwaltung wird darauf im Antwortentwurf hingewiesen (brwWarnung).
 */
export function wertAusBrw(k: KatasterDaten): Wert | null {
  const f = k.flurstueck;
  const b = k.brw;
  if (!f || !b || !f.flaecheM2) return null;
  const ga = b.gutachterausschuss.replace(/^Der\s+/, "") || "Gutachterausschuss für Grundstückswerte";
  const gesamt = b.wert * f.flaecheM2;
  return {
    satz: `Der amtliche Bodenrichtwert für ${brwArtText(b)} in Ihrer Lage liegt bei ${euro2(b.wert)} € je m² (Stichtag ${datumTag(b.stichtag)}, ${ga}). Für Ihr Flurstück ${f.gemarkung}, Flur ${f.flur}, Flurstück ${f.nummer} mit amtlich ${qm(f.flaecheM2 / 10_000)} m² ergibt das rechnerisch rund ${euroRund(gesamt)} €.${b.art === "forstwirtschaft" ? " Der Wert des Holzbestands kommt hinzu." : ""}`,
    // Muss mit „Bodenrichtwert“ beginnen — daran erkennt der Antwortentwurf den amtlichen Wert (antwort.ts).
    kurz: `Bodenrichtwert ${euro2(b.wert)} €/m² (${brwNutzungKurz(b)}, ${datumTag(b.stichtag)}) · amtlich ${qm(f.flaecheM2 / 10_000)} m² · ≈ ${euroRund(gesamt)} €`,
    hint: null,
  };
}

/** Was den Wert innerhalb der Spanne bestimmt und was wir dafür noch wissen möchten. */
export function genauer(typ: FlaechenTyp, hatFlurstueck: boolean): { faktoren: string; nachfrage: string } {
  const flst = hatFlurstueck ? "" : "das Flurstück und ";
  switch (typ) {
    case "ackerland":
      return { faktoren: "der Bodengüte (Ackerzahl), dem Zuschnitt und der Zufahrt", nachfrage: hatFlurstueck ? "die Ackerzahl, falls Sie sie kennen" : "das Flurstück und – falls bekannt – die Ackerzahl" };
    case "gruenland":
      return { faktoren: "der Bewirtschaftbarkeit, einer möglichen Hanglage und Schutzgebietsauflagen", nachfrage: `${flst}die heutige Nutzung (Mahd oder Weide)` };
    case "wald":
      return { faktoren: "Baumarten, Alter und Zustand des Bestands sowie der Erschließung", nachfrage: `${flst}Angaben zum Bestand (Baumarten, Alter, Schäden)` };
    default:
      return { faktoren: "der genauen Lage, dem Zuschnitt und der Bebaubarkeit", nachfrage: hatFlurstueck ? "die genaue Adresse" : "die genaue Adresse oder das Flurstück" };
  }
}


/** Pachtspannen je Hektar und Jahr (Seite /flaeche-verpachten, Stand 2026). */
// Orientierungsspannen, einheitlich mit Website und Blog (Ackerland 250–750, gute Lagen 550–750;
// Grünland 120–380, intensiv nutzbar 250–380 €/ha und Jahr).
export const PACHT_SPANNE: Partial<Record<FlaechenTyp, [number, number]>> = {
  ackerland: [250, 750],
  gruenland: [120, 380],
};

/**
 * Wertindikation für eine Anfrage (Verkauf): amtlicher Bodenrichtwert am Flurstück, sonst in
 * Lippe die Spanne aus dem Grundstücksmarktbericht; null, wenn nichts Belastbares vorliegt.
 */
export function wertFuerLead(l: LeadView): (Wert & { amtlich: boolean }) | null {
  const k = l.meta.kataster ?? null;
  const ausBrw = k ? wertAusBrw(k) : null;
  if (ausBrw) return { ...ausBrw, amtlich: true };
  const typ = wertTyp(l.typ);
  if (!typ || typ === "bauland") return null;
  const city = gemeindeAus(l.ortText || l.ort);
  const inLippe = k?.flurstueck ? k.flurstueck.kreis === "Lippe" : Boolean(city);
  if (!inLippe) return null;
  const g = l.groesseWert;
  const ha = g.minHa != null && g.maxHa != null ? (g.minHa + g.maxHa) / 2 : (g.minHa ?? g.maxHa);
  const w = wertindikation(typ, ha ?? null, city);
  return w ? { ...w, amtlich: false } : null;
}

/** Pachtpreis-Indikation für eine Verpachtung (Acker, Grünland) — null ohne passende Spanne. */
export function pachtFuerLead(l: LeadView): { satz: string; kurz: string } | null {
  const typ = wertTyp(l.typ) ?? (l.meta.kataster?.flurstueck && /landwirtschaft|acker|grünland/i.test(l.meta.kataster.flurstueck.nutzung) ? "ackerland" : null);
  const spanne = typ ? PACHT_SPANNE[typ] : undefined;
  if (!typ || !spanne) return null;
  const g = l.groesseWert;
  const ha = g.minHa != null && g.maxHa != null ? (g.minHa + g.maxHa) / 2 : (g.minHa ?? g.maxHa);
  const [a, b] = spanne;
  const gesamt = ha != null && ha > 0 ? ` Für Ihre rund ${ha.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ha wären das grob ${Math.round((a * ha) / 10) * 10}–${Math.round((b * ha) / 10) * 10} € Pacht im Jahr.` : "";
  return {
    satz: `${TYP_NAME[typ]} wird im Kreis Lippe derzeit für etwa ${a}–${b} € je Hektar und Jahr verpachtet — je nach Bodengüte, Lage, Zuschnitt und Bewirtschaftbarkeit.${gesamt}`,
    kurz: `Pacht ${TYP_NAME[typ]}: ${a}–${b} €/ha/Jahr`,
  };
}

/** Kataster-Daten sind nur für die Typprüfung nötig. */
export type { KatasterDaten };
