import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ANTWORT_TAGE, EINLADUNG_TAGE, KUNDE_LOGIN_MINUTEN, KUNDE_SITZUNG_TAGE, ZUGANG_TAGE, sessionSecret } from "@/lib/admin/config";
import type { Rolle } from "./model";

// Signierte Token für den Kundenbereich — getrennt von der Verwaltung:
// eigener abgeleiteter Schlüssel und ein Zweck-Tag in jeder Signatur. Ein
// Einladungslink taugt so nie als Sitzung, ein Verwaltungs-Token nie als
// Kunden-Token und umgekehrt.
//
// Schlüssel: Ist KUNDE_TOKEN_SECRET gesetzt (mind. 32 Zeichen), wird damit signiert;
// geprüft wird zusätzlich mit dem bisherigen, aus ADMIN_SESSION_SECRET abgeleiteten
// Schlüssel, damit schon verschickte Links gültig bleiben. So lässt sich später das
// Verwaltungs-Geheimnis tauschen, ohne alle Kundenlinks zu entwerten (sobald die alten
// Links abgelaufen sind — längstens 120 Tage).

export type Zweck = "kunde-einladung" | "kunde-login" | "kunde-zugang" | "kunde-sitzung" | "kunde-antwort" | "kunde-boerse" | "kunde-erklaerung";

export type EinladungToken = { p: "kunde-einladung"; k: string; r: Rolle; n: string; x: number };
export type LoginToken = { p: "kunde-login"; e: string; n: string; x: number };
export type ZugangToken = { p: "kunde-zugang"; k: string; n: string; x: number };
export type SitzungToken = { p: "kunde-sitzung"; e: string; i: number; x: number };
export type AntwortToken = { p: "kunde-antwort"; k: string; x: number };
/** Widerruf der Einwilligung in die Flächenbörse mit einem Klick (Link in der Bestätigungsmail). */
export type BoerseToken = { p: "kunde-boerse"; k: string; x: number };
/** „Das war nicht ich“: eine ohne Anmeldung abgegebene Widerrufs- bzw. Kündigungserklärung zurückweisen. */
export type ErklaerungToken = { p: "kunde-erklaerung"; k: string; a: "widerruf" | "kuendigung"; am: string; x: number };

type Payload = EinladungToken | LoginToken | ZugangToken | SitzungToken | AntwortToken | BoerseToken | ErklaerungToken;

function schluesselAlt(): Buffer {
  return createHmac("sha256", sessionSecret()).update("lippeforst-kundenbereich-v1").digest();
}

function schluesselNeu(): Buffer | null {
  const s = process.env.KUNDE_TOKEN_SECRET;
  return s && s.length >= 32 ? createHmac("sha256", s).update("lippeforst-kundenbereich-v2").digest() : null;
}

function signMit(key: Buffer, zweck: Zweck, body: string): string {
  return createHmac("sha256", key).update(`${zweck}.${body}`).digest("base64url");
}

function encode(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signMit(schluesselNeu() ?? schluesselAlt(), payload.p, body)}`;
}

function passt(key: Buffer, zweck: Zweck, body: string, sig: string): boolean {
  let erwartet: Buffer;
  let gegeben: Buffer;
  try {
    erwartet = Buffer.from(signMit(key, zweck, body), "base64url");
    gegeben = Buffer.from(sig, "base64url");
  } catch {
    return false;
  }
  return erwartet.length === gegeben.length && timingSafeEqual(erwartet, gegeben);
}

function decode<T extends Payload>(zweck: Zweck, token: string | null | undefined): T | null {
  if (!token || token.length > 1500) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const neu = schluesselNeu();
  if (!((neu && passt(neu, zweck, body, sig)) || passt(schluesselAlt(), zweck, body, sig))) return null;
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

/**
 * Antwort-Link der Nachfass-Mail (/kunde/antwort): an die Anfrage gebunden, mehrfach nutzbar
 * (die neueste Antwort zählt), kein Zugang zum Kundenbereich. Ablauf auf den Tag gerundet —
 * so zeigt die Vorschau im Dashboard denselben Link, der am selben Tag gesendet wird.
 */
export function antwortToken(anfrageId: string): string {
  const tag = 86_400;
  return encode({ p: "kunde-antwort", k: anfrageId, x: (Math.floor(jetztSek() / tag) + ANTWORT_TAGE + 1) * tag });
}

export function pruefeAntwort(token: string | null | undefined): AntwortToken | null {
  const t = decode<AntwortToken>("kunde-antwort", token);
  return t && ID.test(t.k) ? t : null;
}

/** Link zum Widerruf der Börsen-Einwilligung (ein Jahr gültig, danach per Antwort-Mail). */
export function boerseToken(anfrageId: string): string {
  return encode({ p: "kunde-boerse", k: anfrageId, x: jetztSek() + 365 * 86_400 });
}

export function pruefeBoerse(token: string | null | undefined): BoerseToken | null {
  const t = decode<BoerseToken>("kunde-boerse", token);
  return t && ID.test(t.k) ? t : null;
}

/** Link „Das war nicht ich“ in der Bestätigung einer ohne Anmeldung abgegebenen Erklärung (30 Tage). */
export function erklaerungToken(kundeId: string, art: "widerruf" | "kuendigung", am: string): string {
  return encode({ p: "kunde-erklaerung", k: kundeId, a: art, am, x: jetztSek() + 30 * 86_400 });
}

export function pruefeErklaerung(token: string | null | undefined): ErklaerungToken | null {
  const t = decode<ErklaerungToken>("kunde-erklaerung", token);
  return t && ID.test(t.k) && (t.a === "widerruf" || t.a === "kuendigung") && typeof t.am === "string" ? t : null;
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

/**
 * Undurchsichtige Kennung eines Vorgangs für den Kundenbereich — statt „LL-A~LL-G“, das die
 * Vorgangsnummer der Gegenseite verraten würde. Nicht umkehrbar, stabil je Vorgang.
 */
export function vorgangsKennung(key: string): string {
  return `V${createHmac("sha256", schluesselAlt()).update(`vorgang.${key}`).digest("hex").slice(0, 16)}`;
}

export function istVorgangsKennung(s: string): boolean {
  return /^V[0-9a-f]{16}$/.test(s);
}
