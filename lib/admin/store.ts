import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { BlobError, BlobPreconditionFailedError, get, list, put } from "@vercel/blob";
import { blobToken, dataPrefix } from "./config";
import { leererZustand, normalizeLead, type LeadRecord, type Zustand } from "./model";

// Privater Blob-Speicher „lippe-forst-privat“ (Frankfurt):
//   leads/<datum>/<id>.json      — eine Datei je Anfrage, geschrieben von /api/lead, nie verändert
//   admin/zustand.json           — Verwaltungszustand, geschrieben mit ETag-Prüfung (ifMatch)
//   admin/auth/…                 — verbrauchte Anmeldelinks und Mail-Drosselung

const leadsPrefix = () => `${dataPrefix()}leads/`;
const zustandPfad = () => `${dataPrefix()}admin/zustand.json`;
const LEAD_ID = /\/(LL-[A-Z0-9]+)\.json$/;

// Anfragen ändern sich nie — einmal gelesen, bleiben sie im Speicher der Instanz.
const leadCache = new Map<string, LeadRecord>();

async function readText(pathname: string, useCache: boolean): Promise<{ text: string; etag: string } | null> {
  const res = await get(pathname, { access: "private", token: blobToken(), useCache });
  if (!res || res.statusCode !== 200) return null;
  return { text: await new Response(res.stream).text(), etag: res.blob.etag };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function listLeads(): Promise<LeadRecord[]> {
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: leadsPrefix(), token: blobToken(), cursor, limit: 1000 });
    for (const b of page.blobs) if (LEAD_ID.test(b.pathname)) pathnames.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const leads = await mapLimit(pathnames, 8, async (pathname) => {
    const cached = leadCache.get(pathname);
    if (cached) return cached;
    try {
      const res = await readText(pathname, true);
      if (!res) return null;
      const lead = normalizeLead(JSON.parse(res.text), pathname.match(LEAD_ID)![1]);
      leadCache.set(pathname, lead);
      return lead;
    } catch (err) {
      console.error("[verwaltung] Anfrage nicht lesbar", pathname, err);
      return null;
    }
  });
  return leads
    .filter((l): l is LeadRecord => l !== null)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/**
 * Veränderliche Dateien immer frisch vom Speicher lesen. Das SDK-`get()` nutzt
 * das globale fetch, das Next.js innerhalb eines Aufrufs (und im Dev-Modus über
 * HMR hinweg) zwischenspeichert — dann liefe die ETag-Prüfung ins Leere.
 */
