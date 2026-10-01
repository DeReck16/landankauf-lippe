import "server-only";
import type { KatasterDaten, LeadView } from "@/lib/admin/model";
import { mutateZustand } from "@/lib/admin/store";
import * as T from "./texte";

// Amtliche Daten zu einem Flurstück in NRW: ALKIS (OGC API Features, Geobasis NRW)
// liefert Fläche, Nutzung und Lage, BORIS NRW (WMS GetFeatureInfo) den Bodenrichtwert
// am Flurstück. Beides sind offene Dienste des Landes NRW ohne Schlüssel. Genutzt für
// Antwortentwürfe (Wertindikation, lib/portal/antwort.ts) und fürs Einstellen eigener
// Flächen (app/admin/(intern)/flaechen-einstellen). Ergebnisse werden je Anfrage in
// LeadMeta.kataster gemerkt — abgefragt wird nur einmal (bzw. wenn sich Ort oder
// Flurstück ändern). Außerhalb NRW gibt es keine Treffer. Der Bodenrichtwert gilt je
// Nutzungsart (Acker „A“ / Grünland „GR“ liegen als getrennte, überlappende Zonen
// übereinander): brwAusAntwort wählt die Zone zur Flächenart der Anfrage.

const ALKIS = "https://ogc-api.nrw.de/lika/v1/collections/flurstueck/items";
const BORIS = "https://www.wms.nrw.de/boris/wms_nw_brw";
const BORIS_LAYER = { landwirtschaft: "8", forstwirtschaft: "11", wohnbau: "20" } as const;
export type BrwArt = keyof typeof BORIS_LAYER;

export type FlurstueckAngabe = { flur: string | null; zaehler: string; nenner: string | null };
export type FlurstueckTreffer = NonNullable<KatasterDaten["flurstueck"]>;
export type BrwTreffer = NonNullable<KatasterDaten["brw"]>;

/** „Flur 20 Flurstück 78“, „Flur 3, Flst. 113/2“, „Flurstück 78“ → Flur, Zähler, Nenner. */
export function flurstueckAusText(text: string): FlurstueckAngabe | null {
  const t = text.replace(/\s+/g, " ");
  const nr = /(?:flurst(?:ü|ue)ck(?:e|s)?|flst\.?|nr\.?)\s*(\d{1,5})(?:\s*\/\s*(\d{1,4}))?/i.exec(t);
  if (!nr) return null;
  const flur = /\bflur\s*(\d{1,3})\b/i.exec(t)?.[1] ?? null;
  return { flur: flur ? String(Number(flur)) : null, zaehler: String(Number(nr[1])), nenner: nr[2] ? String(Number(nr[2])) : null };
}

/**
 * Kandidaten für Gemarkung bzw. Gemeinde aus dem Ortstext — Teile zuerst, der ganze Text zuletzt
 * („Horn-Bad Meinberg (Leopoldstal)“ → Leopoldstal, Horn-Bad Meinberg; „Almena/Extertal“ → Almena, Extertal).
 */
function ortKandidaten(ort: string): string[] {
  const teile = ort
    .split(/[\/,;()]|\s+-\s+|\s+(?:und|bei|ot|ortsteil)\s+/i)
    .map((s) => s.replace(/^(gemarkung|gemeinde|stadt|ot\.?|ortsteil)\s+/i, "").trim())
    .filter((s) => s.length >= 3 && s.length <= 60 && !/\d/.test(s));
  // Kürzere Teile (meist Ortsteil = Gemarkung) vor längeren, der ganze Text nur, wenn er selbst ein Name sein kann.
  const ganz = ort.trim();
  const liste = [...teile.sort((a, b) => a.length - b.length), ...(/[\/,;()]/.test(ganz) ? [] : [ganz])];
  return [...new Set(liste.filter((s) => s.length >= 3 && s.length <= 60))].slice(0, 4);
}

const zitat = (s: string) => `'${s.replace(/'/g, "''")}'`;

type AlkisFeature = { id?: string; properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } };

