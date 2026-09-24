import type { MailZweck } from "./entwuerfe";
import type { Art, Rolle } from "./model";

// Typen des Klick-Assistenten (lib/portal/assistent.ts) — ohne Server-Abhängigkeit,
// damit die Oberfläche (app/admin/(intern)/Assistent.tsx) sie nutzen kann.

export type AssistentAktionId =
  | "vormerken"
  | "einladen"
  | "erinnern"
  | "hinweise"
  | "zustimmung"
  | "freigeben"
  | "freigabe-mitteilen"
  | "freigabe-zurueckziehen"
  | "pacht-vorbereiten"
  | "pacht-unterschrift"
  | "pacht-erinnern"
  | "pacht-zurueck"
  | "kauf-vorbereiten"
  | "kauf-bestaetigung"
  | "kauf-erinnern"
  | "kauf-zurueck"
  | "kauf-beurkundet"
  | "kauf-wirksam"
  | "extern"
  | "provision-abgerechnet"
  | "provision-bezahlt"
  | "anzeige-vermerken"
  | "anzeige-erinnern"
  | "bewertung-bitten"
  | "bewertung-verzicht"
  | "meldung-erledigt"
  | "ablehnung-erledigt"
  | "paar-beenden"
  | "wieder-aufnehmen";

export const ASSISTENT_AKTIONEN: readonly AssistentAktionId[] = [
  "vormerken",
  "einladen",
  "erinnern",
  "hinweise",
  "zustimmung",
  "freigeben",
  "freigabe-mitteilen",
  "freigabe-zurueckziehen",
  "pacht-vorbereiten",
  "pacht-unterschrift",
  "pacht-erinnern",
  "pacht-zurueck",
  "kauf-vorbereiten",
  "kauf-bestaetigung",
  "kauf-erinnern",
  "kauf-zurueck",
  "kauf-beurkundet",
  "kauf-wirksam",
  "extern",
  "provision-abgerechnet",
  "provision-bezahlt",
  "anzeige-vermerken",
  "anzeige-erinnern",
  "bewertung-bitten",
  "bewertung-verzicht",
  "meldung-erledigt",
  "ablehnung-erledigt",
  "paar-beenden",
  "wieder-aufnehmen",
];

/** Eine E-Mail, die mit der Aktion rausgeht — so, wie sie in der Sicherheitsabfrage gezeigt wird. */
export type AssistentMail = {
  zweck: MailZweck;
  rolle: Rolle;
  kundeId: string;
  /** Empfänger für die Anzeige, z. B. „Anbieter (Hans Meier)“. */
  wer: string;
  /** Dasselbe im Akkusativ für Sätze, z. B. „den Suchenden (Eva Busch)“. */
  werAkk: string;
  an: string;
  betreff: string;
  text: string;
  /** Vor dem Senden wird ein neuer persönlicher Einladungslink erstellt. */
  neuerLink?: boolean;
  /** Zuletzt mit diesem Zweck an diese Adresse gesendet (dann ist es eine Erinnerung). */
  zuletzt?: string;
  /** Zusatz zur Anzeige, z. B. dass der Link erst beim Klick entsteht. */
  hinweis?: string;
};

/** Eingabefeld direkt im Assistenten (z. B. Pachtzins, Kaufpreis, Datum der Beurkundung). */
export type AssistentFeld = {
  name: string;
  label: string;
  tipp: string;
  typ: "zahl" | "datum" | "text" | "auswahl";
  pflicht?: boolean;
  wert?: string;
  platzhalter?: string;
  optionen?: { wert: string; label: string }[];
};

export type AssistentLink = { href: string; text: string; tipp: string };

