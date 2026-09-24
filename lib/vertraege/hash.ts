import "server-only";
import { createHash } from "node:crypto";
import { kanonisch, type Dokument } from "./dokument";

export function sha256Hex(daten: string | Uint8Array): string {
  return createHash("sha256").update(daten).digest("hex");
}

/** SHA-256 über den angezeigten Vertragstext (inkl. eingesetzter Daten). */
export function dokumentHash(dok: Dokument): string {
  return sha256Hex(kanonisch(dok));
}
