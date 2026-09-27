// Regeln der Automatik (Review 27.09.2026, Phase 1+2) — reine Definitionen ohne Speicherzugriff,
// damit sie sich testen lassen. Standard: jede Regel AUS, Probelauf AN, Not-Aus möglich.
// Die Automatik verkürzt nur das Warten auf den Klick: Sie ruft dieselben Prüfungen auf wie die
// Knöpfe (Unterschriften, Freigabeprüfung, Börsen-Lücken, Einladungssperren) und überspringt
// keinen der sieben Schritte. Kauf-Vorgänge bleiben ausgenommen (erst mit GwG-Ablauf).

export type RegelId = "r1" | "r2" | "r3" | "r4" | "r5" | "r7";

export type RegelDef = {
  id: RegelId;
  titel: string;
  beschreibung: string;
  /** Sendet die Regel E-Mails an Kunden? (zählt gegen das Tageslimit) */
  mails: boolean;
  /** Nur mit „§ 34c-Erlaubnis liegt vor“ UND „Vorlagen anwaltlich geprüft“. */
  rechtsschalter: boolean;
};

export const REGELN: RegelDef[] = [
  {
    id: "r1",
    titel: "R1 · Börse: nach Einwilligung sofort veröffentlichen",
    beschreibung:
      "Hat der Eigentümer im Kundenbereich eingewilligt und fehlt nichts (keine Lücken, kein Direktankauf, nicht vergeben), geht das Angebot anonym online. Der Eigentümer bekommt eine kurze Mail: online — Häkchen raus heißt offline. Von der Verwaltung offline genommene Angebote bleiben offline.",
    mails: true,
    rechtsschalter: false,
  },
  {
    id: "r2",
    titel: "R2 · Matching: passende Paare vormerken",
    beschreibung: "Neue Angebote, Gesuche und Unterschriften: Paare ab der eingestellten Übereinstimmung werden vorgemerkt. Es geht keine Mail raus.",
    mails: false,
    rechtsschalter: false,
  },
  {
    id: "r3",
    titel: "R3 · Einladung automatisch senden (nur Pacht)",
    beschreibung:
      "Neue Pacht-Gesuche und Pacht-Angebote mit gewähltem Weg „Vermitteln“ bekommen die Einladung zum Kundenbereich, sobald die Vorlage freigegeben ist. Angebote mit offenem Weg nicht — dort entscheiden Sie „Selbst kaufen“ oder „Vermitteln“.",
    mails: true,
    rechtsschalter: false,
  },
  {
    id: "r4",
    titel: "R4 · Anonyme Hinweise, sobald beide unterschrieben haben (nur Pacht)",
    beschreibung: "Für vorgemerkte Paare gehen die anonymen Hinweise mit Zustimmungslink an beide Seiten, sobald beide ihren Vertrag unterschrieben haben.",
    mails: true,
    rechtsschalter: true,
  },
  {
    id: "r5",
    titel: "R5 · Freigabe, sobald beide zugestimmt haben (nur Pacht)",
    beschreibung:
      "Liegen beide Zustimmungen vor und ist die Freigabeprüfung grün (bei Verbrauchern: Widerrufsfrist plus vier Tage oder Beginnwunsch), wird der Kontakt freigegeben und beide bekommen die Mitteilung. Wartet die Freigabe auf eine Frist, holt der tägliche Lauf sie nach.",
    mails: true,
    rechtsschalter: true,
  },
  {
    id: "r7",
    titel: "R7 · Erinnerungen (höchstens zwei: nach 3 und nach weiteren 7 Tagen, nur Pacht)",
    beschreibung: "Erinnert an offene Einladungen und an den zur Unterschrift liegenden Pachtvertrag — höchstens zweimal, im Abstand von 3 und 7 Tagen.",
    mails: true,
    rechtsschalter: false,
  },
];

export type AutomatikEinstellungen = {
  /** Not-Aus: nichts läuft, auch kein Probelauf. */
  notAus: boolean;
  /** Probelauf: nur protokollieren, was passieren würde („würde senden …“). */
  probelauf: boolean;
  regeln: Record<RegelId, boolean>;
  /** Höchstens so viele automatische Kunden-Mails je Tag (alle Regeln zusammen). */
  tageslimit: number;
  /** Tägliche Zusammenfassung an die Verwaltung. */
  zusammenfassung: boolean;
  /** R2: Paare ab dieser Übereinstimmung (Prozent) vormerken. */
  schwelle: number;
  /** Rechtliche Voraussetzungen für R4/R5 — von Dennis zu bestätigen. */
  recht34c: boolean;
  vorlagenGeprueft: boolean;
  geaendert?: { am: string; von: string };
};

export const STANDARD_AUTOMATIK: AutomatikEinstellungen = {
  notAus: false,
  probelauf: true,
  regeln: { r1: false, r2: false, r3: false, r4: false, r5: false, r7: false },
  tageslimit: 20,
  zusammenfassung: true,
  schwelle: 85,
  recht34c: false,
  vorlagenGeprueft: false,
};

export function automatikVon(roh: Partial<AutomatikEinstellungen> | undefined): AutomatikEinstellungen {
  return {
    ...STANDARD_AUTOMATIK,
    ...(roh ?? {}),
    regeln: { ...STANDARD_AUTOMATIK.regeln, ...(roh?.regeln ?? {}) },
  };
}

/** Ist die Regel wirksam (eingeschaltet, kein Not-Aus, Rechtsschalter bei R4/R5)? */
export function regelWirksam(a: AutomatikEinstellungen, id: RegelId): { an: boolean; grund?: string } {
  if (a.notAus) return { an: false, grund: "Not-Aus ist an" };
  if (!a.regeln[id]) return { an: false, grund: "Regel ist aus" };
  const def = REGELN.find((r) => r.id === id);
  if (def?.rechtsschalter && !(a.recht34c && a.vorlagenGeprueft)) {
    return { an: false, grund: "gesperrt, bis „§ 34c-Erlaubnis liegt vor“ und „Vorlagen anwaltlich geprüft“ bestätigt sind" };
  }
  return { an: true };
}

/**
 * R7: Ist eine Erinnerung fällig? `gesendet` = Zeitpunkte der bisherigen Mails dieses Zwecks in dieser
 * Runde (erste Mail zuerst). Höchstens zwei Erinnerungen: 3 Tage nach der ersten Mail, dann 7 Tage
 * nach der ersten Erinnerung.
 */
export function erinnerungFaellig(gesendet: string[], jetzt: Date): boolean {
  const zeiten = gesendet.map((x) => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  if (zeiten.length === 0 || zeiten.length >= 3) return false;
  const letzte = zeiten[zeiten.length - 1];
  const abstandTage = zeiten.length === 1 ? 3 : 7;
  return jetzt.getTime() - letzte >= abstandTage * 86_400_000;
}

/** Datum (Berlin) als YYYY-MM-DD — für Tagesprotokoll und Tageslimit. */
export function tagBerlin(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
