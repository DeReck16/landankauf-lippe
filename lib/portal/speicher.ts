import "server-only";
import { createHash } from "node:crypto";
import { jsonAendern, jsonLesen, jsonListe } from "@/lib/admin/store";
import {
  kundeNormal,
  leereEinstellungen,
  neuerVorgang,
  vorgangNormal,
  type Art,
  type Einstellungen,
  type Gesehen,
  type KundeRecord,
  type VorgangRecord,
} from "./model";

// Dateien des Kundenbereichs im privaten Speicher. Jede Datei wird mit
// ETag-Schutz geschrieben (siehe lib/admin/store.ts → jsonAendern).

const KUNDE_ID = /^LL-[A-Z0-9]+$/;
const PAAR_KEY = /^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/;

export function istKundeId(id: string): boolean {
  return KUNDE_ID.test(id);
}
export function istPaarKey(key: string): boolean {
  return PAAR_KEY.test(key);
}

const kundePfad = (id: string) => `portal/kunden/${id}.json`;
const vorgangPfad = (key: string) => `portal/vorgaenge/${key}.json`;
const EINSTELLUNGEN = "portal/einstellungen.json";
const gesehenPfad = (email: string) =>
  `admin/gesehen/${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24)}.json`;

export async function ladeKunde(id: string): Promise<KundeRecord | null> {
  if (!istKundeId(id)) return null;
  const res = await jsonLesen<KundeRecord>(kundePfad(id));
  return res ? kundeNormal(res.daten) : null;
}

/**
 * Kunde ändern. `anlegen` liefert einen neuen Datensatz, falls es noch keinen
 * gibt; ohne `anlegen` wird bei fehlendem Kunden ein Fehler geworfen.
 */
export async function aendereKunde(
  id: string,
  aendern: (k: KundeRecord) => void | false,
  anlegen?: () => KundeRecord,
): Promise<KundeRecord> {
  if (!istKundeId(id)) throw new Error("Ungültige Kunden-ID");
  let fehlt = false;
  const k = await jsonAendern<KundeRecord>(
    kundePfad(id),
    () => {
      if (!anlegen) {
        fehlt = true;
        return null as unknown as KundeRecord;
      }
      return anlegen();
    },
    (d, neu) => {
      if (fehlt || !d) return false;
      const r = aendern(kundeNormal(d));
      // Ein neu angelegter Kunde wird immer gespeichert — auch wenn `aendern` nichts mehr zu tun hat.
      return neu ? undefined : r;
    },
  );
  if (fehlt || !k) throw new Error("Kunde nicht gefunden");
  return kundeNormal(k);
}

export async function alleKunden(): Promise<KundeRecord[]> {
  return (await jsonListe<KundeRecord>("portal/kunden/")).map(kundeNormal);
}

export async function ladeVorgang(key: string): Promise<VorgangRecord | null> {
  if (!istPaarKey(key)) return null;
  const res = await jsonLesen<VorgangRecord>(vorgangPfad(key));
  return res ? vorgangNormal(res.daten) : null;
}

/** Vorgang ändern — wird bei Bedarf angelegt. */
export async function aendereVorgang(key: string, art: Art, aendern: (v: VorgangRecord) => void | false): Promise<VorgangRecord> {
  if (!istPaarKey(key)) throw new Error("Ungültiger Vorgang");
  const v = await jsonAendern<VorgangRecord>(vorgangPfad(key), () => neuerVorgang(key, art), (d) => aendern(vorgangNormal(d)));
  return vorgangNormal(v);
}

export async function alleVorgaenge(): Promise<VorgangRecord[]> {
  return (await jsonListe<VorgangRecord>("portal/vorgaenge/")).map(vorgangNormal);
}

export async function ladeEinstellungen(): Promise<Einstellungen> {
  const res = await jsonLesen<Einstellungen>(EINSTELLUNGEN);
  return res ? { ...leereEinstellungen(), ...res.daten, freigaben: res.daten.freigaben ?? {} } : leereEinstellungen();
}

export async function aendereEinstellungen(aendern: (e: Einstellungen) => void | false): Promise<Einstellungen> {
  return jsonAendern<Einstellungen>(EINSTELLUNGEN, leereEinstellungen, (e) => {
    e.freigaben ??= {};
    return aendern(e);
  });
}

export async function ladeGesehen(email: string): Promise<Gesehen> {
  const res = await jsonLesen<Gesehen>(gesehenPfad(email));
  return res?.daten ?? { v: 1, email: email.toLowerCase(), eintraege: {} };
}

/** Einträge als gesehen markieren (nur schreiben, wenn sich etwas ändert). */
export async function markiereGesehen(email: string, keys: string[]): Promise<void> {
  const jetzt = new Date().toISOString();
  const saubere = [...new Set(keys)].filter((k) => /^[a-z]+:[A-Za-z0-9~_-]{1,80}$/.test(k)).slice(0, 400);
  if (saubere.length === 0) return;
  await jsonAendern<Gesehen>(
    gesehenPfad(email),
    () => ({ v: 1, email: email.toLowerCase(), eintraege: {} }),
    (g) => {
      for (const k of saubere) g.eintraege[k] = jetzt;
      // Aufräumen: höchstens 3000 Einträge behalten (die jüngsten).
      const alle = Object.entries(g.eintraege);
      if (alle.length > 3000) {
        alle.sort((a, b) => b[1].localeCompare(a[1]));
        g.eintraege = Object.fromEntries(alle.slice(0, 3000));
      }
    },
  );
}
