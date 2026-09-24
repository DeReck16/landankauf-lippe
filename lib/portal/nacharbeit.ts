import "server-only";
import * as M from "./model";
import { aendereVorgang, ladeVorgang } from "./speicher";
import * as T from "./texte";

// Kleine Abläufe rund um einen Vorgang, die der Assistent (Dashboard) braucht:
// Kundenmeldungen als erledigt markieren, „kein Interesse“ zur Kenntnis nehmen,
// Provision mit Rechnungsdatum und Zahlungsziel abrechnen, Pachtanzeige
// vermerken, Vorgang nach der Freigabe ohne Abschluss beenden bzw. wieder
// aufnehmen. Jeder Schritt landet im Verlauf des Vorgangs.

function jetzt(): string {
  return new Date().toISOString();
}

export async function meldungErledigen(key: string, id: string, von: string, wie = ""): Promise<boolean> {
  const v = await ladeVorgang(key);
  if (!v) return false;
  let ok = false;
  await aendereVorgang(key, v.art, (x) => {
    const m = x.meldungen.find((y) => y.id === id);
    if (!m || m.erledigt) return false;
    m.erledigt = { am: jetzt(), von, ...(wie ? { wie } : {}) };
    ok = true;
    M.ereignis(
      x,
      von,
      "meldung-erledigt",
      `${m.art === "abschluss" ? "Meldung eines Vertragsschlusses" : "Rückfrage"} ${M.ROLLE_ARTIKEL[m.rolle].gen} vom ${T.datumDe(m.am)} als erledigt markiert${wie ? ` (${wie})` : ""}`,
    );
  });
  return ok;
}

export async function ablehnungErledigen(key: string, art: M.Art, von: string, fuer: string, rolle: M.Rolle): Promise<void> {
  await aendereVorgang(key, art, (x) => {
    if (x.ablehnungErledigt?.fuer === fuer) return false;
    x.ablehnungErledigt = { am: jetzt(), von, fuer };
    M.ereignis(x, von, "ablehnung-erledigt", `„Kein Interesse“ ${M.ROLLE_ARTIKEL[rolle].gen} zur Kenntnis genommen — das Paar ruht (keine Erinnerungen)`);
  });
}

/** Provision als abgerechnet vermerken — mit Rechnungsdatum und Zahlungsziel (Fälligkeit der Zahlung). */
export async function provisionAbrechnen(key: string, id: string, rechnung: { datum: string; faelligAm: string }, notiz: string, von: string): Promise<boolean> {
  const v = await ladeVorgang(key);
  if (!v) return false;
  let ok = false;
  await aendereVorgang(key, v.art, (x) => {
    const p = x.provisionen.find((q) => q.id === id);
    if (!p || (p.status !== "faellig" && p.status !== "abgerechnet")) return false;
    p.status = "abgerechnet";
    p.rechnung = rechnung;
    if (notiz) p.notiz = notiz;
    const was = `${M.PROVISION_STATUS.abgerechnet.label}: Rechnung vom ${T.tagDe(rechnung.datum)}, zahlbar bis ${T.tagDe(rechnung.faelligAm)}${notiz ? ` — ${notiz}` : ""}`;
    p.verlauf.unshift({ am: jetzt(), von, was });
    M.ereignis(x, von, "provision", `Provision ${p.id}: ${was}`);
    ok = true;
  });
  return ok;
}

export async function pachtAnzeigeVermerken(key: string, von: string): Promise<boolean> {
  let ok = false;
  await aendereVorgang(key, "pacht", (x) => {
    if (!x.pachtvertrag || x.pachtvertrag.anzeigeErledigtAm) return false;
    x.pachtvertrag.anzeigeErledigtAm = jetzt();
    M.ereignis(x, von, "pacht-anzeige", "Anzeige nach § 2 LPachtVG als erledigt vermerkt");
    ok = true;
  });
  return ok;
}

/** Keine Bitte um eine Google-Bewertung für diesen Vorgang (z. B. unzufriedener Kunde). */
export async function bewertungVerzichten(key: string, art: M.Art, von: string): Promise<void> {
  await aendereVorgang(key, art, (x) => {
    if (x.bewertungVerzicht) return false;
    x.bewertungVerzicht = { am: jetzt(), von };
    M.ereignis(x, von, "bewertung", "Keine Bitte um eine Google-Bewertung (Entscheidung der Verwaltung)");
  });
}

/** Nach der Freigabe ohne Abschluss beenden: nur aus den Listen nehmen — Freigabe und Nachweis bleiben. */
export async function vorgangBeenden(key: string, art: M.Art, von: string, grund: string): Promise<void> {
  await aendereVorgang(key, art, (x) => {
    if (x.beendet || x.abschluss) return false;
    x.beendet = { am: jetzt(), von, grund };
    M.ereignis(x, von, "beendet", `Vorgang ohne Abschluss beendet${grund ? `: ${grund}` : ""} (Freigabe und Nachweis bleiben bestehen)`);
  });
}

export async function vorgangWiederAufnehmen(key: string, art: M.Art, von: string): Promise<void> {
  await aendereVorgang(key, art, (x) => {
    if (!x.beendet) return false;
    delete x.beendet;
    M.ereignis(x, von, "wieder-aufgenommen", "Vorgang wieder aufgenommen");
  });
}
