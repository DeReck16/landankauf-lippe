import { distanzKm, istTreffer, orteAusText, ortKey } from "./geo";
import { formatGroesse, paarKey, type GeoTreffer, type Groesse, type LeadView, type MatchMeta, type Zustand } from "./model";

// Angebot ↔ Gesuch: gleiche Art (Kauf/Pacht) ist Pflicht, der Flächentyp muss
// zusammenpassen, der Ort in Reichweite liegen. Die Größe beeinflusst nur die
// Punktzahl — lieber ein Vorschlag zu viel als ein passendes Paar übersehen.

export type OrtPunkt = GeoTreffer & { teil: string };

export type Kandidat = {
  key: string;
  angebot: LeadView;
  gesuch: LeadView;
  score: number | null;
  distanzKm: number | null;
  gruende: string[];
  hinweise: string[];
  meta: MatchMeta | null;
};

const INAKTIV = new Set(["archiv", "erledigt"]);
const FELD = new Set(["Ackerland", "Wiese / Grünland"]);

export function punkteFuer(lead: LeadView, orte: Zustand["orte"]): { punkte: OrtPunkt[]; offen: string[]; unbekannt: string[] } {
  const punkte: OrtPunkt[] = [];
  const offen: string[] = [];
  const unbekannt: string[] = [];
  for (const teil of orteAusText(lead.ortText)) {
    const e = orte[ortKey(teil)];
    if (!e) offen.push(teil);
    else if (istTreffer(e)) punkte.push({ ...e, teil });
    else unbekannt.push(teil);
  }
  return { punkte, offen, unbekannt };
}

/** Grobe Ortsangabe für anonyme Texte: Gemeinde statt Ortsteil oder Flurstück. */
export function grobeLage(lead: LeadView, orte: Zustand["orte"]): string {
  const { punkte } = punkteFuer(lead, orte);
  if (lead.rolle === "gesuch") return [...new Set(punkte.map((p) => p.gemeinde || p.teil))].join(", ");
  const p = angebotsPunkt(punkte);
  return p ? p.gemeinde || p.teil : "";
}

/** Ein Angebot liegt an EINEM Ort: der genaueste Treffer, der zum ersten passt. */
function angebotsPunkt(punkte: OrtPunkt[]): OrtPunkt | null {
  if (punkte.length === 0) return null;
  const anker = punkte[0];
  const nahe = punkte.filter((p) => distanzKm(p, anker) <= 30);
  return nahe.reduce((best, p) => (p.ausdehnungKm < best.ausdehnungKm ? p : best), nahe[0]);
}

function typScore(a: string, g: string): number {
  if (a === g) return 1;
  if (FELD.has(a) && FELD.has(g)) return 0.5;
  if (a === "Sonstiges" || g === "Sonstiges") return 0.4;
  return 0;
}

function groesseScore(angebot: Groesse, gesuch: Groesse): { score: number; text: string } {
  const ha = angebot.maxHa ?? angebot.minHa;
  const offerText = formatGroesse(angebot);
  const wishText = formatGroesse(gesuch);
  if (ha == null || (gesuch.minHa == null && gesuch.maxHa == null)) {
    return { score: 0.6, text: `Größe nicht vergleichbar (${offerText} ↔ gesucht ${wishText})` };
  }
  let verhaeltnis: number;
  if (gesuch.minHa != null && gesuch.minHa === gesuch.maxHa) {
    // Eine einzelne Zahl im Gesuch ist meist eine Richtgröße, keine harte Grenze.
    const r = ha / gesuch.minHa;
    verhaeltnis = r >= 0.66 && r <= 1.5 ? 1 : Math.min(r, 1 / r);
  } else {
    const lo = gesuch.minHa ?? 0;
    const hi = gesuch.maxHa ?? Number.POSITIVE_INFINITY;
    verhaeltnis = ha >= lo && ha <= hi ? 1 : ha < lo ? ha / lo : hi / ha;
  }
  if (verhaeltnis >= 1) return { score: 1, text: `Größe passt (${offerText}, gesucht ${wishText})` };
  if (verhaeltnis >= 0.5) return { score: 0.6, text: `Größe knapp daneben (${offerText}, gesucht ${wishText})` };
  return { score: 0.2, text: `Größe passt kaum (${offerText}, gesucht ${wishText})` };
}