export type AssistentAktion = {
  id: AssistentAktionId;
  /** Worauf sich die Aktion bezieht, z. B. die Meldung, die Provision oder die Seite („anbieter“). */
  ziel?: string;
  /** Beschriftung des Knopfs. */
  knopf: string;
  tipp: string;
  /** Überschrift der Sicherheitsabfrage. */
  frage: string;
  /** Was beim Klick passiert — in einfachen Sätzen. */
  passiert: string[];
  mails: AssistentMail[];
  /** Mails, die das System als Folge selbst verschickt (Text steht danach im Verlauf). */
  folgeMails?: string[];
  felder?: AssistentFeld[];
  /** Fläche in ha — für die Vorschau „Pachtzins → Jahrespacht“. */
  flaecheHa?: number | null;
  /** Warum der Knopf (noch) nicht geht. */
  gesperrt?: string;
  /** Weiterführender Link neben dem Knopf, z. B. zum ausführlichen Formular oder zu den Vorlagen. */
  link?: AssistentLink;
  /** Link in der Sicherheitsabfrage, z. B. „Vertragstext ansehen“. */
  vorschau?: AssistentLink;
  /** Jetzt zu erledigen (großer Knopf, pulsiert) — sonst ein ruhiges Angebot. */
  dran: boolean;
  /** Hauptknopf, ruhiger Zusatzknopf daneben oder unter „Weitere Aktionen“. */
  platz: "haupt" | "zusatz" | "weitere";
  /** Fingerabdruck des bestätigten Stands — der Server führt nur aus, wenn er noch gilt. */
  signatur: string;
};

/** Eine offene Meldung aus dem Kundenbereich (Rückfrage, Vertragsschluss, kein Interesse). */
export type AssistentMeldung = {
  id: string;
  art: "rueckfrage" | "abschluss" | "ablehnung";
  am: string;
  /** z. B. „Suchender (Eva Busch)“ */
  wer: string;
  titel: string;
  text: string;
  /** Antworten im eigenen Mailprogramm (wird nicht im Verlauf gespeichert). */
  antworten?: AssistentLink;
  /** Erste Aktion = Hauptknopf der Meldung. */
  aktionen: AssistentAktion[];
};

export type AssistentHinweis = { text: string; warn?: boolean };

/** Worauf gewartet wird — mit Zeitpunkt, seit dem gewartet wird. */
export type AssistentWarten = { text: string; seit?: string };

export type AssistentChip = { text: string; art: "ok" | "warn" | "rot" | "grau"; tipp: string; href?: string };

export type AssistentPlan = {
  key: string;
  art: Art;
  /** Berechnet am (ISO) — Bezugspunkt für „wartet seit …“ (auf Server und Browser gleich). */
  am: string;
  /** Aktueller Schritt (1–7), null wenn verworfen oder alles erledigt. */
  nr: number | null;
  gesamt: number;
  titel: string;
  /** Stand in ein, zwei Sätzen. */
  stand: string;
  warten: AssistentWarten[];
  /** Seit wann (am längsten) gewartet wird. */
  wartetSeit: string | null;
  hinweise: AssistentHinweis[];
  meldungen: AssistentMeldung[];
  /** Der eine Hauptknopf für den nächsten Schritt. */
  aktion: AssistentAktion | null;
  /** Zusatzknöpfe und „Weitere Aktionen“. */
  neben: AssistentAktion[];
  chips: AssistentChip[];
  /** Wer ist am Zug: die Verwaltung („Jetzt dran“) oder Kunden, Notar, Behörde („Warten“). */
  amZug: "admin" | "kunde" | null;
  fertig: boolean;
  verworfen: boolean;
  beendet: boolean;
  /** Testmodus: Mails werden nur protokolliert. */
  test: boolean;
};

/** Alle ausführbaren Aktionen eines Plans (Hauptknopf, Meldungen, Zusatz, Weitere). */
export function alleAktionen(p: AssistentPlan): AssistentAktion[] {
  return [...(p.aktion ? [p.aktion] : []), ...p.meldungen.flatMap((m) => m.aktionen), ...p.neben];
}

/** „seit heute“, „seit gestern“, „seit 3 Tagen“ — bezogen auf einen festen Zeitpunkt (auf Server und Browser gleich). */
export function seitText(seit: string, bezug: string): string {
  const tage = Math.floor((Date.parse(bezug) - Date.parse(seit)) / 86_400_000);
  return tage <= 0 ? "seit heute" : tage === 1 ? "seit gestern" : `seit ${tage} Tagen`;
}
