import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { LOGIN_LINK_MINUTES, SESSION_DAYS, isAdminEmail, sessionSecret } from "./config";

// Signierte Kurz-Token ohne Datenbank: base64url(JSON) + "." + HMAC-SHA256.
// Der Zweck ("login" | "session") ist Teil der Signatur, damit ein Anmeldelink
// nie als Sitzungscookie taugt und umgekehrt.

type Purpose = "login" | "session";

export type LoginToken = { p: "login"; e: string; x: number; n: string };
export type SessionToken = { p: "session"; e: string; x: number; i: number };

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(purpose: Purpose, body: string): string {
  return createHmac("sha256", sessionSecret()).update(`${purpose}.${body}`).digest("base64url");
}

function encode(purpose: Purpose, payload: object): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(purpose, body)}`;
}

function decode<T extends { p: Purpose; e: string; x: number }>(purpose: Purpose, token: string | undefined | null): T | null {
  if (!token || token.length > 2000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: Buffer;
  let given: Buffer;
  try {
    expected = Buffer.from(sign(purpose, body), "base64url");
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.p !== purpose || typeof payload.e !== "string" || typeof payload.x !== "number") return null;
    if (payload.x * 1000 < Date.now()) return null;
    // Wer aus ADMIN_EMAILS entfernt wird, verliert den Zugang sofort.
    if (!isAdminEmail(payload.e)) return null;
    return payload;
  } catch {
    return null;
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

export function createLoginToken(email: string): { token: string; nonce: string; expiresAt: Date } {
  const nonce = randomBytes(16).toString("base64url");
  const x = nowSec() + LOGIN_LINK_MINUTES * 60;
  const payload: LoginToken = { p: "login", e: email.toLowerCase(), x, n: nonce };
  return { token: encode("login", payload), nonce, expiresAt: new Date(x * 1000) };
}

export function verifyLoginToken(token: string | undefined | null): LoginToken | null {
  const t = decode<LoginToken>("login", token);
  return t && typeof t.n === "string" && t.n.length >= 16 ? t : null;
}

export function createSessionToken(email: string): { token: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const payload: SessionToken = { p: "session", e: email.toLowerCase(), x: nowSec() + maxAge, i: nowSec() };
  return { token: encode("session", payload), maxAge };
}

export function verifySessionToken(token: string | undefined | null): SessionToken | null {
  return decode<SessionToken>("session", token);
}
