import * as M from "./model";

// Radar nach der Freigabe (Dennis 02.11.2026: „wie prüfen wir, ob der Verkauf oder die Pacht zustande kam?
// … es muss einen Prüfmechanismus oder Nachfassen geben“ und „im Dashboard deutlich markieren, wo es
// ggf. zum Deal kam“). Reine Ableitungen aus der Vorgangsakte — keine Schreibzugriffe, keine Server-Abhängigkeit.
//
// 1. Stand-Nachfrage (Mail-Zweck „stand“): Nach der Freigabe fragt Lippe Forst beide Seiten nach, ob es zu einem
//    Vertrag kam — nach 7 Tagen, 14 Tage danach, dann alle 60 Tage, solange die Schutzfrist der Vereinbarungen läuft.
//    Der Takt ergibt sich aus den gesendeten Mails des Vorgangs (kein eigener Zähler).
// 2. Radar: Jeder freigegebene Vorgang ohne Abschluss bekommt eine Stufe — vom gemeldeten Vertragsschluss
//    bis „freigegeben, noch ruhig“. Das Dashboard zeigt sie oben als eigenen Abschnitt.

/** Erste Nachfrage so viele Tage nach der Freigabe. */
export const STAND_ERSTE_TAGE = 7;
/** Zweite Nachfrage so viele Tage nach der ersten. */
export const STAND_ZWEITE_TAGE = 14;
/** Danach alle so viele Tage. */
export const STAND_DANACH_TAGE = 60;
/** So lange nach der Freigabe wird nachgefragt (Schutzfrist der Anbieter-Vereinbarung: 24 Monate). */
export const STAND_ENDE_MONATE = 24;
/** Der Takt in Worten — eine Quelle für Tooltips, Sicherheitsabfrage und API-Fehler. */
export const STAND_TAKT_TEXT = `${STAND_ERSTE_TAGE} Tage nach der Freigabe, ${STAND_ZWEITE_TAGE} Tage danach, dann alle ${STAND_DANACH_TAGE} Tage, bis ${STAND_ENDE_MONATE} Monate nach der Freigabe`;

const TAG_MS = 86_400_000;

export type StandPlan = {
  /** Wie viele Stand-Nachfragen seit der Freigabe an diese Adresse gingen. */
  runde: number;
  zuletzt: string | null;
  /** Frühester Zeitpunkt der nächsten Nachfrage (ISO), null ohne aktive Freigabe oder nach Fristende. */
  faelligAb: string | null;
  faellig: boolean;
  /** Die Schutzfrist ist abgelaufen — keine Nachfragen mehr. */
  vorbei: boolean;
};

/** Stand-Nachfragen an eine Adresse: Takt und Fälligkeit (nur Mails seit der aktuellen Freigabe zählen). */
export function standPlan(v: M.VorgangRecord | null | undefined, an: string, jetzt: Date): StandPlan {
  const frei = v?.freigabe?.am;
  if (!v || !frei || !M.aktiveFreigabe(v)) return { runde: 0, zuletzt: null, faelligAb: null, faellig: false, vorbei: false };
  const adresse = an.trim().toLowerCase();
  const gesendet = v.mails
    .filter((m) => m.zweck === "stand" && m.ok && m.an.toLowerCase() === adresse && m.am >= frei)
    .map((m) => m.am)
    .sort();
  const runde = gesendet.length;
  const zuletzt = gesendet.at(-1) ?? null;
  const ende = new Date(Date.parse(frei));
  ende.setUTCMonth(ende.getUTCMonth() + STAND_ENDE_MONATE);
  const vorbei = jetzt.getTime() > ende.getTime();
  const abstandTage = runde === 0 ? STAND_ERSTE_TAGE : runde === 1 ? STAND_ZWEITE_TAGE : STAND_DANACH_TAGE;
  const basis = runde === 0 ? Date.parse(frei) : Date.parse(zuletzt!);
  const ab = new Date(basis + abstandTage * TAG_MS);
  return { runde, zuletzt, faelligAb: vorbei ? null : ab.toISOString(), faellig: !vorbei && jetzt.getTime() >= ab.getTime(), vorbei };
}

