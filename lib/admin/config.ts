// Konfiguration der Verwaltung (/admin). Alles kommt aus Umgebungsvariablen:
//   ADMIN_EMAILS              — freigeschaltete Adressen, Komma-getrennt
//   ADMIN_SESSION_SECRET      — HMAC-Schlüssel für Anmeldelinks und Sitzungscookie
//   LF_BLOB_READ_WRITE_TOKEN  — privater Blob-Speicher „lippe-forst-privat“ (fra1)
//   LF_DATA_PREFIX            — nur lokal („dev/“), damit Tests nicht in echte Daten schreiben

export const SESSION_COOKIE = "lf_verwaltung";
export const SESSION_DAYS = 30;
export const LOGIN_LINK_MINUTES = 20;

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

export function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  }
  return secret;
}

export function blobToken(): string {
  const token = process.env.LF_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("LF_BLOB_READ_WRITE_TOKEN fehlt — privater Speicher nicht verbunden.");
  return token;
}

export function hasBlobToken(): boolean {
  return Boolean(process.env.LF_BLOB_READ_WRITE_TOKEN);
}

export function dataPrefix(): string {
  return process.env.LF_DATA_PREFIX || "";
}

// ---------------------------------------------------------------------------
// Kundenbereich (/kunde) und E-Mail-Versand
//   ADMIN_NOTIFY_EMAILS  — Empfänger der automatischen Ereignis-Mails (Komma-getrennt)
//   LEAD_TO_EMAIL        — Anfragenpostfach; Reply-To aller Kunden-Mails
//   KUNDEN_FROM_EMAIL    — optional: Absender der Kunden-Mails (Standard kontakt@lippeforst.de)

export const KUNDE_COOKIE = "lf_kunde";
export const KUNDE_SITZUNG_TAGE = 14;
export const KUNDE_LOGIN_MINUTEN = 20;
export const EINLADUNG_TAGE = 30;
export const ZUGANG_TAGE = 14;
/** Antwort-Link der Nachfass-Mail (mehrfach nutzbar, die neueste Antwort zählt). */
export const ANTWORT_TAGE = 120;

function adressListe(raw: string | undefined): string[] {
  return (raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

/** Empfänger der automatischen Ereignis-Mails (Einladung angenommen, unterschrieben, Widerruf …). */
export function notifyEmails(): string[] {
  return adressListe(process.env.ADMIN_NOTIFY_EMAILS);
}

/** Antworten der Kunden landen im Anfragenpostfach. */
export function antwortAdresse(): string {
  return adressListe(process.env.LEAD_TO_EMAIL)[0] || "info@tr-immobilien.com";
}

export function kundenAbsender(): string {
  return process.env.KUNDEN_FROM_EMAIL || "Lippe Forst <kontakt@lippeforst.de>";
}

export function verwaltungsAbsender(): string {
  return process.env.VERWALTUNG_FROM_EMAIL || "Lippe Forst Verwaltung <verwaltung@lippeforst.de>";
}

/**
 * Testmodus: lokal (NODE_ENV ≠ production) oder mit Daten-Präfix wird keine
 * einzige Mail verschickt — weder an Kunden noch an die Verwaltung. Die Mails
 * stehen dann nur im Server-Log.
 */
export function testModus(): boolean {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.LF_DATA_PREFIX);
}
