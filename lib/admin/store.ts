import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BlobError, BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import { blobToken, dataPrefix, lokalerSpeicher, sessionSecret } from "./config";
import { leererZustand, normalizeLead, type LeadRecord, type ProtokollEintrag, type Zustand } from "./model";

// Privater Blob-Speicher „lippe-forst-privat“ (Frankfurt):
//   leads/<datum>/<id>.json      — eine Datei je Anfrage, geschrieben von /api/lead, nie verändert
//   admin/zustand.json           — Verwaltungszustand, geschrieben mit ETag-Prüfung (ifMatch)
//   admin/verlauf/<LL-ID>.json   — Verlauf je Anfrage (dauerhaft, unabhängig vom gekürzten Protokoll)
//   admin/auth/…                 — verbrauchte Anmeldelinks und Mail-Drosselung
//   admin/drossel/…              — Zähler gegen Missbrauch (Formular, Widerruf ohne Anmeldung …)
//
// Lokal (Tests, Simulation) liegt alles stattdessen in einem Ordner auf der Platte
// (LF_SPEICHER=lokal, LF_SPEICHER_PFAD) — mit denselben Regeln: ETag-Prüfung beim
// Überschreiben und „nur anlegen, wenn neu“. Auf Vercel ist das ausgeschlossen.

const leadsPrefix = () => `${dataPrefix()}leads/`;
const zustandPfad = () => `${dataPrefix()}admin/zustand.json`;
const LEAD_ID = /\/(LL-[A-Z0-9]+)\.json$/;

// Anfragen ändern sich nie — einmal gelesen, bleiben sie im Speicher der Instanz.
const leadCache = new Map<string, LeadRecord>();

// ---------------------------------------------------------------------------
// Lokaler Dateispeicher (nur Tests und lokale Simulation)

function lokalPfad(dir: string, pathname: string): string {
  const basis = path.resolve(dir);
  const p = path.resolve(basis, pathname);
  if (p !== basis && !p.startsWith(basis + path.sep)) throw new Error(`Ungültiger Speicherpfad: ${pathname}`);
  return p;
}

function etagVon(inhalt: Buffer): string {
  return `"${createHash("sha1").update(inhalt).digest("hex")}"`;
}

