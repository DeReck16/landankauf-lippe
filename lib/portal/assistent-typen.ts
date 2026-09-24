import type { MailZweck } from "./entwuerfe";
import type { Art, Rolle } from "./model";

// Typen des Klick-Assistenten (lib/portal/assistent.ts) — ohne Server-Abhängigkeit,
// damit die Oberfläche (app/admin/(intern)/Assistent.tsx) sie nutzen kann.

export type AssistentAktionId =
  | "vormerken"
  | "einladen"
  | "erinnern"
  | "hinweise"
  | "freigeben"
  | "freigabe-mitteilen"
  | "pacht-vorbereiten"
  | "pacht-unterschrift"
  | "pacht-erinnern"
  | "kauf-vorbereiten"
  | "kauf-bestaetigung"
  | "kauf-erinnern"
  | "kauf-beurkundet"
  | "kauf-wirksam"
  | "provision-abgerechnet"
  | "provision-bezahlt";

export const ASSISTENT_AKTIONEN: readonly AssistentAktionId[] = [
  "vormerken",
  "einladen",
  "erinnern",
  "hinweise",
  "freigeben",
  "freigabe-mitteilen",
  "pacht-vorbereiten",
  "pacht-unterschrift",
  "pacht-erinnern",
  "kauf-vorbereiten",
  "kauf-bestaetigung",
  "kauf-erinnern",
  "kauf-beurkundet",
  "kauf-wirksam",
  "provision-abgerechnet",
  "provision-bezahlt",
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

export type AssistentAktion = {
  id: AssistentAktionId;
  /** Beschriftung des einen Hauptknopfs. */
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
  /** Weiterführender Link, z. B. zum ausführlichen Formular oder zu den Vorlagen. */
  link?: { href: string; text: string; tipp: string };
  /** Jetzt zu erledigen (pulsiert) — nicht bloß eine Erinnerung während des Wartens. */
  dran: boolean;
  /** Betroffener Datensatz, z. B. die Provision. */
  ziel?: string;
  /** Fingerabdruck des bestätigten Stands — der Server führt nur aus, wenn er noch gilt. */
  signatur: string;
};

/** „Zustimmung telefonisch erfassen“ je Seite (sekundär, neben dem Hauptknopf). */
export type AssistentZustimmung = { rolle: Rolle; text: string; tipp: string; frage: string };

export type AssistentHinweis = { text: string; warn?: boolean };

export type AssistentPlan = {
  key: string;
  art: Art;
  /** Aktueller Schritt (1–7), null wenn verworfen oder alles erledigt. */
  nr: number | null;
  gesamt: number;
  titel: string;
  /** Stand in ein, zwei Sätzen. */
  stand: string;
  /** Worauf gerade gewartet wird. */
  warten: string[];
  hinweise: AssistentHinweis[];
  aktion: AssistentAktion | null;
  zustimmungen: AssistentZustimmung[];
  /** Wer ist am Zug: die Verwaltung („Jetzt dran“) oder Kunden, Notar, Behörde („Warten auf Kunden“). */
  amZug: "admin" | "kunde" | null;
  fertig: boolean;
  verworfen: boolean;
  /** Testmodus: Mails werden nur protokolliert. */
  test: boolean;
};
