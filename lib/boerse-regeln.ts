// Regeln der Flächenbörse ohne Server-Abhängigkeit (für Website, Verwaltung und Tests):
// was öffentlich erscheinen darf, wie die Provision genannt wird, wie Pakete entstehen.

import type { BoerseMeta, LeadView } from "@/lib/admin/model";
import { STANDARD_KONDITIONEN, type Konditionen } from "@/lib/portal/model";

export type BoerseArt = "kauf" | "pacht";

/** Feste Zusatzangaben eines Angebots (freiwillig, anonym). */
export type BoerseDetails = {
  /** Pachtstatus bzw. „frei ab“, z. B. „frei ab 01.10.2027“ oder „verpachtet bis 2028“. */
  frei?: string;
  /** Bodengüte, z. B. „Ackerzahl ca. 45“. */
  ackerzahl?: string;
  /** Zuwegung, z. B. „über öffentlichen Wirtschaftsweg“. */
  zuwegung?: string;
  /** Preis- bzw. Pachtvorstellung, z. B. „VB 400 €/ha und Jahr“. */
  preis?: string;
};

export const DETAIL_FELDER: { key: keyof BoerseDetails; label: string; tipp: string; beispiel: string }[] = [
  { key: "frei", label: "Pachtstatus / frei ab", tipp: "Z. B. „frei ab 01.10.2027“ oder „derzeit verpachtet bis 2028“", beispiel: "frei ab 01.10.2027" },
  { key: "ackerzahl", label: "Bodengüte (Ackerzahl)", tipp: "Nur bei Acker oder Grünland, z. B. „Ackerzahl ca. 45“", beispiel: "Ackerzahl ca. 45" },
  { key: "zuwegung", label: "Zuwegung", tipp: "Z. B. „über öffentlichen Wirtschaftsweg“ — ohne Straßennamen", beispiel: "über öffentlichen Wirtschaftsweg" },
  { key: "preis", label: "Preis- bzw. Pachtvorstellung", tipp: "Z. B. „VB 400 €/ha und Jahr“ oder „Preis auf Anfrage“", beispiel: "VB 400 €/ha und Jahr" },
];

export type BoerseEintrag = {
  code: string;
  art: BoerseArt;
  typ: string;
  groesseHa: number | null;
  lage: string;
  text: string;
  seit: string;
  details?: BoerseDetails;
  /** Fläche des Geschäftsführers von Lippe Forst bzw. seiner Familie — offengelegt, ohne Provision. */
  eigen?: boolean;
  /** Mehrere Flächen desselben Eigentümers, gleicher Art, gleichen Typs, gleiche Gemeinde → ein Paket. */
  paket?: string;
};

export function zahlDe(n: number, stellen = 2): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: stellen });
}

/** Öffentliche Größe — gerundet (bis 5 ha auf 0,5 ha, bis 20 ha auf 1 ha, darüber auf 5 ha). */
/**
 * Größe für die öffentliche Datei gerundet (Review S8): Die genaue Fläche erscheint nie auf der Website —
 * auch nicht im Seitenquelltext —, sonst ließe sich das Flurstück im Kataster suchen.
 */
export function oeffentlicheHa(ha: number | null): number | null {
  if (ha == null || !Number.isFinite(ha) || ha <= 0) return null;
  if (ha < 0.25) return 0.2;
  return ha <= 5 ? Math.max(0.5, Math.round(ha * 2) / 2) : ha <= 20 ? Math.round(ha) : Math.round(ha / 5) * 5;
}

export function haText(ha: number | null): string {
  if (ha == null || !Number.isFinite(ha) || ha <= 0) return "Größe auf Anfrage";
  if (ha < 0.25) return "unter 0,5 ha";
  const r = ha <= 5 ? Math.max(0.5, Math.round(ha * 2) / 2) : ha <= 20 ? Math.round(ha) : Math.round(ha / 5) * 5;
  return `ca. ${zahlDe(r, 1)} ha`;
}

export function artText(art: BoerseArt): { eyebrow: string; verb: string; zahler: string } {
  return art === "pacht" ? { eyebrow: "Zur Pacht", verb: "zu pachten", zahler: "Pächter" } : { eyebrow: "Zum Kauf", verb: "zu kaufen", zahler: "Käufer" };
}

/** Käuferprovision als kurzer, vollständiger Hinweis (Gesamtpreis inkl. USt genau, wie im Vertrag). */
export function provisionHinweis(k: Konditionen): string {
  if (k.ust.kauf === "zuzueglich") {
    const brutto = Math.round(k.kaufProzent * (1 + k.ustProzent / 100) * 10000) / 10000;
    return `${zahlDe(k.kaufProzent, 4)} % des Kaufpreises zzgl. ${zahlDe(k.ustProzent)} % USt (${zahlDe(brutto, 4)} % inkl. USt)`;
  }
  return `${zahlDe(k.kaufProzent, 4)} % des Kaufpreises inkl. ${zahlDe(k.ustProzent)} % USt`;
}