export type RadarStufe = "gemeldet" | "hinweis" | "ruhig" | "frisch";

/** Reihenfolge im Dashboard: zuerst, wo es nach einem Deal aussieht. */
export const RADAR_RANG: Record<RadarStufe, number> = { gemeldet: 0, hinweis: 1, ruhig: 2, frisch: 3 };

export type Radar = {
  stufe: RadarStufe;
  /** Kurzer Text für Marke und Zeile, z. B. „Vertragsschluss gemeldet“. */
  text: string;
  tipp: string;
  /** Seit wann (Freigabe bzw. Signal). */
  seit: string;
  /** Tage seit der Freigabe. */
  tage: number;
  /** Stand-Nachfragen seit der Freigabe (höchste Rundenzahl der beiden Seiten). */
  nachfragen: number;
  /** Nächste Nachfrage frühestens (ISO) — null, wenn keine mehr kommt. */
  naechste: string | null;
  /** Mindestens eine Nachfrage ist jetzt fällig. */
  faellig: boolean;
};

export type RadarEingabe = {
  jetzt: Date;
  /** E-Mail-Adressen beider Seiten (für den Nachfrage-Takt). */
  adressen: string[];
  /** Signal der Anfrage des Angebots nach der Freigabe: aus der Börse genommen, auf „Erledigt“ gesetzt. */
  angebotSignal?: { am: string; text: string } | null;
  /** Eine Seite hat „kein Interesse“ gemeldet — dann ist kein Deal zu erwarten. */
  abgelehnt?: boolean;
};

/** Stufe eines freigegebenen Vorgangs ohne Abschluss; null, wenn er nicht auf den Radar gehört. */
export function radarFuer(v: M.VorgangRecord | null | undefined, e: RadarEingabe): Radar | null {
  if (!v || !M.aktiveFreigabe(v) || v.abschluss || v.beendet || e.abgelehnt) return null;
  const frei = v.freigabe!.am;
  const tage = Math.max(0, Math.floor((e.jetzt.getTime() - Date.parse(frei)) / TAG_MS));
  const plaene = e.adressen.filter(Boolean).map((a) => standPlan(v, a, e.jetzt));
  const nachfragen = plaene.reduce((m, p) => Math.max(m, p.runde), 0);
  const naechste = plaene.map((p) => p.faelligAb).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
  const faellig = plaene.some((p) => p.faellig);
  const basis = { tage, nachfragen, naechste, faellig };

  const meldung = v.meldungen.find((m) => m.art === "abschluss" && !m.erledigt);
  if (meldung) {
    return { ...basis, stufe: "gemeldet", seit: meldung.am, text: "Vertragsschluss gemeldet", tipp: "Eine Seite hat im Kundenbereich oder per Mail gemeldet, dass ein Vertrag geschlossen wurde — prüfen und mit „Außerhalb geschlossen erfassen“ bzw. dem Vertrag im Vorgang erfassen, damit die Provision entsteht" };
  }
  if (e.angebotSignal && e.angebotSignal.am >= frei) {
    return { ...basis, stufe: "hinweis", seit: e.angebotSignal.am, text: e.angebotSignal.text, tipp: "Nach der Freigabe hat sich beim Angebot etwas getan, das nach einem Abschluss aussieht — bei den Beteiligten nachfragen" };
  }
  if (tage >= STAND_ERSTE_TAGE) {
    return {
      ...basis,
      stufe: "ruhig",
      seit: frei,
      text: `Seit ${tage} Tagen keine Rückmeldung`,
      tipp: `Freigegeben, aber weder Vertragsschluss noch Absage gemeldet${nachfragen ? ` (${nachfragen}. Nachfrage gesendet)` : ""} — der Stand wird per Stand-Nachfrage erfragt`,
    };
  }
  return { ...basis, stufe: "frisch", seit: frei, text: `Freigegeben vor ${tage} ${tage === 1 ? "Tag" : "Tagen"}`, tipp: `Die erste Stand-Nachfrage kommt ${STAND_ERSTE_TAGE} Tage nach der Freigabe` };
}