function bewerten(angebot: LeadView, gesuch: LeadView, orte: Zustand["orte"]): Omit<Kandidat, "key" | "meta"> | null {
  if (!angebot.art || angebot.art !== gesuch.art) return null;
  if (angebot.email !== "—" && angebot.email.toLowerCase() === gesuch.email.toLowerCase()) return null;
  const typ = typScore(angebot.typ, gesuch.typ);
  if (typ === 0) return null;

  const a = angebotsPunkt(punkteFuer(angebot, orte).punkte);
  const gesuchPunkte = punkteFuer(gesuch, orte).punkte;
  if (!a || gesuchPunkte.length === 0) return null;

  let bester: { d: number; rel: number; g: OrtPunkt } | null = null;
  for (const g of gesuchPunkte) {
    const d = distanzKm(a, g);
    const reichweite = gesuch.radiusKm + g.ausdehnungKm + a.ausdehnungKm;
    const rel = d / reichweite;
    if (!bester || rel < bester.rel) bester = { d, rel, g };
  }
  if (!bester || bester.rel > 1) return null;

  const dist = 1 - 0.8 * bester.rel;
  const groesse = groesseScore(angebot.groesseWert, gesuch.groesseWert);
  const score = Math.round(100 * (0.45 * dist + 0.35 * typ + 0.2 * groesse.score));

  const art = angebot.art === "pacht" ? "Pacht" : "Kauf";
  const gruende = [
    `${art} ↔ ${art}`,
    typ === 1 ? `${angebot.typ} ↔ ${gesuch.typ}` : `${angebot.typ} ↔ gesucht ${gesuch.typ} (verwandt)`,
    `${Math.round(bester.d)} km Luftlinie (${a.gemeinde || a.teil} ↔ ${bester.g.teil}, Suchradius ${gesuch.radiusKm} km)`,
    groesse.text,
  ];
  const hinweise: string[] = [];
  if (angebot.groesseWert.unsicher || gesuch.groesseWert.unsicher) hinweise.push("Größenangabe unsicher gelesen — bitte in der Anfrage prüfen.");
  return { angebot, gesuch, score, distanzKm: Math.round(bester.d), gruende, hinweise };
}

export function findeKandidaten(leads: LeadView[], zustand: Zustand): { kandidaten: Kandidat[]; ohneOrt: LeadView[] } {
  const aktiv = leads.filter((l) => !INAKTIV.has(l.status));
  const angebote = aktiv.filter((l) => l.rolle === "angebot");
  const gesuche = aktiv.filter((l) => l.rolle === "gesuch");
  const kandidaten = new Map<string, Kandidat>();

  for (const angebot of angebote) {
    for (const gesuch of gesuche) {
      const key = paarKey(angebot.id, gesuch.id);
      const meta = zustand.paare[key] ?? null;
      if (meta?.status === "verworfen") continue;
      const b = bewerten(angebot, gesuch, zustand.orte);
      if (!b || (b.score ?? 0) < 25) continue;
      kandidaten.set(key, { key, meta, ...b });
    }
  }

  // Bereits bearbeitete Paare immer zeigen — auch wenn sie nach geänderten
  // Angaben rechnerisch nicht mehr passen oder eine Seite erledigt ist.
  const byId = new Map(leads.map((l) => [l.id, l]));
  for (const [key, meta] of Object.entries(zustand.paare)) {
    if (kandidaten.has(key)) continue;
    const [aId, gId] = key.split("~");
    const angebot = byId.get(aId);
    const gesuch = byId.get(gId);
    if (!angebot || !gesuch) continue;
    const b = bewerten(angebot, gesuch, zustand.orte);
    kandidaten.set(key, {
      key,
      meta,
      angebot,
      gesuch,
      score: b?.score ?? null,
      distanzKm: b?.distanzKm ?? null,
      gruende: b?.gruende ?? [],
      hinweise: b ? b.hinweise : ["Passt nach den aktuellen Angaben nicht mehr automatisch — manuell gepflegt."],
    });
  }

  // Interesse über die Flächenbörse: Das Paar ist gewollt, auch wenn Ort oder Größe rechnerisch nicht passen.
  for (const k of kandidaten.values()) {
    const code = k.angebot.meta.boerse?.code;
    if (!code || k.gesuch.boerse !== code) continue;
    k.gruende = [`Interesse über die Flächenbörse (${code})`, ...k.gruende];
    k.hinweise = k.hinweise.filter((h) => !h.startsWith("Passt nach den aktuellen Angaben nicht mehr"));
  }

  const ohneOrt = [...angebote, ...gesuche].filter((l) => punkteFuer(l, zustand.orte).punkte.length === 0);
  const sortiert = [...kandidaten.values()].sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
  return { kandidaten: sortiert, ohneOrt };
}
