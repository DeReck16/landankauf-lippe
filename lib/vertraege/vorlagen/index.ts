import "server-only";
import { kanonisch } from "../dokument";
import { sha256Hex } from "../hash";
import type { Art, Einstellungen, Rolle, VorlagenFreigabe } from "@/lib/portal/model";
import { ANBIETER } from "./anbieter";
import { KAUFABSICHT } from "./kaufabsicht";
import { NACHWEIS_KAUF, NACHWEIS_PACHT } from "./nachweis";
import { PACHTVERTRAG } from "./pachtvertrag";
import type { Vorlage, VorlageId } from "./typen";

// Register aller Vertragsvorlagen. Eine Vorlage ist erst verwendbar, wenn Dennis
// genau diese Version (Versionsnummer UND Prüfsumme des Textes) in der
// Verwaltung freigegeben hat. Wird der Text im Code geändert, ändert sich die
// Prüfsumme — die alte Freigabe greift dann nicht mehr (kein ungeprüfter
// Rechtstext geht raus).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVorlage = Vorlage<any>;

export const VORLAGEN: Record<VorlageId, AnyVorlage> = {
  "nachweis-pacht": NACHWEIS_PACHT,
  "nachweis-kauf": NACHWEIS_KAUF,
  anbieter: ANBIETER,
  pachtvertrag: PACHTVERTRAG,
  kaufabsicht: KAUFABSICHT,
};

export const VORLAGEN_REIHENFOLGE: VorlageId[] = ["nachweis-pacht", "nachweis-kauf", "anbieter", "pachtvertrag", "kaufabsicht"];

export function istVorlageId(id: string): id is VorlageId {
  return id in VORLAGEN;
}

const hashCache = new Map<string, string>();

/** Prüfsumme des Vorlagentextes über alle Varianten (mit Platzhaltern). */
export function vorlageHash(id: VorlageId): string {
  const v = VORLAGEN[id];
  const schluessel = `${id}@${v.version}`;
  const cached = hashCache.get(schluessel);
  if (cached) return cached;
  const text = v.varianten.map((x) => `${x.name}\n${kanonisch(v.render(x.daten))}`).join("\n\n");
  const h = sha256Hex(`${id}\n${v.version}\n${text}`);
  hashCache.set(schluessel, h);
  return h;
}

export function aktuelleFreigabe(e: Einstellungen, id: VorlageId): VorlagenFreigabe | null {
  const v = VORLAGEN[id];
  const h = vorlageHash(id);
  const liste = e.freigaben[id] ?? [];
  return liste.find((f) => f.version === v.version && f.hash === h && !f.zurueckgezogen) ?? null;
}

export function istFreigegeben(e: Einstellungen, id: VorlageId): boolean {
  return aktuelleFreigabe(e, id) !== null;
}

/** Welche Vorlage unterschreibt ein Kunde beim Onboarding? */
export function kundenVorlage(rolle: Rolle, art: Art): VorlageId {
  if (rolle === "anbieter") return "anbieter";
  return art === "kauf" ? "nachweis-kauf" : "nachweis-pacht";
}

export type { VorlageId };