function lokalLesen(dir: string, pathname: string): { bytes: Buffer; etag: string } | null {
  try {
    const bytes = readFileSync(lokalPfad(dir, pathname));
    return { bytes, etag: etagVon(bytes) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function lokalSchreiben(dir: string, pathname: string, body: string | Buffer, opt: { allowOverwrite: boolean; ifMatch?: string }): void {
  const p = lokalPfad(dir, pathname);
  mkdirSync(path.dirname(p), { recursive: true });
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  if (opt.ifMatch) {
    const alt = lokalLesen(dir, pathname);
    if (!alt || alt.etag !== opt.ifMatch) throw new BlobPreconditionFailedError();
    writeFileSync(p, buf);
    return;
  }
  if (!opt.allowOverwrite) {
    try {
      writeFileSync(p, buf, { flag: "wx" });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new BlobError("This blob already exists");
      throw err;
    }
    return;
  }
  writeFileSync(p, buf);
}

function lokalListe(dir: string, prefix: string): string[] {
  const basis = path.resolve(dir);
  const out: string[] = [];
  const gehe = (ordner: string) => {
    let eintraege: import("node:fs").Dirent[];
    try {
      eintraege = readdirSync(ordner, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of eintraege) {
      const voll = path.join(ordner, e.name);
      if (e.isDirectory()) gehe(voll);
      else {
        const rel = path.relative(basis, voll).split(path.sep).join("/");
        if (rel.startsWith(prefix)) out.push(rel);
      }
    }
  };
  gehe(basis);
  return out.sort();
}

function inhaltsTyp(pathname: string): string {
  if (pathname.endsWith(".pdf")) return "application/pdf";
  if (pathname.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(pathname)) return "image/jpeg";
  if (pathname.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Grundoperationen (Blob bzw. lokal)

function storeId(): string {
  return blobToken().split("_")[3];
}

/**
 * Veränderliche Dateien immer frisch vom Speicher lesen. Das SDK-`get()` nutzt
 * das globale fetch, das Next.js innerhalb eines Aufrufs (und im Dev-Modus über
 * HMR hinweg) zwischenspeichert — dann liefe die ETag-Prüfung ins Leere.
 */
async function frischLesen(pathname: string): Promise<{ text: string; etag: string } | null> {
  const lokal = lokalerSpeicher();
  if (lokal) {
    const r = lokalLesen(lokal, pathname);
    return r ? { text: r.bytes.toString("utf8"), etag: r.etag } : null;
  }
  const token = blobToken();
  const url = new URL(`https://${storeId()}.private.blob.vercel-storage.com/${pathname}`);
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

/** Unveränderliche Datei lesen (Anfragen) — darf zwischengespeichert werden. */
async function festLesen(pathname: string): Promise<string | null> {
  const lokal = lokalerSpeicher();
  if (lokal) return lokalLesen(lokal, pathname)?.bytes.toString("utf8") ?? null;
  const res = await get(pathname, { access: "private", token: blobToken(), useCache: true });
  if (!res || res.statusCode !== 200) return null;
  return await new Response(res.stream).text();
}

async function schreiben(
  pathname: string,
  body: string | Buffer,
  opt: { contentType: string; allowOverwrite: boolean; ifMatch?: string; cacheControlMaxAge?: number },
): Promise<void> {
  const lokal = lokalerSpeicher();
  if (lokal) {
    lokalSchreiben(lokal, pathname, body, { allowOverwrite: opt.allowOverwrite, ifMatch: opt.ifMatch });
    return;
  }
  await put(pathname, body, {
    access: "private",
    token: blobToken(),
    contentType: opt.contentType,
    addRandomSuffix: false,
    ...(opt.cacheControlMaxAge ? { cacheControlMaxAge: opt.cacheControlMaxAge } : {}),
    ...(opt.ifMatch ? { allowOverwrite: true, ifMatch: opt.ifMatch } : { allowOverwrite: opt.allowOverwrite }),
  });
}

async function auflisten(prefix: string): Promise<string[]> {
  const lokal = lokalerSpeicher();
  if (lokal) return lokalListe(lokal, prefix);
  const pfade: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token: blobToken(), cursor, limit: 1000 });
    for (const b of page.blobs) pfade.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return pfade;
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

// ---------------------------------------------------------------------------
// Anfragen

export async function listLeads(): Promise<LeadRecord[]> {
  const pathnames = (await auflisten(leadsPrefix())).filter((p) => LEAD_ID.test(p));
  const leads = await mapLimit(pathnames, 8, async (pathname) => {
    const cached = leadCache.get(pathname);
    if (cached) return cached;
    try {
      const text = await festLesen(pathname);
      if (text == null) return null;
      const lead = normalizeLead(JSON.parse(text), pathname.match(LEAD_ID)![1]);
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

// ---------------------------------------------------------------------------
// Verwaltungszustand

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
      geloescht: parsed.geloescht ?? {},
    },
    etag: res.etag,
  };
}

const PROTOKOLL_MAX = 600;

/**
 * Zustand ändern: lesen → Änderung anwenden → mit ifMatch zurückschreiben.
 * Hat jemand zwischendurch gespeichert, wird frisch gelesen und die Änderung
 * erneut angewendet (optimistische Sperre, kein Überschreiben fremder Änderungen).
 * Einträge mit Bezug (Anfrage oder Paar) landen zusätzlich im Verlauf je Anfrage.
 */
export async function mutateZustand(
  von: string,
  aenderung: (z: Zustand) => { was: string; ref?: string } | void,
): Promise<Zustand> {
  for (let versuch = 0; versuch < 5; versuch++) {
    const { zustand, etag } = await readZustand();
    const eintrag = aenderung(zustand);
    let neu: ProtokollEintrag | null = null;
    if (eintrag) {
      neu = { am: new Date().toISOString(), von, ...eintrag };
      zustand.protokoll.unshift(neu);
      zustand.protokoll.length = Math.min(zustand.protokoll.length, PROTOKOLL_MAX);
    }
    try {
      await schreiben(zustandPfad(), JSON.stringify(zustand), {
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: Boolean(etag),
        ...(etag ? { ifMatch: etag } : {}),
      });
      if (neu?.ref) {
        const e = neu;
        await verlaufErgaenzen(e).catch((err) => console.error("[verwaltung] Verlauf nicht ergänzt", e.ref, err));
      }
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
// Verlauf je Anfrage (das Protokoll im Zustand ist gekürzt — hier bleibt alles)

export type Verlauf = { v: 1; id: string; eintraege: ProtokollEintrag[] };
const VERLAUF_MAX = 500;
const verlaufPfad = (id: string) => `admin/verlauf/${id}.json`;

async function verlaufErgaenzen(e: ProtokollEintrag): Promise<void> {
  const ids = [...new Set((e.ref ?? "").split("~").filter((x) => /^LL-[A-Z0-9]+$/.test(x)))];
  for (const id of ids) {
    await jsonAendern<Verlauf>(verlaufPfad(id), () => ({ v: 1, id, eintraege: [] }), (d) => {
      d.eintraege.unshift(e);
      d.eintraege.length = Math.min(d.eintraege.length, VERLAUF_MAX);
    });
  }
}

/** Verlauf einer Anfrage (neueste zuerst) — ergänzt um ältere Einträge aus dem Protokoll des Zustands. */
export async function verlaufLesen(id: string, protokoll: ProtokollEintrag[] = []): Promise<ProtokollEintrag[]> {
  const eigen = (await jsonLesen<Verlauf>(verlaufPfad(id)))?.daten.eintraege ?? [];
  const bekannt = new Set(eigen.map((x) => `${x.am}|${x.was}`));
  const alt = protokoll.filter((p) => (p.ref === id || p.ref?.split("~").includes(id)) && !bekannt.has(`${p.am}|${p.was}`));
  return [...eigen, ...alt].sort((a, b) => b.am.localeCompare(a.am));
}

// ---------------------------------------------------------------------------
// Anmeldung: Einmal-Links und Drosselung

/**
 * Legt eine Markerdatei an — nur, wenn es sie noch nicht gibt. Das ist ein
 * einziger atomarer Schreibvorgang: true = neu angelegt, false = gab es schon.
 */
async function markerAnlegen(pfad: string): Promise<boolean> {
  try {
    await schreiben(pfad, JSON.stringify({ am: new Date().toISOString() }), { contentType: "application/json", allowOverwrite: false });
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

/** Höchstens ein Anmeldelink pro Adresse und Minute. true = darf senden. */
export async function mailDrosseln(email: string): Promise<boolean> {
  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24);
  const minute = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return markerAnlegen(`${dataPrefix()}admin/auth/mail/${hash}-${minute}.json`);
}

/** Nicht umkehrbarer Kurzwert (z. B. einer IP-Adresse) — mit Schlüssel, damit er nicht per Wörterbuch zurückzurechnen ist. */
export function kurzwert(wert: string, zweck: string): string {
  return createHmac("sha256", sessionSecret()).update(`drossel.${zweck}.${wert}`).digest("hex").slice(0, 24);
}

type Zaehler = { v: 1; zeiten: string[] };

/**
 * Missbrauchsschutz mit gleitenden Fenstern: true = erlaubt (und gezählt), false = zu viele Versuche.
 * Je Schlüssel eine kleine Datei unter admin/drossel/<art>/ (nur ein Kurzwert, keine Klartext-Daten;
 * alte Zeitpunkte fallen beim nächsten Aufruf heraus). Kann der Zähler nicht geschrieben werden
 * (z. B. sehr viele gleichzeitige Aufrufe), gilt das Limit als erreicht.
 */
export async function drosseln(art: string, schluessel: string, grenzen: { sekunden: number; max: number }[]): Promise<boolean> {
  const jetzt = Date.now();
  const laengstes = Math.max(...grenzen.map((g) => g.sekunden)) * 1000;
  let erlaubt = true;
  try {
    await jsonAendern<Zaehler>(`admin/drossel/${art}/${schluessel}.json`, () => ({ v: 1, zeiten: [] }), (d) => {
      const zeiten = (d.zeiten ?? []).filter((z) => jetzt - Date.parse(z) < laengstes);
      erlaubt = grenzen.every((g) => zeiten.filter((z) => jetzt - Date.parse(z) < g.sekunden * 1000).length < g.max);
      if (erlaubt) zeiten.unshift(new Date(jetzt).toISOString());
      d.zeiten = zeiten.slice(0, 200);
    });
  } catch (err) {
    console.error("[drossel] Zähler nicht schreibbar — Aufruf abgelehnt", art, err);
    return false;
  }
  return erlaubt;
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
      await schreiben(pfad, JSON.stringify(daten), {
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: Boolean(res),
        ...(res ? { ifMatch: res.etag } : {}),
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
  const pfade = (await auflisten(`${dataPrefix()}${relPrefix}`)).filter((p) => p.endsWith(".json"));
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

/** Unveränderliche Datei (z. B. unterschriebenes PDF, neue Anfrage) anlegen — nie überschreiben. */
export async function dateiAnlegen(relPfad: string, inhalt: Buffer | Uint8Array | string, contentType: string): Promise<void> {
  const body = typeof inhalt === "string" ? inhalt : Buffer.from(inhalt);
  await schreiben(`${dataPrefix()}${relPfad}`, body, { contentType, allowOverwrite: false });
}

/** Datei aus dem privaten Speicher holen (für authentifizierte Downloads). */
export async function dateiLesen(relPfad: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const pathname = `${dataPrefix()}${relPfad}`;
  const lokal = lokalerSpeicher();
  if (lokal) {
    const r = lokalLesen(lokal, pathname);
    return r ? { bytes: r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer, contentType: inhaltsTyp(pathname) } : null;
  }
  const token = blobToken();
  const url = new URL(`https://${storeId()}.private.blob.vercel-storage.com/${pathname}`);
  url.searchParams.set("r", randomUUID());
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Speicher antwortet mit HTTP ${res.status} für ${relPfad}`);
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "application/octet-stream" };
}

/**
 * Öffentliche, bereinigte Datei für die Website lesen (Flächenbörse) — auf Vercel mit
 * Next-Cache (Tag + Revalidierung), lokal direkt von der Platte.
 */
export async function websiteDateiLesen<T>(relPfad: string, cacheOpt: { revalidate: number; tags: string[] }): Promise<T | null> {
  const pathname = `${dataPrefix()}${relPfad}`;
  const lokal = lokalerSpeicher();
  if (lokal) {
    const r = lokalLesen(lokal, pathname);
    return r ? (JSON.parse(r.bytes.toString("utf8")) as T) : null;
  }
  // Cache-Buster: Das Blob-CDN hält überschriebene Dateien sonst bis zu einer Minute alt vor.
  // Gecacht wird die Seite selbst (ISR, beim Veröffentlichen sofort erneuert).
  const res = await fetch(`https://${storeId()}.private.blob.vercel-storage.com/${pathname}?cache=0&r=${Date.now()}`, {
    headers: { authorization: `Bearer ${blobToken()}` },
    next: cacheOpt,
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Alle Dateien unter einem Präfix (Pfade ohne Daten-Präfix) — für Tests und das Löschen. */
export async function dateienListen(relPrefix: string): Promise<string[]> {
  const p = dataPrefix();
  return (await auflisten(`${p}${relPrefix}`)).map((x) => x.slice(p.length));
}

/** Pfade der Anfrage-Datei(en) zu einer Vorgangsnummer (leads/<datum>/<LL-ID>.json, ohne Daten-Präfix). */
export async function leadPfade(id: string): Promise<string[]> {
  if (!/^LL-[A-Z0-9]+$/.test(id)) return [];
  return (await dateienListen("leads/")).filter((p) => p.endsWith(`/${id}.json`));
}

/**
 * Dateien endgültig löschen (nur für „Vorgang endgültig löschen (DSGVO)“, lib/admin/loeschen.ts).
 * Pfade ohne Daten-Präfix; fehlende Dateien gelten als gelöscht. Liefert die Zahl der Pfade.
 */
export async function dateienLoeschen(relPfade: string[]): Promise<number> {
  const pfade = [...new Set(relPfade.filter((p) => p && !p.startsWith("/") && !p.includes("..")))];
  if (pfade.length === 0) return 0;
  const voll = pfade.map((p) => `${dataPrefix()}${p}`);
  for (const pathname of voll) leadCache.delete(pathname);
  const lokal = lokalerSpeicher();
  if (lokal) {
    for (const pathname of voll) rmSync(lokalPfad(lokal, pathname), { force: true });
    return pfade.length;
  }
  // In kleinen Portionen, damit ein einzelner Aufruf überschaubar bleibt.
  for (let i = 0; i < voll.length; i += 100) await del(voll.slice(i, i + 100), { token: blobToken() });
  return pfade.length;
}
