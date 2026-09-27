import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { jsonAendern, jsonLesen } from "./store";

// Sitzungen der Verwaltung beenden (Review S9): Die Sitzung ist ein signiertes Cookie ohne
// Datenbank. Damit ein verlorenes Gerät trotzdem ausgesperrt werden kann, gilt ein Zeitpunkt
// „nicht vor“ — Sitzungen, die davor ausgestellt wurden, sind ungültig. Die Datei wird
// zwischengespeichert und beim Ändern sofort erneuert (Tag).

type SitzungsSperren = {
  /** Unix-Sekunden: alle früher ausgestellten Sitzungen sind ungültig. */
  alleVor?: number;
  geaendert?: { am: string; von: string };
};

const PFAD = "admin/sitzungen.json";
export const SITZUNGEN_TAG = "admin-sitzungen";

const sperrenLesen = unstable_cache(async (): Promise<SitzungsSperren> => (await jsonLesen<SitzungsSperren>(PFAD))?.daten ?? {}, ["admin-sitzungen-v1"], {
  tags: [SITZUNGEN_TAG],
  revalidate: 600,
});

/** Ist eine Sitzung (ausgestellt zum Zeitpunkt `ausgestelltSek`) noch gültig? */
export async function sitzungNochGueltig(ausgestelltSek: number): Promise<boolean> {
  try {
    const s = await sperrenLesen();
    return !s.alleVor || ausgestelltSek >= s.alleVor;
  } catch (err) {
    // Speicher nicht erreichbar: niemanden aussperren (die Verwaltung braucht den Speicher ohnehin).
    console.error("[sitzungen] Sperrliste nicht lesbar", err);
    return true;
  }
}

/** Alle bisher ausgestellten Sitzungen (alle Geräte, alle Admins) beenden. */
export async function alleSitzungenBeenden(von: string): Promise<number> {
  const jetzt = Math.floor(Date.now() / 1000);
  await jsonAendern<SitzungsSperren>(PFAD, () => ({}), (d) => {
    d.alleVor = jetzt;
    d.geaendert = { am: new Date().toISOString(), von };
  });
  revalidateTag(SITZUNGEN_TAG, { expire: 0 });
  return jetzt;
}
