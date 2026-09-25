// Typen für die Dashboard-Abschnitte „Neue Anfragen ohne Paar“ (vorgeschlagene
// Aktion je Anfrage, lib/portal/anfrage-vorschlag.ts) und „Nachfassen“
// (lib/portal/nachfassen.ts) — ohne Server-Abhängigkeit, damit die Oberfläche
// (app/admin/(intern)/dashboard/*) sie nutzen kann.

/** Eine E-Mail, die mit der Aktion rausgeht — so, wie sie in der Rückfrage gezeigt wird. */
export type AnfrageMail = {
  /** Empfänger für die Anzeige, z. B. „Anbieter (Hans Meier)“. */
  wer: string;
  an: string;
  betreff: string;
  text: string;
  /** Zusatz zur Anzeige, z. B. dass der Link erst beim Klick entsteht. */
  hinweis?: string;
  /** Zuletzt mit diesem Zweck gesendet — dann ist es eine erneute Mail. */
  zuletzt?: string;
};

export type AnfrageAktion = {
  id: "einladen" | "beantwortet";
  knopf: string;
  tipp: string;
  /** Überschrift der Rückfrage. */
  frage: string;
  /** Was beim Klick passiert — in einfachen Sätzen. */
  passiert: string[];
  mails: AnfrageMail[];
  /** Warum der Knopf (noch) nicht geht. */
  gesperrt?: string;
  /** Weiterführender Link neben dem Knopf, z. B. zu den Vorlagen. */
  link?: { href: string; text: string; tipp: string };
  /** Fingerabdruck des bestätigten Stands — der Server führt nur aus, wenn er noch gilt. */
  signatur: string;
};

export type AnfrageVorschlag = {
  art: "angebot" | "gesuch" | "auskunft";
  /** Ein Halbsatz: warum genau dieser Vorschlag. */
  warum: string;
  aktion: AnfrageAktion;
  /** „Antwort schreiben“ im eigenen Mailprogramm (nur reine Auskunft mit E-Mail-Adresse). */
  antworten: { href: string; an: string } | null;
};

/** Art der Nachfass-Mail (bestimmt Betreff und Frage). */
export type NachfassTyp = "verkauf" | "verpachtung" | "suche-pacht" | "suche-kauf" | "beratung";

export const NACHFASS_TYP_NAME: Record<NachfassTyp, string> = {
  verkauf: "Verkauf",
  verpachtung: "Verpachtung",
  "suche-pacht": "Suche zur Pacht",
  "suche-kauf": "Suche zum Kauf",
  beratung: "Beratung",
};

export type NachfassKandidat = {
  id: string;
  name: string;
  /** Anliegen aus dem Formular, z. B. „Verpachten“. */
  anliegen: string;
  typ: NachfassTyp;
  /** Eingang der Anfrage (ISO). */
  eingang: string;
  letzterKontakt: { am: string; text: string } | null;
  an: string;
  betreff: string;
  text: string;
  /** Seit wann die Anfrage fürs Nachfassen in Frage kommt (ISO) — für das Pulsieren. */
  seit: string;
  /** Neu in der Liste seit dem letzten Besuch (pulsiert). */
  neu: boolean;
};
