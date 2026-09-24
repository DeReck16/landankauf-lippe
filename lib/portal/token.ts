import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { EINLADUNG_TAGE, KUNDE_LOGIN_MINUTEN, KUNDE_SITZUNG_TAGE, ZUGANG_TAGE, sessionSecret } from "@/lib/admin/config";
import type { Rolle } from "./model";

// Signierte Token für den Kundenbereich — getrennt von der Verwaltung:
// eigener abgeleiteter Schlüssel (ADMIN_SESSION_SECRET + fester Zusatz) und ein
// Zweck-Tag in jeder Signatur. Ein Einladungslink taugt so nie als Sitzung, ein
// Verwaltungs-Token nie als Kunden-Token und umgekehrt.

export type Zweck = "kunde-einladung" | "kunde-login" | "kunde-zugang" | "kunde-sitzung";

export type EinladungToken = { p: "kunde-einladung"; k: string; r: Rolle; n: string; x: number };
export type LoginToken = { p: "kunde-login"; e: string; n: string; x: number };
export type ZugangToken = { p: "kunde-zugang"; k: string; n: string; x: number };
export type SitzungToken = { p: "kunde-sitzung"; e: string; i: number; x: number };

type Payload = EinladungToken | LoginToken | ZugangToken | SitzungToken;

function schluessel(): Buffer {
  return createHmac("sha256", sessionSecret()).update("lippeforst-kundenbereich-v1").digest();
}

function sign(zweck: Zweck, body: string): string {
  return createHmac("sha256", schluessel()).update(`${zweck}.${body}`).digest("base64url");
}

function encode(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(payload.p, body)}`;
}

function decode<T extends Payload>(zweck: Zweck, token: string | null | undefined): T | null {
  if (!token || token.length > 1500) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let erwartet: Buffer;
  let gegeben: Buffer;
  try {
    erwartet = Buffer.from(sign(zweck, body), "base64url");
    gegeben = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (erwartet.length !== gegeben.length || !timingSafeEqual(erwartet, gegeben)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (p.p !== zweck || typeof p.x !== "number" || p.x * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

const jetztSek = () => Math.floor(Date.now() / 1000);
const ID = /^LL-[A-Z0-9]+$/;

export function neueNonce(): string {
  return randomBytes(16).toString("base64url");
}

/** Einladungslink: an Kunde (Anfrage) und Rolle gebunden, gültig bis `bis`, widerrufbar über die Nonce. */
export function einladungToken(kundeId: string, rolle: Rolle, nonce: string, bis: Date): string {
  return encode({ p: "kunde-einladung", k: kundeId, r: rolle, n: nonce, x: Math.floor(bis.getTime() / 1000) });
}

export function einladungBis(): Date {
  return new Date(Date.now() + EINLADUNG_TAGE * 86_400_000);
}

export function pruefeEinladung(token: string | null | undefined): EinladungToken | null {
  const t = decode<EinladungToken>("kunde-einladung", token);
  return t && ID.test(t.k) && (t.r === "anbieter" || t.r === "suchender") && t.n.length >= 16 ? t : null;
}

/** Anmeldelink per E-Mail: 20 Minuten, einmalig (Marker beim Einlösen). */
export function loginToken(email: string): { token: string; bis: Date } {
  const x = jetztSek() + KUNDE_LOGIN_MINUTEN * 60;
  return { token: encode({ p: "kunde-login", e: email.toLowerCase(), n: neueNonce(), x }), bis: new Date(x * 1000) };
}

export function pruefeLogin(token: string | null | undefined): LoginToken | null {
  const t = decode<LoginToken>("kunde-login", token);
  return t && typeof t.e === "string" && t.n.length >= 16 ? t : null;
}

/** Zugangslink in Mails der Verwaltung (Freigabe, Pachtvertrag): 14 Tage, einmalig. */
export function zugangToken(kundeId: string): { token: string; bis: Date } {
  const x = jetztSek() + ZUGANG_TAGE * 86_400;
  return { token: encode({ p: "kunde-zugang", k: kundeId, n: neueNonce(), x }), bis: new Date(x * 1000) };
}

export function pruefeZugang(token: string | null | undefined): ZugangToken | null {
  const t = decode<ZugangToken>("kunde-zugang", token);
  return t && ID.test(t.k) && t.n.length >= 16 ? t : null;
}

/** Sitzungscookie: an die E-Mail-Adresse gebunden; Sperren wirken über `zugangAb` je Kunde. */
export function sitzungToken(email: string): { token: string; maxAge: number } {
  const maxAge = KUNDE_SITZUNG_TAGE * 86_400;
  return { token: encode({ p: "kunde-sitzung", e: email.toLowerCase(), i: jetztSek(), x: jetztSek() + maxAge }), maxAge };
}

export function pruefeSitzung(token: string | null | undefined): SitzungToken | null {
  const t = decode<SitzungToken>("kunde-sitzung", token);
  return t && typeof t.e === "string" && typeof t.i === "number" ? t : null;
}

/** Kurze, nicht umkehrbare Kennung einer Nonce für Protokolle. */
export function kennung(wert: string): string {
  return createHash("sha256").update(wert).digest("hex").slice(0, 16);
}
