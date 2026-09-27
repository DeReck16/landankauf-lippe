// Gemeinsame Vorbereitung der Tests: eigener, leerer Speicherordner je Testdatei,
// Testmodus (keine Mails), fester Schlüssel für signierte Links.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function testUmgebung(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "lf-test-"));
  process.env.LF_SPEICHER = "lokal";
  process.env.LF_SPEICHER_PFAD = dir;
  process.env.ADMIN_SESSION_SECRET = "test-schluessel-mit-mindestens-zweiunddreissig-zeichen";
  process.env.ADMIN_EMAILS = "admin@example.com";
  process.env.ADMIN_NOTIFY_EMAILS = "verwaltung@example.com";
  process.env.LEAD_TO_EMAIL = "anfragen@example.com";
  delete process.env.VERCEL;
  delete process.env.LF_DATA_PREFIX;
  (process.env as Record<string, string>).NODE_ENV = "test";
  return dir;
}