async function alkisSuchen(filter: string, ms: number): Promise<AlkisFeature[]> {
  const url = `${ALKIS}?${new URLSearchParams({ filter, "filter-lang": "cql2-text", f: "json", limit: "10" })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-store", headers: { Accept: "application/geo+json, application/json" } });
  if (!res.ok) return [];
  const d = (await res.json()) as { features?: AlkisFeature[] };
  return Array.isArray(d.features) ? d.features : [];
}

/** Mittelpunkt des (ersten) äußeren Rings — genügt, um die Bodenrichtwertzone zu treffen. */
function mitte(g: AlkisFeature["geometry"]): [number, number] | null {
  if (!g) return null;
  const ring = (g.type === "Polygon" ? (g.coordinates as number[][][])[0] : g.type === "MultiPolygon" ? (g.coordinates as number[][][][])[0]?.[0] : null) ?? null;
  if (!ring?.length) return null;
  const xs = ring.map((c) => c[0]);
  const ys = ring.map((c) => c[1]);
  return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
}

/** „Landwirtschaft;60000|Wald;13218“ → die flächengrößte Nutzung. */
function hauptnutzung(tntxt: string): string {
  const teile = tntxt
    .split("|")
    .map((x) => {
      const [name, flaeche] = x.split(";");
      return { name: (name ?? "").trim(), flaeche: Number(flaeche) || 0 };
    })
    .filter((x) => x.name);
  return teile.sort((a, b) => b.flaeche - a.flaeche)[0]?.name ?? "";
}

function treffer(f: AlkisFeature): FlurstueckTreffer | null {
  const p = f.properties ?? {};
  const punkt = mitte(f.geometry);
  if (!punkt) return null;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : p[k] != null ? String(p[k]) : "");
  const nenner = s("flstnrnen");
  return {
    gemarkung: s("gemarkung"),
    gemeinde: s("gemeinde"),
    kreis: s("kreis"),
    flur: s("flur").replace(/^0+/, ""),
    nummer: nenner ? `${s("flstnrzae")}/${nenner}` : s("flstnrzae"),
    flaecheM2: Math.round(Number(p.flaeche) || 0),
    nutzung: hauptnutzung(s("tntxt")),
    lage: s("lagebeztxt"),
    punkt: [Math.round(punkt[0] * 1e6) / 1e6, Math.round(punkt[1] * 1e6) / 1e6],
  };
}

/**
 * Flurstück im ALKIS NRW suchen — über Gemeinde oder Gemarkung aus dem Ortstext. Nur ein
 * eindeutiger Treffer zählt (sonst null mit Grund). Flur wird mit und ohne führende Nullen gesucht.
 */
export async function flurstueckSuchen(ortText: string, a: FlurstueckAngabe, ms = 12_000): Promise<{ treffer: FlurstueckTreffer | null; grund?: string }> {
  const kandidaten = ortKandidaten(ortText);
  if (kandidaten.length === 0) return { treffer: null, grund: "Kein Ort bzw. keine Gemarkung angegeben." };
  const bis = Date.now() + ms;
  let stoerung = false;
  const bedingungen = [
    ...(a.flur ? [`(flur=${zitat(a.flur)} OR flur=${zitat(a.flur.padStart(3, "0"))})`] : []),
    `flstnrzae=${zitat(a.zaehler)}`,
    ...(a.nenner ? [`flstnrnen=${zitat(a.nenner)}`] : []),
  ];
  for (const k of kandidaten) {
    const rest = bis - Date.now();
    if (rest < 500) break;
    let features: AlkisFeature[];
    try {
      // Der Dienst braucht je Suche etwa 4–6 s (gemessen 25.09.2026) — höchstens 9 s je Kandidat.
      features = await alkisSuchen([`(gemarkung=${zitat(k)} OR gemeinde=${zitat(k)})`, ...bedingungen].join(" AND "), Math.min(rest, 9000));
    } catch (err) {
      console.error("[kataster] ALKIS-Suche abgebrochen", k, err);
      stoerung = true;
      continue;
    }
    // Ohne Nenner: Flurstücke mit Nenner nur, wenn es kein Flurstück ohne Nenner gibt.
    const liste = a.nenner ? features : features.filter((f) => !f.properties?.flstnrnen).length ? features.filter((f) => !f.properties?.flstnrnen) : features;
    const eindeutig = [...new Map(liste.map((f) => [String(f.properties?.flurstid ?? f.id), f])).values()];
    if (eindeutig.length === 1) {
      const t = treffer(eindeutig[0]);
      if (t) return { treffer: t };
    }
    if (eindeutig.length > 1) return { treffer: null, grund: `${eindeutig.length} Flurstücke passen zu „${k}“${a.flur ? "" : " (Flur fehlt)"} — nicht eindeutig.` };
  }
  if (stoerung) return { treffer: null, grund: "Kataster (ALKIS NRW) gerade nicht erreichbar." };
  return { treffer: null, grund: "Flurstück im Kataster NRW nicht gefunden (Ort, Flur oder Nummer prüfen; außerhalb NRW gibt es keine Daten)." };
}

function zahl(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nutzungsart der Bodenrichtwertzone (BORIS-Feld NUTA), auf die es bei landwirtschaftlichen Flächen ankommt: Acker oder Grünland. */
export type BrwNutzung = "A" | "GR";

/** NUTA „L“: eine Zone für Landwirtschaft ohne Unterscheidung von Acker und Grünland (z. B. Kreis Heinsberg) — gilt für beides. */
const SAMMELZONE = "L";

/**
 * Welche Zone der Landwirtschaftsschicht gilt für die Fläche — nach dem Flächentyp der Anfrage, sonst nach einer
 * ausdrücklich genannten amtlichen Nutzung (ALKIS NRW nennt meist nur „Landwirtschaft“ → null = nicht eindeutig).
 * Null auch für Wald und Bauland (andere Schichten, siehe brwArtFuer).
 */
export function brwNutzungFuer(flaechentyp: string, nutzung: string): BrwNutzung | null {
  if (brwArtFuer(flaechentyp, nutzung) !== "landwirtschaft") return null;
  if (/acker/i.test(flaechentyp)) return "A";
  if (/wiese|gr(ü|ue)nland|weide/i.test(flaechentyp)) return "GR";
  if (/acker/i.test(nutzung)) return "A";
  if (/gr(ü|ue)nland|wiese|weide/i.test(nutzung)) return "GR";
  return null;
}

/**
 * Zone aus einer GetFeatureInfo-Antwort wählen. BORIS liefert je Punkt mehrere überlappende Zonen — in der
 * Landwirtschaftsschicht je eine für Acker („A“) und Grünland („GR“), in jedem Gebiet in anderer Reihenfolge
 * (Gemarkung Horn: Grünland zuerst, Belle: Acker zuerst). Gewählt wird die Zone mit der gewünschten Nutzungsart,
 * sonst eine Sammelzone („L“). Gibt es keine passende, gilt die erste (ohne Wunsch bevorzugt Acker, wie der
 * Antwortentwurf bei unklarer Flächenart) — das Ergebnis hält fest, was gesucht war (`gewuenscht`) und was
 * gewählt wurde (`nuta`), damit die Verwaltung die Abweichung sieht.
 */
export function brwAusAntwort(antwort: unknown, art: BrwArt, gewuenscht: BrwNutzung | null): BrwTreffer | null {
  const features = (antwort as { features?: unknown } | null)?.features;
  const zonen = (Array.isArray(features) ? features : [])
    .map((f) => (f as { properties?: unknown } | null)?.properties)
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null && zahl((p as Record<string, unknown>).BRW) !== null);
  if (zonen.length === 0) return null;
  const nuta = (p: Record<string, unknown>) => String(p.NUTA ?? "").trim().toUpperCase();
  const p =
    art === "landwirtschaft"
      ? ((gewuenscht ? zonen.find((z) => nuta(z) === gewuenscht) : null) ??
        zonen.find((z) => nuta(z) === SAMMELZONE) ??
        (gewuenscht ? null : zonen.find((z) => nuta(z) === "A")) ??
        zonen[0])
      : zonen[0];
  return {
    wert: zahl(p.BRW)!,
    stichtag: String(p.STAG ?? "").slice(0, 10),
    art,
    nuta: nuta(p),
    ...(art === "landwirtschaft" && gewuenscht ? { gewuenscht } : {}),
    zone: String(p.BRWZNR ?? "").trim(),
    gutachterausschuss: String(p.GABE ?? "").trim(),
    gemarkungen: String(p.GEMA ?? "").trim(),
  };
}

/** Bodenrichtwert am Punkt (BORIS NRW, aktueller Stichtag) — „fehler“, wenn der Dienst nicht antwortet. */
export async function bodenrichtwert(punkt: [number, number], art: BrwArt, gewuenscht: BrwNutzung | null, ms = 5000): Promise<BrwTreffer | null | "fehler"> {
  const [lon, lat] = punkt;
  const d = 0.0005;
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetFeatureInfo",
    LAYERS: BORIS_LAYER[art],
    QUERY_LAYERS: BORIS_LAYER[art],
    CRS: "CRS:84",
    BBOX: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    WIDTH: "101",
    HEIGHT: "101",
    I: "50",
    J: "50",
    INFO_FORMAT: "application/geo+json",
    // Mehr als die zwei üblichen Zonen (Acker, Grünland), damit die gesuchte Nutzungsart nie abgeschnitten wird.
    FEATURE_COUNT: "10",
  });
  try {
    const res = await fetch(`${BORIS}?${params}`, { signal: AbortSignal.timeout(ms), cache: "no-store" });
    if (!res.ok) return "fehler";
    return brwAusAntwort(await res.json(), art, gewuenscht);
  } catch (err) {
    console.error("[kataster] BORIS nicht erreichbar", err);
    return "fehler";
  }
}

/** Vorübergehende Störung — solche Ergebnisse werden nicht gemerkt, beim nächsten Mal wird neu gefragt. */
const STOERUNG = /nicht erreichbar/;

/** Nach einem Jahr wird jeder Eintrag neu abgefragt. */
const JAHR_MS = 365 * 86_400_000;

/** Welche Bodenrichtwertart passt — nach Flächentyp der Anfrage, sonst nach der amtlichen Nutzung. */
export function brwArtFuer(flaechentyp: string, nutzung: string): BrwArt {
  if (/wald|forst/i.test(flaechentyp) || (!/acker|wiese|grünland|bauland/i.test(flaechentyp) && /wald|gehölz|forst/i.test(nutzung))) return "forstwirtschaft";
  if (/bauland/i.test(flaechentyp) || (!/acker|wiese|grünland|wald/i.test(flaechentyp) && /wohnbau|wohn|gemischt/i.test(nutzung))) return "wohnbau";
  return "landwirtschaft";
}

/** Schlüssel der Suche — ändert sich Ort (auch die Übersteuerung) oder Flurstück, wird neu gesucht. */
export function katasterSchluessel(l: LeadView): string {
  return `${(l.ortText || T.wert(l.ort)).trim()}|${T.wert(l.flurstueck)}`;
}

/**
 * Muss der gespeicherte Bodenrichtwert neu abgefragt werden, weil die Zone nicht nach Nutzungsart gewählt wurde?
 * Gilt für Einträge der Landwirtschaftsschicht ohne `nuta` (Abfrage vor dem 01.10.2026: immer die erste Zone, in
 * Gemarkung Horn Grünland statt Acker) und wenn für die Anfrage inzwischen eine andere Nutzungsart gilt als beim
 * Abfragen (Flächentyp geändert). Nach der Neuabfrage steht `nuta` (auch leer) — so entsteht keine Schleife.
 */
export function brwNeuAbfragen(l: LeadView): boolean {
  const k = l.meta.kataster;
  const b = k?.brw;
  if (!k || !b || b.art !== "landwirtschaft") return false;
  if (b.nuta === undefined) return true;
  return (b.gewuenscht ?? null) !== brwNutzungFuer(l.typ, k.flurstueck?.nutzung ?? "");
}

/**
 * Braucht die Anfrage (noch) eine Kataster-Abfrage? Nur mit Flurstück, einmal je Angabe, spätestens jährlich neu —
 * und neu, wenn der Bodenrichtwert noch ohne Wahl der Nutzungsart gespeichert ist (brwNeuAbfragen). Die Neuabfrage
 * ändert nur `LeadMeta.kataster`: kein Status, kein Verlauf, keine Mail an Kunden oder Verwaltung.
 */
export function katasterFaellig(l: LeadView, jetzt = Date.now()): boolean {
  if (!T.wert(l.flurstueck) || !flurstueckAusText(T.wert(l.flurstueck))) return false;
  const k = l.meta.kataster;
  return !k || k.schluessel !== katasterSchluessel(l) || jetzt - Date.parse(k.am) > JAHR_MS || brwNeuAbfragen(l);
}

/** Flurstück + Bodenrichtwert für eine Anfrage abfragen (ohne Speichern). */
export async function katasterAbfragen(l: LeadView, ms = 16_000): Promise<KatasterDaten> {
  const am = new Date().toISOString();
  const schluessel = katasterSchluessel(l);
  const angabe = flurstueckAusText(T.wert(l.flurstueck));
  if (!angabe) return { am, schluessel, flurstueck: null, brw: null, hinweis: "Flurstücksangabe nicht lesbar." };
  const start = Date.now();
  // Ist nur die Bodenrichtwert-Zone veraltet (brwNeuAbfragen) und das Flurstück schon gespeichert, wird ALKIS nicht
  // noch einmal gefragt: schneller, und ein Aussetzer des Dienstes (HTTP-Fehler zählt dort als „nicht gefunden“)
  // kann einen guten Eintrag nicht überschreiben. `am` bleibt dann das Datum der Flurstück-Abfrage.
  const alt = l.meta.kataster;
  const behalten = alt?.flurstueck && alt.schluessel === schluessel && Date.now() - Date.parse(alt.am) <= JAHR_MS && brwNeuAbfragen(l) ? alt : null;
  const { treffer: fs, grund } = behalten?.flurstueck ? { treffer: behalten.flurstueck, grund: undefined } : await flurstueckSuchen(l.ortText || T.wert(l.ort), angabe, Math.max(1500, ms - 3000));
  const stand = behalten?.am ?? am;
  if (!fs) return { am, schluessel, flurstueck: null, brw: null, hinweis: grund };
  const brw = await bodenrichtwert(fs.punkt, brwArtFuer(l.typ, fs.nutzung), brwNutzungFuer(l.typ, fs.nutzung), Math.max(1500, ms - (Date.now() - start)));
  if (brw === "fehler") return { am: stand, schluessel, flurstueck: fs, brw: null, hinweis: "Bodenrichtwert (BORIS NRW) gerade nicht erreichbar." };
  return { am: stand, schluessel, flurstueck: fs, brw, ...(brw ? {} : { hinweis: "Kein Bodenrichtwert für diese Lage gefunden." }) };
}

/** Ergebnisse im Verwaltungszustand merken (ohne Eintrag im Verlauf). */
export async function katasterMerken(ergebnisse: Record<string, KatasterDaten>): Promise<void> {
  const ids = Object.keys(ergebnisse);
  if (ids.length === 0) return;
  await mutateZustand("Kataster", (z) => {
    for (const id of ids) z.anfragen[id] = { ...(z.anfragen[id] ?? {}), kataster: ergebnisse[id] };
  });
}

/**
 * Welche Anfragen der tägliche Lauf (app/api/cron/taeglich) auf Kataster-Daten prüft: zuerst die, für die gerade ein
 * Antwortentwurf gebraucht wird (neu, ohne Rolle bzw. Beratungswunsch), danach offene Anfragen mit Bodenrichtwert
 * ohne Nutzungsart (Altbestand, auch Anbieter und laufende Vorgänge — der Wert steht in der Anfrage und in
 * Einladungsentwürfen). Erledigte und archivierte Anfragen bleiben, wie sie sind. Gefragt wird nur, was
 * katasterFaellig meldet, höchstens 8 je Lauf (katasterNachholen).
 */
export function katasterKandidaten(leads: LeadView[]): LeadView[] {
  const fuerEntwurf = leads.filter((l) => l.status === "neu" && (l.meta.rueckmeldung?.art === "beratung" || !T.rolleVonLead(l)));
  const altbestand = leads.filter((l) => l.status !== "erledigt" && l.status !== "archiv" && !fuerEntwurf.includes(l) && brwNeuAbfragen(l));
  return [...fuerEntwurf, ...altbestand];
}

/** Für mehrere Anfragen parallel abfragen und merken — mit Zeitbudget (Dashboard, Formular-Eingang). */
export async function katasterNachholen(leads: LeadView[], budgetMs = 16_000): Promise<Record<string, KatasterDaten>> {
  const offen = leads.filter((l) => katasterFaellig(l)).slice(0, 8);
  if (offen.length === 0) return {};
  const ergebnisse: Record<string, KatasterDaten> = {};
  await Promise.all(
    offen.map(async (l) => {
      try {
        ergebnisse[l.id] = await katasterAbfragen(l, budgetMs);
      } catch (err) {
        console.error("[kataster] Abfrage fehlgeschlagen", l.id, err);
      }
    }),
  );
  try {
    // Störungen nicht merken — sonst würde ein Ausfall des Dienstes ein Jahr lang nachwirken.
    await katasterMerken(Object.fromEntries(Object.entries(ergebnisse).filter(([, e]) => !STOERUNG.test(e.hinweis ?? ""))));
  } catch (err) {
    console.error("[kataster] nicht gespeichert", err);
  }
  return ergebnisse;
}
