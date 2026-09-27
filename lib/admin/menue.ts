import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { findeKandidaten } from "./matching";
import { ladeVerwaltung } from "./daten";
import { ladeNeu, ladePortal } from "./neu";
import { aufgabenAus } from "@/lib/portal/aufgaben";
import { ladeDashboard } from "@/lib/portal/dashboard";
import { site } from "@/lib/site";
import { VORLAGEN_REIHENFOLGE, istFreigegeben } from "@/lib/vertraege/vorlagen";

// Zähler im Menü der Verwaltung (Review S6): früher rechnete JEDE Verwaltungsseite im Layout das
// komplette Dashboard neu. Jetzt zwischengespeichert (je Admin, höchstens eine Minute alt; nach
// „gesehen“ und nach Aktionen sofort erneuert über den Tag). Beim Berechnen wird nichts geschrieben.

export const MENUE_TAG = "admin-menue";

export type MenueZahlen = {
  /** Aufgaben im Dashboard („Jetzt zu tun“). */
  aufgaben: number;
  /** Davon dringend (Fristen & Recht) oder neu — nur dann pulsiert der Zähler. */
  dringend: number;
  aufgabenNeu: number;
  neueAnfragen: number;
  offeneVorschlaege: number;
  neueVorschlaege: number;
  neueEreignisse: number;
  vorlagenOffen: number;
};

async function berechnen(email: string): Promise<MenueZahlen> {
  const [{ leads, zustand }, portal, neu] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email)]);
  const kandidaten = findeKandidaten(leads, zustand).kandidaten.filter((k) => !k.meta);
  let aufgaben = 0;
  let dringend = 0;
  let aufgabenNeu = 0;
  try {
    const liste = aufgabenAus(await ladeDashboard(email, site.url));
    aufgaben = liste.length;
    dringend = liste.filter((a) => a.prio === 1).length;
    aufgabenNeu = liste.filter((a) => a.neu).length;
  } catch (err) {
    console.error("[verwaltung] Aufgaben-Zähler nicht berechenbar", err);
  }
  return {
    aufgaben,
    dringend,
    aufgabenNeu,
    neueAnfragen: leads.filter((l) => l.status !== "archiv" && neu.anfrage(l)).length,
    offeneVorschlaege: kandidaten.length,
    neueVorschlaege: kandidaten.filter((k) => neu.vorschlag(k.key)).length,
    neueEreignisse:
      [...portal.kunden.values()].filter((k) => neu.kunde(k).length > 0).length + [...portal.vorgaenge.values()].filter((v) => neu.vorgang(v).length > 0).length,
    vorlagenOffen: VORLAGEN_REIHENFOLGE.filter((id) => !istFreigegeben(portal.einstellungen, id)).length,
  };
}

export async function menueZahlen(email: string): Promise<MenueZahlen> {
  const e = email.toLowerCase();
  return unstable_cache(() => berechnen(e), ["admin-menue-v1", e], { revalidate: 60, tags: [MENUE_TAG] })();
}

/** Nach einer Aktion: Menü-Zähler beim nächsten Aufruf neu berechnen. */
export function menueErneuern(): void {
  try {
    revalidateTag(MENUE_TAG, { expire: 0 });
  } catch (err) {
    // Außerhalb einer Anfrage (z. B. im Cron) ohne Bedeutung.
    console.warn("[verwaltung] Menü-Zähler nicht erneuert", err);
  }
}
