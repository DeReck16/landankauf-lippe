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