async function frischLesen(pathname: string): Promise<{ text: string; etag: string } | null> {
  const token = blobToken();
  const storeId = token.split("_")[3];
  const url = new URL(`https://${storeId}.private.blob.vercel-storage.com/${pathname}`);
  url.searchParams.set("cache", "0");
  url.searchParams.set("r", randomUUID());
  // Unkomprimiert anfordern: bei gzip liefert der Speicher ein schwaches ETag
  // (W/"…"), das ifMatch beim Schreiben nicht akzeptiert.
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, "accept-encoding": "identity" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Speicher antwortet mit HTTP ${res.status} für ${pathname}`);
  return { text: await res.text(), etag: (res.headers.get("etag") ?? "").replace(/^W\//, "") };
}

export async function readZustand(): Promise<{ zustand: Zustand; etag: string | null }> {
  const res = await frischLesen(zustandPfad());
  if (!res) return { zustand: leererZustand(), etag: null };
  const parsed = JSON.parse(res.text) as Partial<Zustand>;
  return {
    zustand: {
      ...leererZustand(),
      ...parsed,
      anfragen: parsed.anfragen ?? {},
      paare: parsed.paare ?? {},
      orte: parsed.orte ?? {},
      protokoll: parsed.protokoll ?? [],
    },
    etag: res.etag,
  };
}

const PROTOKOLL_MAX = 400;

/**
 * Zustand ändern: lesen → Änderung anwenden → mit ifMatch zurückschreiben.
 * Hat jemand zwischendurch gespeichert, wird frisch gelesen und die Änderung
 * erneut angewendet (optimistische Sperre, kein Überschreiben fremder Änderungen).
 */
export async function mutateZustand(
  von: string,
  aenderung: (z: Zustand) => { was: string; ref?: string } | void,
): Promise<Zustand> {
  for (let versuch = 0; versuch < 5; versuch++) {
    const { zustand, etag } = await readZustand();
    const eintrag = aenderung(zustand);
    if (eintrag) {
      zustand.protokoll.unshift({ am: new Date().toISOString(), von, ...eintrag });
      zustand.protokoll.length = Math.min(zustand.protokoll.length, PROTOKOLL_MAX);
    }
    try {
      await put(zustandPfad(), JSON.stringify(zustand), {
        access: "private",
        token: blobToken(),
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
      });
      return zustand;
    } catch (err) {
      const konflikt =
        err instanceof BlobPreconditionFailedError ||
        (err instanceof BlobError && /exist/i.test(err.message));
      if (!konflikt) throw err;
      await new Promise((r) => setTimeout(r, 150 * (versuch + 1)));
    }
  }
  throw new Error("Speichern fehlgeschlagen, weil parallel geändert wurde — bitte neu laden und erneut versuchen.");
}

// ---------------------------------------------------------------------------
// Anmeldung: Einmal-Links und Drosselung

/**
 * Legt eine Markerdatei an — nur, wenn es sie noch nicht gibt. Das ist ein
 * einziger atomarer Schreibvorgang: true = neu angelegt, false = gab es schon.
 */
async function markerAnlegen(pfad: string): Promise<boolean> {
  try {
    await put(pfad, JSON.stringify({ am: new Date().toISOString() }), {
      access: "private",
      token: blobToken(),
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return true;
  } catch (err) {
    if (err instanceof BlobError && /exist/i.test(err.message)) return false;
    throw err;
  }
}

/** Markiert einen Anmeldelink als benutzt. false = war schon benutzt. */
export async function linkEinloesen(nonce: string): Promise<boolean> {
  return markerAnlegen(`${dataPrefix()}admin/auth/benutzt/${nonce}.json`);
}

/** Einmal-Marker für beliebige Zwecke (z. B. Kunden-Anmeldelinks). false = gab es schon. */
export async function einmalMarker(relPfad: string): Promise<boolean> {
  return markerAnlegen(`${dataPrefix()}${relPfad}`);
}

// ---------------------------------------------------------------------------
// Allgemeine JSON-Dateien (Kundenbereich, Vorgänge, Einstellungen) — gleiches
// Schutzmuster wie der Zustand: frisch lesen, mit ifMatch zurückschreiben.

function istKonflikt(err: unknown): boolean {
  return (
    err instanceof BlobPreconditionFailedError ||
    (err instanceof BlobError && /exist|precondition|etag/i.test(err.message))
  );
}

/** Veränderliche JSON-Datei frisch lesen (Pfad ohne Daten-Präfix). */
export async function jsonLesen<T>(relPfad: string): Promise<{ daten: T; etag: string } | null> {
  const res = await frischLesen(`${dataPrefix()}${relPfad}`);
  if (!res) return null;
  return { daten: JSON.parse(res.text) as T, etag: res.etag };
}

/**
 * JSON-Datei ändern: lesen → `aendern` anwenden → mit ifMatch schreiben.
 * `aendern` darf `false` zurückgeben, dann wird nichts geschrieben.
 * Bei parallelen Änderungen wird frisch gelesen und erneut angewendet.
 */
export async function jsonAendern<T>(
  relPfad: string,
  leer: () => T,
  aendern: (d: T, neu: boolean) => void | false,
): Promise<T> {
  const pfad = `${dataPrefix()}${relPfad}`;
  for (let versuch = 0; versuch < 6; versuch++) {
    const res = await frischLesen(pfad);
    const daten = res ? (JSON.parse(res.text) as T) : leer();
    if (aendern(daten, !res) === false) return daten;
    try {
      await put(pfad, JSON.stringify(daten), {
        access: "private",
        token: blobToken(),
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(res ? { allowOverwrite: true, ifMatch: res.etag } : { allowOverwrite: false }),
      });
      return daten;
    } catch (err) {
      if (!istKonflikt(err)) throw err;
      await new Promise((r) => setTimeout(r, 120 * (versuch + 1) + Math.random() * 80));
    }
  }
  throw new Error("Speichern fehlgeschlagen, weil parallel geändert wurde — bitte neu laden und erneut versuchen.");
}

/** Alle JSON-Dateien unter einem Präfix, jeweils frisch gelesen. */
export async function jsonListe<T>(relPrefix: string): Promise<T[]> {
  const pfade: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${dataPrefix()}${relPrefix}`, token: blobToken(), cursor, limit: 1000 });
    for (const b of page.blobs) if (b.pathname.endsWith(".json")) pfade.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const inhalte = await mapLimit(pfade, 8, async (pfad): Promise<T | null> => {
    try {
      const res = await frischLesen(pfad);
      return res ? (JSON.parse(res.text) as T) : null;
    } catch (err) {
      console.error("[speicher] Datei nicht lesbar", pfad, err);
      return null;
    }
  });
  return inhalte.filter((x): x is T => x !== null);
}

/** Eine Anfrage nach ID (Anfragen sind unveränderlich und im Speicher der Instanz gecacht). */
export async function leadLesen(id: string): Promise<LeadRecord | null> {
  if (!/^LL-[A-Z0-9]+$/.test(id)) return null;
  return (await listLeads()).find((l) => l.id === id) ?? null;
}

/** Unveränderliche Datei (z. B. unterschriebenes PDF) anlegen — nie überschreiben. */
export async function dateiAnlegen(relPfad: string, inhalt: Buffer | Uint8Array | string, contentType: string): Promise<void> {
  const body = typeof inhalt === "string" ? inhalt : Buffer.from(inhalt);
  await put(`${dataPrefix()}${relPfad}`, body, {
    access: "private",
    token: blobToken(),
    contentType,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

/** Datei aus dem privaten Speicher holen (für authentifizierte Downloads). */
export async function dateiLesen(relPfad: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const token = blobToken();
  const storeId = token.split("_")[3];
  const url = new URL(`https://${storeId}.private.blob.vercel-storage.com/${dataPrefix()}${relPfad}`);
  url.searchParams.set("r", randomUUID());
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Speicher antwortet mit HTTP ${res.status} für ${relPfad}`);
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "application/octet-stream" };
}

/** Alle Dateien unter einem Präfix (Pfade ohne Daten-Präfix) — für Aufräumen/Tests. */
export async function dateienListen(relPrefix: string): Promise<string[]> {
  const pfade: string[] = [];
  let cursor: string | undefined;
  const p = dataPrefix();
  do {
    const page = await list({ prefix: `${p}${relPrefix}`, token: blobToken(), cursor, limit: 1000 });
    for (const b of page.blobs) pfade.push(b.pathname.slice(p.length));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return pfade;
}

/** Höchstens ein Anmeldelink pro Adresse und Minute. true = darf senden. */
export async function mailDrosseln(email: string): Promise<boolean> {
  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24);
  const minute = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return markerAnlegen(`${dataPrefix()}admin/auth/mail/${hash}-${minute}.json`);
}
