import "server-only";
import { boerseOfflineNehmen } from "@/lib/boerse";
import { mutateZustand } from "./store";

// Löschwunsch nach Art. 17 DSGVO (Review S5): Das System vermerkt den Wunsch, archiviert die Anfrage,
// nimmt ein Börsen-Angebot offline und hält die Monatsfrist (Art. 12 Abs. 3 DSGVO) als Aufgabe im
// Dashboard fest; die Aufgabe führt direkt zu „Vorgang endgültig löschen (DSGVO)“ (lib/admin/loeschen.ts,
// Verträge mit Aufbewahrungspflicht werden dabei nur gesperrt). „Ohne Löschen erledigt“ ist für Wünsche,
// die sich anders erledigt haben (zurückgenommen, unberechtigt).

export const LOESCH_FRIST_TAGE = 30;

export async function loeschwunschVermerken(id: string, von: string, notiz: string): Promise<boolean> {
  const am = new Date().toISOString();
  const frist = new Date(Date.now() + LOESCH_FRIST_TAGE * 86_400_000).toISOString();
  let ok = false;
  await mutateZustand(von, (z) => {
    ok = false;
    const meta = { ...(z.anfragen[id] ?? {}) };
    if (meta.loeschwunsch && !meta.loeschwunsch.erledigtAm) return;
    meta.loeschwunsch = { am, von, frist, ...(notiz ? { notiz: notiz.slice(0, 300) } : {}) };
    meta.status = "archiv";
    meta.geaendert = { am, von };
    z.anfragen[id] = meta;
    ok = true;
    return { was: `Löschwunsch vermerkt (Frist ${frist.slice(0, 10)}) — Anfrage archiviert${notiz ? `: ${notiz.slice(0, 120)}` : ""}`, ref: id };
  });
  if (ok) await boerseOfflineNehmen([id], "Löschwunsch des Eigentümers", von).catch((err) => console.error("[loeschwunsch] Börse", err));
  return ok;
}

export async function loeschwunschErledigt(id: string, von: string): Promise<boolean> {
  const am = new Date().toISOString();
  let ok = false;
  await mutateZustand(von, (z) => {
    ok = false;
    const meta = z.anfragen[id];
    if (!meta?.loeschwunsch || meta.loeschwunsch.erledigtAm) return;
    z.anfragen[id] = { ...meta, loeschwunsch: { ...meta.loeschwunsch, erledigtAm: am, erledigtVon: von }, geaendert: { am, von } };
    ok = true;
    return { was: "Löschwunsch ohne Löschen als erledigt vermerkt", ref: id };
  });
  return ok;
}
