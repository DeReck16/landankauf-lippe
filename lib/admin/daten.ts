import "server-only";
import { cache } from "react";
import { fehlendeOrte, orteNachschlagen } from "./geo";
import { leadView, type LeadView, type Zustand } from "./model";
import { listLeads, mutateZustand, readZustand } from "./store";

/** Einmal pro Seitenaufruf laden — Layout und Seite teilen sich das Ergebnis. */
export const ladeVerwaltung = cache(async (): Promise<{ leads: LeadView[]; zustand: Zustand }> => {
  const [roh, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  return { leads: roh.map((l) => leadView(l, zustand.anfragen[l.id])), zustand };
});

/** Fehlende Orte nachschlagen und im Zustand ablegen. Liefert, wie viele offen bleiben. */
export async function orteErgaenzen(von: string, texte: string[], maxDauerMs?: number): Promise<{ neu: number; offen: number }> {
  const { zustand } = await readZustand();
  const offen = fehlendeOrte(texte, zustand);
  if (offen.length === 0) return { neu: 0, offen: 0 };
  const neu = await orteNachschlagen(offen, maxDauerMs);
  const anzahl = Object.keys(neu).length;
  if (anzahl > 0) {
    await mutateZustand(von, (z) => {
      Object.assign(z.orte, neu);
    });
  }
  return { neu: anzahl, offen: offen.length - anzahl };
}
