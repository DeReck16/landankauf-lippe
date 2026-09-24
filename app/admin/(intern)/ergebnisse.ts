import { useSyncExternalStore } from "react";
import type { AssistentState } from "../assistent-actions";

// Rückmeldungen des Assistenten je Karte (Vorgang) — nur im Browser-Speicher der
// geöffneten Seite: Wechselt die Karte nach dem Klick den Abschnitt (z. B. von
// „Jetzt dran“ nach „Warten“), zeigt sie das Ergebnis trotzdem an. Nach einem
// Neuladen ist es weg (nichts steht in der Adresse).

type Eintrag = { state: AssistentState; zeit: number };

const LEBENSDAUER_MS = 15 * 60_000;
const ergebnisse = new Map<string, Eintrag>();
const hoerer = new Set<() => void>();

function melden() {
  for (const h of hoerer) h();
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

export function ergebnisSetzen(ziel: string, state: AssistentState): void {
  ergebnisse.set(ziel, { state, zeit: Date.now() });
  melden();
}

export function ergebnisLoeschen(ziel: string): void {
  if (ergebnisse.delete(ziel)) melden();
}

export function useErgebnis(ziel: string): AssistentState | null {
  return useSyncExternalStore(
    abonnieren,
    () => {
      const e = ergebnisse.get(ziel);
      return e && Date.now() - e.zeit < LEBENSDAUER_MS ? e.state : null;
    },
    () => null,
  );
}

/**
 * Jüngstes frisches Ergebnis (höchstens eine Minute alt) unter mehreren Karten —
 * als „key|zeit“ (stabiler Wert für useSyncExternalStore) oder null.
 */
export function useFrischesErgebnis(keys: string[]): string | null {
  return useSyncExternalStore(
    abonnieren,
    () => {
      let best: string | null = null;
      let zeit = 0;
      for (const k of keys) {
        const e = ergebnisse.get(k);
        if (e && e.zeit > zeit && Date.now() - e.zeit < 60_000) {
          best = k;
          zeit = e.zeit;
        }
      }
      return best ? `${best}|${zeit}` : null;
    },
    () => null,
  );
}
