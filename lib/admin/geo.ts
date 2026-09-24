import "server-only";
import type { GeoEintrag, GeoTreffer, Zustand } from "./model";

// Ortsnamen → Koordinaten über Nominatim (OpenStreetMap). Nur Ortsnamen gehen
// raus, keine Personendaten. Nutzungsregeln: höchstens 1 Anfrage pro Sekunde,
// eindeutiger User-Agent, Ergebnisse cachen (liegen in zustand.orte).

const USER_AGENT = "lippeforst.de-verwaltung/1.0 (+https://lippeforst.de/kontakt)";
// Grob Ostwestfalen-Lippe und Umland — bevorzugt, aber nicht erzwungen.
const VIEWBOX = "7.6,52.7,9.9,51.3";

export function ortKey(teil: string): string {
  return teil.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Freitext in einzelne Orte zerlegen: „Lage, Lemgo / Kalletal und Bad Salzuflen“. */
export function orteAusText(text: string): string[] {
  if (!text || text === "—") return [];
  const teile = text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(flur|flurstück|flurstueck|flst)\.?\s*[\d/ ,.-]*/gi, " ")
    // „Kreis Lippe“ bleibt stehen: Nominatim kennt den Kreis und liefert seine Ausdehnung.
    .replace(/\b(raum|region|umkreis|umgebung|nähe|naehe|nahe|bei|um|im|in der|gemarkung|gemeinde|ortsteil|ot|stadt)\b\.?/gi, " ")
    .replace(/\b\d{1,3}\s*km\b/gi, " ")
    .split(/[,;/+&|]|\bund\b|\boder\b|\bsowie\b|\bu\.\s/i)
    .map((s) => s.replace(/\s+/g, " ").replace(/^[\s.-]+|[\s.-]+$/g, "").trim())
    .filter((s) => (s.length >= 3 && !/^\d+$/.test(s)) || /^\d{5}$/.test(s));
  return [...new Set(teile)].slice(0, 6);
}

export function distanzKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string];
  address?: Record<string, string>;
};

export async function nominatim(teil: string): Promise<GeoEintrag> {
  const am = new Date().toISOString();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", teil);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "de");
  url.searchParams.set("viewbox", VIEWBOX);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];
  const hit = hits[0];
  if (!hit) return { fehlt: true, am };
  const [sued, nord, west, ost] = hit.boundingbox.map(Number);
  const diagonale = distanzKm({ lat: sued, lon: west }, { lat: nord, lon: ost });
  const a = hit.address ?? {};
  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    name: hit.display_name.split(",").slice(0, 3).join(",").trim(),
    gemeinde: a.city || a.town || a.municipality || a.village || a.county,
    // Halbe Diagonale, gedeckelt: ein Dorf ~1–3 km, eine Stadt ~5–10 km, ein Kreis bis 25 km.
    ausdehnungKm: Math.min(25, Math.round((diagonale / 2) * 10) / 10),
    am,
  };
}

export function istTreffer(e: GeoEintrag | undefined): e is GeoTreffer {
  return Boolean(e && !("fehlt" in e));
}

/** Welche Orte der Texte fehlen noch im Cache? */
export function fehlendeOrte(texte: string[], zustand: Zustand): string[] {
  const offen = new Set<string>();
  for (const text of texte) {
    for (const teil of orteAusText(text)) {
      if (!zustand.orte[ortKey(teil)]) offen.add(teil);
    }
  }
  return [...offen];
}

/**
 * Orte nacheinander nachschlagen (1,1 s Abstand) — liefert neue Cache-Einträge.
 * `maxDauerMs` begrenzt die Laufzeit, damit eine Server Action nicht ins Timeout läuft.
 */
export async function orteNachschlagen(teile: string[], maxDauerMs = 25_000): Promise<Record<string, GeoEintrag>> {
  const start = Date.now();
  const neu: Record<string, GeoEintrag> = {};
  for (const [i, teil] of teile.entries()) {
    if (Date.now() - start > maxDauerMs) break;
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    try {
      neu[ortKey(teil)] = await nominatim(teil);
    } catch (err) {
      console.error("[verwaltung] Ort nicht nachschlagbar", teil, err);
      break;
    }
  }
  return neu;
}