/** Pächterprovision als kurzer, vollständiger Hinweis. */
export function provisionHinweisPacht(k: Konditionen): string {
  const n = k.pachtJahrespachten;
  const menge = n === 1 ? "eine volle Jahrespacht" : `das ${zahlDe(n)}-Fache einer vollen Jahrespacht`;
  if (k.ust.pacht === "zuzueglich") {
    const brutto = Math.round(n * (1 + k.ustProzent / 100) * 10000) / 100;
    return `${menge} zzgl. ${zahlDe(k.ustProzent)} % USt (${zahlDe(brutto)} % einer Jahrespacht inkl. USt)`;
  }
  return `${menge} inkl. ${zahlDe(k.ustProzent)} % USt`;
}

export function standardProvision(art: BoerseArt): string {
  return art === "pacht" ? provisionHinweisPacht(STANDARD_KONDITIONEN) : provisionHinweis(STANDARD_KONDITIONEN);
}

/** Öffentliche Lage: nur Gemeinde bzw. Raum — Zusätze in Klammern (Ortsteile, Gemarkungen) fallen weg. */
export function oeffentlicheLage(lage: string): string {
  return lage.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function enthaeltVerraeterisches(text: string, name: string): string[] {
  const t = text.toLowerCase();
  const fehlt: string[] = [];
  if (/flur|gemarkung|\b\d{1,4}\s*\/\s*\d{1,4}\b/.test(t)) fehlt.push("Lage oder Text enthält Flur-/Flurstücksangaben");
  if (/stra(ss|ß)e|\bweg\s+\d|\bstr\.\s*\d|@|\+?\d[\d\s/-]{6,}/.test(t)) fehlt.push("Lage oder Text enthält eine Adresse, E-Mail oder Telefonnummer");
  const namensteile = (name || "").replace(/\([^)]*\)/g, " ").split(/[\s,.-]+/).filter((x) => x.length >= 3 && x !== "—");
  if (namensteile.some((x) => t.includes(x.toLowerCase()))) fehlt.push("Lage oder Text enthält den Namen des Eigentümers");
  return fehlt;
}

/** Was einer Veröffentlichung im Weg steht (leer = darf online). */
export function boerseLuecken(b: BoerseMeta | undefined, l: LeadView): string[] {
  const fehlt: string[] = [];
  if (l.rolle !== "angebot" || (l.art !== "kauf" && l.art !== "pacht")) fehlt.push("nur Angebote (Rolle „Angebot“, Art „Kauf“ oder „Pacht“) kommen in die Börse");
  if (l.status === "archiv" || l.status === "erledigt") fehlt.push("die Anfrage ist erledigt oder archiviert");
  if (l.meta.weg === "ankauf") fehlt.push("für diese Fläche ist der Direktankauf gewählt — sie wird nicht vermittelt");
  if (!b) return [...fehlt, "noch keine Angaben für die Börse gespeichert"];
  if (!b.einwilligung) fehlt.push("Einwilligung des Eigentümers fehlt");
  if (!b.typ) fehlt.push("Flächentyp fehlt");
  if (!b.groesseHa || b.groesseHa <= 0) fehlt.push("ungefähre Größe fehlt");
  if (!oeffentlicheLage(b.lage)) fehlt.push("grobe Lage fehlt");
  const details = Object.values(b.details ?? {}).filter(Boolean).join(" ");
  fehlt.push(...enthaeltVerraeterisches(`${oeffentlicheLage(b.lage)} ${b.text} ${details}`, l.name));
  return fehlt;
}

/** Nur die ausgefüllten Zusatzangaben, gekürzt. */
export function detailsBereinigen(d: BoerseDetails | undefined): BoerseDetails | undefined {
  if (!d) return undefined;
  const out: BoerseDetails = {};
  for (const f of DETAIL_FELDER) {
    const v = (d[f.key] ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (v) out[f.key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Angebote für die Anzeige zusammenfassen: Pakete als eine Gruppe, sonst einzeln (Reihenfolge bleibt). */
export function gruppieren(angebote: BoerseEintrag[]): BoerseEintrag[][] {
  const gruppen: BoerseEintrag[][] = [];
  const nachPaket = new Map<string, BoerseEintrag[]>();
  for (const a of angebote) {
    if (a.paket) {
      const g = nachPaket.get(a.paket);
      if (g) {
        g.push(a);
        continue;
      }
      const neu = [a];
      nachPaket.set(a.paket, neu);
      gruppen.push(neu);
    } else gruppen.push([a]);
  }
  return gruppen;
}

/** Summe der Größen eines Pakets (gerundet angezeigt). */
export function paketGroesse(teile: BoerseEintrag[]): number | null {
  const werte = teile.map((t) => t.groesseHa).filter((x): x is number => typeof x === "number" && x > 0);
  return werte.length ? werte.reduce((a, b) => a + b, 0) : null;
}
