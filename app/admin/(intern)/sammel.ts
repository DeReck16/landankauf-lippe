"use client";

import { useSyncExternalStore } from "react";

// Auswahl der Zeilen für „Ausgewählte veröffentlichen“ in der Anfragen-Liste. Die Zeilen (SammelKasten) und die Leiste
// (SammelLeiste) sind getrennte Client-Komponenten und teilen sich diese kleine Ablage im Browser — es wird nichts gespeichert.

const LEER: ReadonlySet<string> = new Set();
let auswahl: ReadonlySet<string> = LEER;
const hoerer = new Set<() => void>();

function setze(neu: ReadonlySet<string>) {
  auswahl = neu;
  hoerer.forEach((f) => f());
}

function abonnieren(f: () => void) {
  hoerer.add(f);
  return () => {
    hoerer.delete(f);
  };
}

export function useAuswahl(): ReadonlySet<string> {
  return useSyncExternalStore(abonnieren, () => auswahl, () => LEER);
}

export function waehle(id: string, an: boolean) {
  const neu = new Set(auswahl);
  if (an) neu.add(id);
  else neu.delete(id);
  setze(neu);
}

export function waehleViele(ids: string[]) {
  setze(new Set([...auswahl, ...ids]));
}

export function leere() {
  setze(LEER);
}
