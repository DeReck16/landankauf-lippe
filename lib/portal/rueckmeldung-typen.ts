// Rückmeldungen auf die Nachfass-Mail — gemeinsame Begriffe für die Antwortseite
// (/kunde/antwort), das Dashboard („Rückmeldungen“) und die Anfrage in der
// Verwaltung. Ohne Server-Abhängigkeit, damit auch Client-Komponenten sie nutzen.

// „pachten“/„kaufen“: Der Kunde sucht selbst eine Fläche — meist ein Missverständnis
// im Formular („Verpachten“ statt „Pachten“ angeklickt, Anlass Kellermann 25.09.2026).
export const RUECKMELDUNG_ARTEN = ["verkaufen", "verpachten", "pachten", "kaufen", "suche", "beratung", "kein-interesse"] as const;
export type RueckmeldungArt = (typeof RUECKMELDUNG_ARTEN)[number];

export function istRueckmeldungArt(x: string): x is RueckmeldungArt {
  return (RUECKMELDUNG_ARTEN as readonly string[]).includes(x);
}

/** Kurzform für Verwaltung, Verlauf und Meldungen. */
export const RUECKMELDUNG_NAME: Record<RueckmeldungArt, string> = {
  verkaufen: "möchte verkaufen",
  verpachten: "möchte verpachten",
  pachten: "sucht selbst eine Fläche zur Pacht",
  kaufen: "sucht selbst eine Fläche zum Kauf",
  suche: "sucht weiter",
  beratung: "möchte eine Beratung",
  "kein-interesse": "kein Interesse mehr",
};

/** Antworten, nach denen die Anfrage als Gesuch gilt (Gegenstück zu verkaufen/verpachten = Angebot). */
export function istSuchAntwort(art: RueckmeldungArt): art is "pachten" | "kaufen" {
  return art === "pachten" || art === "kaufen";
}

/** Themen einer Beratung — bewusst ohne Steuer- und Rechtsthemen. */
export const BERATUNG_THEMEN = [
  "Wert meiner Fläche (Bewertung)",
  "Verkaufen oder verpachten – was passt besser?",
  "Energiepacht (Solar/Wind)",
  "Vertragsnaturschutz / Ökopunkte",
  "Bauland / Bebauung",
  "Wald und Forst",
  "Bewirtschaftung / Lohnunternehmer",
  "Etwas anderes",
] as const;

export function istBeratungThema(x: string): boolean {
  return (BERATUNG_THEMEN as readonly string[]).includes(x);
}

/** Wer antwortet: Eigentümer (Angebot), Suchende (Gesuch) oder eine Anfrage ohne Fläche im Angebot/Gesuch. */
export type Antwortgruppe = "anbieter" | "suchender" | "beratung";

/** Aus der Einordnung der Anfrage (Rolle „angebot“, „gesuch“ oder „keine“). */
export function antwortGruppe(rolle: string): Antwortgruppe {
  return rolle === "gesuch" ? "suchender" : rolle === "angebot" ? "anbieter" : "beratung";
}

/**
 * Angebotene Antworten: Suchende suchen weiter, alle anderen können verkaufen oder verpachten.
 * Das bisherige Anliegen steht vorn (Verpachten bei Pachtangeboten, Beratung bei Auskünften).
 * Anbieter können auf der Antwortseite zusätzlich „Ich suche selbst eine Fläche“ wählen
 * (passend zur Art: Pacht bzw. Kauf; ohne Art — beim Prüfen — beide).
 * `verwaltung`: Die Verwaltung (E-Mail-Antwort, Postfach-Abgleich) darf jede Einordnung
 * wählen — auch ein Gesuch, das in Wahrheit anbietet, und umgekehrt.
 */
export function antwortOptionen(gruppe: Antwortgruppe, art?: string | null, verwaltung = false): RueckmeldungArt[] {
  if (verwaltung) {
    if (gruppe === "suchender") return ["suche", "beratung", "verpachten", "verkaufen", "kein-interesse"];
    if (gruppe === "beratung") return ["beratung", "verkaufen", "verpachten", "pachten", "kaufen", "kein-interesse"];
    return art === "pacht"
      ? ["verpachten", "verkaufen", "pachten", "kaufen", "beratung", "kein-interesse"]
      : ["verkaufen", "verpachten", "kaufen", "pachten", "beratung", "kein-interesse"];
  }
  if (gruppe === "suchender") return ["suche", "beratung", "kein-interesse"];
  if (gruppe === "beratung") return ["beratung", "verkaufen", "verpachten", "kein-interesse"];
  const selbst: RueckmeldungArt[] = art === "pacht" ? ["pachten"] : art === "kauf" ? ["kaufen"] : ["pachten", "kaufen"];
  return art === "pacht"
    ? ["verpachten", "verkaufen", "beratung", ...selbst, "kein-interesse"]
    : ["verkaufen", "verpachten", "beratung", ...selbst, "kein-interesse"];
}

/** Vorbelegtes Beratungsthema aus dem Anliegen des Formulars. */
export function themaVorschlag(intent: string, flaechentyp: string): string | undefined {
  const nachAnliegen: Record<string, string> = {
    Bewertung: "Wert meiner Fläche (Bewertung)",
    "Energiepacht (Solar/Wind)": "Energiepacht (Solar/Wind)",
    "VNS / Ökopunkte": "Vertragsnaturschutz / Ökopunkte",
    "Bauland-Beratung": "Bauland / Bebauung",
    Lohnunternehmer: "Bewirtschaftung / Lohnunternehmer",
  };
  return nachAnliegen[intent] ?? (flaechentyp === "Wald / Forst" ? "Wald und Forst" : undefined);
}
