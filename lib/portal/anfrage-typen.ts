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

/** Eingabefeld direkt an der Aktion (z. B. Kaufpreis-Angebot beim Direktankauf). */
export type AnfrageFeld = { name: string; label: string; tipp: string; platzhalter?: string };

export type AnfrageAktion = {
  /** einladen = vermitteln (Vereinbarung), ankauf = selbst kaufen, ergaenzen = weitere Fläche zur Vereinbarung, beantwortet = nur Status. */
  id: "einladen" | "beantwortet" | "ankauf" | "ergaenzen";
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
  felder?: AnfrageFeld[];
  /** Fingerabdruck des bestätigten Stands — der Server führt nur aus, wenn er noch gilt. */
  signatur: string;
};

export type AnfrageVorschlag = {
  art: "angebot" | "gesuch" | "auskunft";
  /** Ein Halbsatz: warum genau dieser Vorschlag. */
  warum: string;
  aktion: AnfrageAktion;
  /**
   * Weiche je Angebot (Dennis 27.09.2026): Solange der Weg offen ist, steht neben „Vermitteln“
   * die Alternative „Selbst kaufen“ (Direktankauf durch die TR Vertriebs GmbH).
   */
  alternativ?: AnfrageAktion;
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

/** Worum eine Anfrage bzw. ein Beratungswunsch geht — bestimmt den Antwortentwurf (lib/portal/antwort.ts). */
export type AntwortThema = "bewertung" | "verkauf" | "verpachtung" | "vergleich" | "energie" | "vns" | "oekopunkte" | "bauland" | "wald" | "lohnunternehmer" | "allgemein";

/** Fertiges Antwortschreiben zur Freigabe — mit der automatischen Einordnung, die dazu geführt hat. */
export type AntwortEntwurf = {
  thema: AntwortThema;
  /** Kurzform für die Anzeige, z. B. „Bewertung“. */
  themaName: string;
  /** Erkannte Eckdaten, z. B. „Ackerland“, „1,56 ha“, „Extertal“. */
  erkannt: string[];
  /** Hinweise nur für die Verwaltung (z. B. unsicher gelesene Größe). */
  hinweise: string[];
  /** Die Wertindikation in einem Satz — nur, wenn gerechnet werden konnte. */
  wert: string | null;
  an: string;
  betreff: string;
  text: string;
};
