// Datenmodell für Onboarding, Kundenbereich, Vorgänge und Provision.
//
// Speicher (privater Blob „lippe-forst-privat“, jeweils mit Daten-Präfix):
//   portal/kunden/<LL-ID>.json          — eine Datei je Kunde (= Anfrage + Rolle)
//   portal/vorgaenge/<Angebot~Gesuch>.json — eine Datei je Paar (Freigabe, Verträge, Provision)
//   portal/einstellungen.json            — Vorlagen-Freigaben, Kaufprovision
//   portal/dokumente/<art>/<id>/<DOK>.pdf  — unveränderliche Dokumente (nie überschrieben)
//   admin/gesehen/<hash>.json            — „zuletzt gesehen“ je Admin (für das Pulsieren)
//
// Diese Datei ist frei von Server-Abhängigkeiten, damit Typen und Ableitungen
// überall nutzbar sind.

export type Rolle = "anbieter" | "suchender";
export type Art = "pacht" | "kauf";
export type Eigenschaft = "verbraucher" | "unternehmer";
export type Eingang = "online" | "email" | "post" | "telefon" | "sonstig";

export const ROLLE_NAME: Record<Rolle, string> = { anbieter: "Anbieter", suchender: "Suchender" };

/** Rolle mit bestimmtem Artikel — „Suchender“ wird wie ein Adjektiv dekliniert („der Suchende“, „des Suchenden“). */
export const ROLLE_ARTIKEL: Record<Rolle, { nom: string; gen: string; dat: string; akk: string }> = {
  anbieter: { nom: "der Anbieter", gen: "des Anbieters", dat: "dem Anbieter", akk: "den Anbieter" },
  suchender: { nom: "der Suchende", gen: "des Suchenden", dat: "dem Suchenden", akk: "den Suchenden" },
};

export type Flaeche = {
  gemarkung: string;
  flur: string;
  flurstueck: string;
  groesseHa: number | null;
  nutzung: string;
};

export type Stammdaten = {
  name: string;
  betrieb: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  eigenschaft: Eigenschaft;
  geaendertAm: string;
};

/** Protokoll einer Online-Unterschrift (Namenseingabe + Knopf). */
export type Signatur = {
  name: string;
  email: string;
  am: string;
  ip: string;
  userAgent: string;
  textHash: string;
  vorlageId: string;
  vorlageVersion: string;
  erklaerungen: { id: string; text: string }[];
  sitzung: string;
};

export type DokumentArt =
  | "maklervertrag"
  | "anbietervereinbarung"
  | "pachtvertrag"
  | "kaufabsicht"
  | "bestaetigung"
  | "upload";

export const DOKUMENT_ART_NAME: Record<DokumentArt, string> = {
  maklervertrag: "Nachweis-/Maklervertrag",
  anbietervereinbarung: "Vereinbarung Anbieter",
  pachtvertrag: "Landpachtvertrag",
  kaufabsicht: "Kaufabsicht / Eckdaten",
  bestaetigung: "Bestätigung",
  upload: "Hochgeladenes Dokument",
};

export type DokumentMeta = {
  id: string;
  art: DokumentArt;
  titel: string;
  dateiname: string;
  pfad: string;
  contentType: string;
  groesse: number;
  sha256: string;
  erstelltAm: string;
  von: string;
  version?: string;
  /** Welche Kundenseite das Dokument im Kundenbereich sieht (leer = nur Verwaltung). */
  sichtbarFuer: Rolle[];
  /** Vorversion, die dieses Dokument ersetzt. */
  ersetzt?: string;
};

export type Ereignis = { id: string; am: string; von: string; art: string; text: string };

export type GesendeteMail = {
  id: string;
  am: string;
  von: string;
  an: string;
  betreff: string;
  text: string;
  zweck: string;
  test: boolean;
  ok: boolean;
  fehler?: string;
  anhang?: string;
};

export type KundenVertrag = {
  vorlageId: string;
  version: string;
  titel: string;
  dokumentId: string;
  signatur: Signatur;
  eigenschaft: Eigenschaft;
  /** § 356 Abs. 4 BGB: ausdrücklicher Wunsch, dass vor Ablauf der Widerrufsfrist begonnen wird. */
  beginnwunschAm: string | null;
  /** Ende der 14-tägigen Widerrufsfrist (nur Verbraucher). */
  widerrufsfristEnde: string | null;
  /** § 312f BGB: Vertragsbestätigung auf dauerhaftem Datenträger (PDF per E-Mail) versandt. */
  bestaetigungGesendetAm: string | null;
  /** Nur Suchende: die bei Unterschrift geltenden Provisionskonditionen samt Version. */
  konditionen: VertragsKonditionen | null;
  /**
   * Anbieter mit mehreren Flächen: dieselbe Vereinbarung, unterschrieben über eine andere Anfrage
   * (lib/portal/anbieter-gruppe.ts). Alle Kopien teilen die dokumentId — Kündigung/Widerruf gilt für alle.
   */
  uebernommenVon?: string;
};

export type Erklaerung = { am: string; eingang: Eingang; erfasstVon: string; notiz?: string; bestaetigtAm?: string };

export type KundeRecord = {
  v: 1;
  id: string;
  rolle: Rolle;
  art: Art;
  email: string;
  /** Name laut Anfrage (bei eingestellten Flächen der Eigentümer) — trennt Eigentümer mit gleicher E-Mail-Adresse. */
  name?: string;
  angelegtAm: string;
  angelegtVon: string;
  einladung?: {
    nonce: string;
    bis: string;
    erstelltAm: string;
    von: string;
    gesendetAm?: string;
    angenommenAm?: string;
    /** Anbieter mit mehreren Flächen: eingeladen über diese andere Anfrage — keine eigene Einladungs-Mail. */
    ueber?: string;
    /** Nur vermerkt (Kopie der Einladung von `ueber`) — für diese Anfrage wurde nie ein eigener Link verschickt. */
    kopie?: true;
  };
  /** Sitzungen, die vor diesem Zeitpunkt ausgestellt wurden, gelten nicht mehr. */
  zugangAb?: string;
  gesperrt?: { am: string; von: string };
  stammdaten?: Stammdaten;
  flaechen?: Flaeche[];
  vertrag?: KundenVertrag;
  widerruf?: Erklaerung;
  kuendigung?: Erklaerung;
  /** Danke-Dialog nach dem Abschluss geschlossen (Vorgang → Zeitpunkt). */
  dankeGesehen?: Record<string, string>;
  /** Widerspruch gegen Bewertungs-E-Mails (per Antwort o. Ä., von der Verwaltung erfasst). */
  bewertungsWiderspruch?: { am: string; von: string };
  dokumente: DokumentMeta[];
  ereignisse: Ereignis[];
  mails: GesendeteMail[];
};

// ---------------------------------------------------------------------------
// Vorgang = ein Paar aus Angebot und Gesuch

export type PachtDaten = {
  verpaechter: { name: string; anschrift: string };
  paechter: { name: string; anschrift: string; betrieb: string };
  flaechen: Flaeche[];
  nutzungsart: string;
  pachtBeginn: string;
  laufzeitJahre: number | null;
  pachtjahr: "kalenderjahr" | "wirtschaftsjahr";
  pachtzinsJeHa: number | null;
  /** Pachtzins für ein volles Pachtjahr (netto). Leer = €/ha × Fläche. */
  pachtzinsJahr: number | null;
  /** Abweichende Jahrespacht einzelner Pachtjahre (Staffelpacht), z. B. Jahr 3 → 9.000 €. */
  staffel: { pachtjahr: number; betrag: number }[];
  zahlweise: "jaehrlich" | "halbjaehrlich";
  faelligkeit: string;
  umsatzsteuer: "ohne" | "zuzueglich";
  kontoinhaber: string;
  iban: string;
  wasserverband: "verpaechter" | "paechter";
  verpflichtungen: string;
  besonderes: string;
};

export type PachtvertragStand = {
  status: "entwurf" | "zur_unterschrift" | "abgeschlossen" | "verworfen";
  daten: PachtDaten;
  textHash?: string;
  erstelltAm: string;
  von: string;
  geaendertAm: string;
  unterschriften: { verpaechter?: Signatur; paechter?: Signatur };
  dokumentId?: string;
  abgeschlossenAm?: string;
  /** Erinnerung an die Anzeige nach § 2 LPachtVG (Verpächter, binnen eines Monats). */
  anzeigeErledigtAm?: string;
};

export type KaufDaten = {
  verkaeufer: { name: string; anschrift: string };
  kaeufer: { name: string; anschrift: string; betrieb: string };
  flaechen: Flaeche[];
  kaufpreis: number | null;
  uebergabe: string;
  bestehendePacht: string;
  notarWunsch: string;
  besonderes: string;
};

export type KaufStand = {
  status: "entwurf" | "zur_bestaetigung" | "bestaetigt" | "beurkundet" | "wirksam" | "abgebrochen";
  daten: KaufDaten;
  textHash?: string;
  erstelltAm: string;
  von: string;
  geaendertAm: string;
  bestaetigungen: { verkaeufer?: Signatur; kaeufer?: Signatur };
  notar: {
    name?: string;
    termin?: string;
    beurkundetAm?: string;
    kaufpreis?: number | null;
    genehmigung?: "offen" | "nicht_noetig" | "beantragt" | "erteilt" | "versagt";
    wirksamAm?: string;
  };
  dokumentId?: string;
};

export const PROVISION_STATUS = {
  aufschiebend: { label: "Entstanden (aufschiebend)", tipp: "Vertrag geschlossen, aber noch nicht wirksam (z. B. Genehmigung nach GrdstVG steht aus) — noch nicht fällig." },
  faellig: { label: "Fällig", tipp: "Anspruch entstanden und fällig — Rechnung durch die Buchhaltung steht aus." },
  abgerechnet: { label: "Abgerechnet", tipp: "Die Buchhaltung hat die Rechnung gestellt; Zahlung steht aus." },
  bezahlt: { label: "Bezahlt", tipp: "Zahlung ist eingegangen." },
  storniert: { label: "Storniert", tipp: "Anspruch wird nicht geltend gemacht (Grund in der Notiz)." },
} as const;
export type ProvisionStatus = keyof typeof PROVISION_STATUS;

export type Provision = {
  id: string;
  grundlage: "pachtvertrag" | "kaufvertrag" | "extern";
  art: Art;
  /** Bemessungsgrundlage: maßgebliche Jahrespacht bzw. Kaufpreis. */
  bemessung: number | null;
  /** Konditionen aus dem unterschriebenen Vertrag des Suchenden (null = Vertrag fehlt). */
  konditionen: VertragsKonditionen | null;
  netto: number | null;
  ustProzent: number;
  brutto: number | null;
  entstandenAm: string;
  faelligAm: string | null;
  status: ProvisionStatus;
  /** Angerechneter Treue-Gutschein (Preisnachlass auf diese Provision, Bruttobetrag). */
  gutschein?: { code: string; abzugBrutto: number };
  /** Rechnung der Buchhaltung (nur zur Nachverfolgung, keine Rechnungsnummer): Datum und Zahlungsziel. */
  rechnung?: { datum: string; faelligAm: string };
  notiz?: string;
  verlauf: { am: string; von: string; was: string }[];
};

/** Standard-Zahlungsziel einer Provisionsrechnung in Tagen. */
export const ZAHLUNGSZIEL_TAGE = 14;

/** Bis wann eine abgerechnete Provision zu zahlen ist (YYYY-MM-DD); ältere Einträge ohne Rechnungsdatum: Abrechnung + 14 Tage. */
export function provisionZahlungBis(p: Provision): string | null {
  if (p.status !== "abgerechnet") return null;
  if (p.rechnung?.faelligAm) return p.rechnung.faelligAm;
  const ab = p.verlauf.find((x) => x.was.startsWith(PROVISION_STATUS.abgerechnet.label))?.am;
  if (!ab) return null;
  return new Date(Date.parse(ab) + ZAHLUNGSZIEL_TAGE * 86_400_000).toISOString().slice(0, 10);
}

/** Beträge nach Anrechnung eines Gutscheins (Preisnachlass, USt-Anteil sinkt mit). */
export function provisionNachGutschein(p: Provision): { netto: number | null; brutto: number | null } {
  if (!p.gutschein || p.brutto == null) return { netto: p.netto, brutto: p.brutto };
  const brutto = Math.max(0, runde2(p.brutto - p.gutschein.abzugBrutto));
  return { netto: runde2(brutto / (1 + p.ustProzent / 100)), brutto };
}

export type ExternerVertrag = {
  id: string;
  art: Art;
  datum: string;
  flaecheHa: number | null;
  betrag: number | null;
  quelle: string;
  notiz: string;
  erfasstAm: string;
  von: string;
  dokumentId?: string;
  provisionId?: string;
};

export type KundenMeldung = {
  id: string;
  am: string;
  rolle: Rolle;
  art: "abschluss" | "rueckfrage";
  text: string;
  /** Von der Verwaltung als bearbeitet markiert (sonst steht der Vorgang unter „Jetzt dran“). */
  erledigt?: { am: string; von: string; wie?: string };
};

export type Gutschein = {
  code: string;
  /** Bruttobetrag, um den die nächste Provision sinkt. */
  betrag: number;
  kundeId: string;
  ausgegebenAm: string;
  gueltigBis: string;
  von: string;
  /** Anrechnung auf die Provision eines späteren Vorgangs. */
  eingeloest?: { am: string; von: string; vorgang: string };
  storniert?: { am: string; von: string; grund: string };
};

export type VorgangRecord = {
  v: 1;
  key: string;
  angebotId: string;
  gesuchId: string;
  art: Art;
  angelegtAm: string;
  hinweise?: { anbieter?: string; suchender?: string };
  freigabe?: { am: string; von: string; zurueckgezogen?: { am: string; von: string; grund: string } };
  pachtvertrag?: PachtvertragStand;
  kauf?: KaufStand;
  externeVertraege: ExternerVertrag[];
  provisionen: Provision[];
  meldungen: KundenMeldung[];
  /** Erfolgreicher Abschluss (Pachtvertrag beidseitig unterschrieben, Kauf beurkundet, extern erfasst). */
  abschluss?: { am: string; grundlage: "pachtvertrag" | "kaufvertrag" | "extern" };
  /** Bitte um Google-Bewertung: Follow-up-Mail je Seite gesendet am. */
  bewertung?: { anbieter?: string; suchender?: string };
  /** Die Verwaltung hat entschieden, bei diesem Vorgang nicht um eine Bewertung zu bitten. */
  bewertungVerzicht?: { am: string; von: string };
  /** Treue-Gutschein fürs nächste Geschäft (unabhängig von Bewertungen). */
  gutschein?: Gutschein;
  /** „Kein Interesse“ einer Seite zur Kenntnis genommen — das Paar ruht (`fuer` = Zeitpunkt der Ablehnung). */
  ablehnungErledigt?: { am: string; von: string; fuer: string };
  /**
   * Nach der Freigabe ohne Abschluss beendet (z. B. keine Einigung) — betrifft nur die
   * Übersicht der Verwaltung; Freigabe und Nachweis bleiben unverändert bestehen.
   */
  beendet?: { am: string; von: string; grund: string };
  dokumente: DokumentMeta[];
  ereignisse: Ereignis[];
  mails: GesendeteMail[];
};

// ---------------------------------------------------------------------------
// Einstellungen und „gesehen“

export type VorlagenFreigabe = {
  version: string;
  hash: string;
  am: string;
  von: string;
  zurueckgezogen?: { am: string; von: string };
};

/** „zuzueglich“ = Betrag ist netto, USt kommt hinzu; „inklusive“ = Betrag enthält die USt. */
export type UstModus = "zuzueglich" | "inklusive";

/**
 * Provisionskonditionen für Suchende (Anbieter zahlen nie). Änderbar in der
 * Verwaltung; jede Änderung erhöht die Version. Der unterschriebene Vertrag
 * hält die Konditionen samt Version fest — spätere Änderungen gelten nur für
 * neu unterschriebene Verträge.
 */
export type Konditionen = {
  /** Pacht: Vielfaches der vollen Jahrespacht (Standard 1). */
  pachtJahrespachten: number;
  /** Kauf: Prozent vom beurkundeten Kaufpreis (Standard 3,59). */
  kaufProzent: number;
  /** Ob die Sätze netto zzgl. USt oder inkl. USt gelten — je Art, zentral umschaltbar. */
  ust: { pacht: UstModus; kauf: UstModus };
  ustProzent: number;
};

export const STANDARD_KONDITIONEN: Konditionen = {
  pachtJahrespachten: 1,
  kaufProzent: 3.59,
  ust: { pacht: "zuzueglich", kauf: "zuzueglich" },
  ustProzent: 19,
};

export type VertragsKonditionen = Konditionen & { version: number };

/**
 * Bitte um eine Google-Bewertung nach erfolgreichem Abschluss — ohne jeden Anreiz,
 * an alle abgeschlossenen Kunden beider Seiten, ohne vorgeschaltete Zufriedenheitsabfrage.
 */
export type BewertungsEinstellung = {
  /** Bewertungslink (Google-Unternehmensprofil); leer = Env GOOGLE_REVIEW_URL; fehlt beides, keine Bitte. */
  url: string;
  /** Follow-up-Mail frühestens so viele Tage nach dem Abschluss. */
  nachTagen: number;
  /** Automatischer Versand der fälligen Follow-up-Mails (täglicher Cron) — Standard AUS. */
  autoVersand: boolean;
};

/** Treue-Gutschein fürs nächste Geschäft — unabhängig von jeder Bewertung. Standard AUS. */
export type GutscheinEinstellung = { aktiv: boolean; betrag: number };

export type Einstellungen = {
  v: 1;
  freigaben: Record<string, VorlagenFreigabe[]>;
  konditionen: Konditionen;
  konditionenVersion: number;
  konditionenVerlauf: { version: number; konditionen: Konditionen; am: string; von: string }[];
  bewertung: BewertungsEinstellung;
  gutschein: GutscheinEinstellung;
};

export const STANDARD_BEWERTUNG: BewertungsEinstellung = { url: "", nachTagen: 3, autoVersand: false };
export const STANDARD_GUTSCHEIN: GutscheinEinstellung = { aktiv: true, betrag: 100 };

/** Gültig bis zum Ende des dritten Kalenderjahres nach der Ausgabe (angelehnt an §§ 195, 199 BGB). */
export function gutscheinGueltigBis(ausgegebenAm: string): string {
  const jahr = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }).format(new Date(ausgegebenAm)));
  return `${jahr + 3}-12-31`;
}

export function gutscheinCode(): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += zeichen[Math.floor(Math.random() * zeichen.length)];
  return `LF-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function leereEinstellungen(): Einstellungen {
  return {
    v: 1,
    freigaben: {},
    konditionen: structuredClone(STANDARD_KONDITIONEN),
    konditionenVersion: 1,
    konditionenVerlauf: [],
    bewertung: { ...STANDARD_BEWERTUNG },
    gutschein: { ...STANDARD_GUTSCHEIN },
  };
}

/** Wirksamer Bewertungslink: Einstellung vor Env; nur https-Links. */
export function bewertungsUrl(e: Einstellungen, env?: string): string | null {
  const url = (e.bewertung?.url || env || "").trim();
  return /^https:\/\/[^\s]+$/.test(url) ? url : null;
}

export function aktuelleKonditionen(e: Einstellungen): VertragsKonditionen {
  const k = e.konditionen ?? STANDARD_KONDITIONEN;
  return {
    pachtJahrespachten: k.pachtJahrespachten ?? STANDARD_KONDITIONEN.pachtJahrespachten,
    kaufProzent: k.kaufProzent ?? STANDARD_KONDITIONEN.kaufProzent,
    ust: { ...STANDARD_KONDITIONEN.ust, ...(k.ust ?? {}) },
    ustProzent: k.ustProzent ?? STANDARD_KONDITIONEN.ustProzent,
    version: e.konditionenVersion ?? 1,
  };
}

export type Gesehen = { v: 1; email: string; eintraege: Record<string, string> };

// ---------------------------------------------------------------------------
// Konstruktoren

export function neuerKunde(id: string, rolle: Rolle, art: Art, email: string, von: string): KundeRecord {
  return {
    v: 1,
    id,
    rolle,
    art,
    email: email.trim().toLowerCase(),
    angelegtAm: new Date().toISOString(),
    angelegtVon: von,
    dokumente: [],
    ereignisse: [],
    mails: [],
  };
}

export function neuerVorgang(key: string, art: Art): VorgangRecord {
  const [angebotId, gesuchId] = key.split("~");
  return {
    v: 1,
    key,
    angebotId,
    gesuchId,
    art,
    angelegtAm: new Date().toISOString(),
    externeVertraege: [],
    provisionen: [],
    meldungen: [],
    dokumente: [],
    ereignisse: [],
    mails: [],
  };
}

/** Fehlende Listen ergänzen (ältere Dateien). */
export function kundeNormal(k: KundeRecord): KundeRecord {
  k.dokumente ??= [];
  k.ereignisse ??= [];
  k.mails ??= [];
  return k;
}

export function vorgangNormal(v: VorgangRecord): VorgangRecord {
  v.externeVertraege ??= [];
  v.provisionen ??= [];
  v.meldungen ??= [];
  v.dokumente ??= [];
  v.ereignisse ??= [];
  v.mails ??= [];
  return v;
}

export function kurzId(prefix: string): string {
  const zufall = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${zufall}`;
}

const EREIGNIS_MAX = 300;

export function ereignis(ziel: { ereignisse: Ereignis[] }, von: string, art: string, text: string): Ereignis {
  const e: Ereignis = { id: kurzId("E"), am: new Date().toISOString(), von, art, text };
  ziel.ereignisse.unshift(e);
  ziel.ereignisse.length = Math.min(ziel.ereignisse.length, EREIGNIS_MAX);
  return e;
}

// ---------------------------------------------------------------------------
// Ableitungen: Stand des Onboardings

export type Stufe =
  | "neu"
  | "eingeladen"
  | "geoeffnet"
  | "angaben"
  | "unterschrieben"
  | "widerrufen"
  | "gekuendigt"
  | "gesperrt";

export const STUFE_INFO: Record<Stufe, { label: string; tipp: string }> = {
  neu: { label: "Nicht eingeladen", tipp: "Noch keine Einladung zum Kundenbereich erstellt." },
  eingeladen: { label: "Eingeladen", tipp: "Einladung erstellt — der Kunde hat den Link noch nicht geöffnet." },
  geoeffnet: { label: "Link geöffnet", tipp: "Der Kunde hat den Kundenbereich betreten, aber noch keine Angaben gemacht." },
  angaben: { label: "Angaben gemacht", tipp: "Stammdaten sind erfasst, die Unterschrift fehlt noch." },
  unterschrieben: { label: "Unterschrieben", tipp: "Vertrag online unterschrieben — Signaturprotokoll und PDF liegen in der Dokumentenablage." },
  widerrufen: { label: "Widerrufen", tipp: "Der Kunde hat den Vertrag widerrufen — keine Freigabe, keine Weitergabe von Daten." },
  gekuendigt: { label: "Gekündigt", tipp: "Der Kunde hat den Vertrag gekündigt — keine neuen Nachweise; bereits nachgewiesene Flächen bleiben provisionsgeschützt." },
  gesperrt: { label: "Zugang gesperrt", tipp: "Der Zugang zum Kundenbereich ist gesperrt." },
};

export function stufe(k: KundeRecord | null | undefined): Stufe {
  if (!k) return "neu";
  if (k.widerruf) return "widerrufen";
  if (k.kuendigung) return "gekuendigt";
  if (k.gesperrt) return "gesperrt";
  if (k.vertrag) return "unterschrieben";
  if (k.stammdaten) return "angaben";
  if (k.einladung?.angenommenAm) return "geoeffnet";
  if (k.einladung) return "eingeladen";
  return "neu";
}

/** 14 Tage Widerrufsfrist (§ 355 Abs. 2 BGB), Fristende am Ende des 14. Tages (deutsche Zeit). */
export function widerrufsfristEnde(vertragsschluss: string): string {
  const d = new Date(vertragsschluss);
  const tag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [y, m, t] = tag.split("-").map(Number);
  // Ende des 14. Tages nach dem Tag des Vertragsschlusses (§§ 187 Abs. 1, 188 Abs. 1 BGB),
  // 23:59:59 deutscher Zeit — mit der für diesen Tag gültigen Zeitzonen-Verschiebung.
  const mittag = new Date(Date.UTC(y, m - 1, t + 14, 12, 0, 0));
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "shortOffset" })
    .formatToParts(mittag)
    .find((x) => x.type === "timeZoneName")?.value;
  const treffer = zone?.match(/GMT([+-]\d+)(?::(\d+))?/);
  const versatzMin = treffer ? Number(treffer[1]) * 60 + (treffer[2] ? Math.sign(Number(treffer[1])) * Number(treffer[2]) : 0) : 60;
  const ende = new Date(Date.UTC(y, m - 1, t + 14, 23, 59, 59) - versatzMin * 60_000);
  return ende.toISOString();
}

/** Sicherheitspuffer nach Fristende für Widerrufe per Post (rechtzeitige Absendung genügt). */
export const WIDERRUF_PUFFER_TAGE = 4;

/** Darf eine Bitte um eine Bewertung per E-Mail gehen? Nur mit Einwilligung (§ 7 Abs. 2 Nr. 2 UWG) und ohne Widerspruch. */
export function bewertungsmailErlaubt(k: KundeRecord | null | undefined): boolean {
  if (!k?.vertrag || k.widerruf || k.gesperrt || k.bewertungsWiderspruch) return false;
  return k.vertrag.signatur.erklaerungen.some((e) => e.id === "bewertung");
}

/** Widerrufsrecht nach §§ 312g, 355 BGB: nur Suchende (zahlungspflichtig), die als Verbraucher handeln. */
export function hatWiderrufsrecht(k: KundeRecord): boolean {
  return k.rolle === "suchender" && k.vertrag?.eigenschaft === "verbraucher";
}

export function widerrufMoeglich(k: KundeRecord, jetzt = new Date()): boolean {
  if (!k.vertrag || !hatWiderrufsrecht(k) || k.widerruf) return false;
  const ende = k.vertrag.widerrufsfristEnde;
  return Boolean(ende && jetzt.getTime() <= new Date(ende).getTime());
}

/**
 * Darf dieser Kunde für eine Freigabe (Weitergabe der Kontaktdaten) verwendet werden?
 * Voraussetzungen: gültiger, unterschriebener Vertrag, kein Widerruf/keine Kündigung/
 * keine Sperre; bei Suchenden, die Verbraucher sind, zusätzlich Vertragsbestätigung
 * versandt (§ 312f BGB) und Widerrufsfrist abgelaufen oder ausdrücklicher
 * Beginnwunsch (§ 356 Abs. 4 BGB).
 */
export function freigabeBereit(k: KundeRecord | null | undefined, jetzt = new Date()): { bereit: boolean; grund: string } {
  if (!k) return { bereit: false, grund: "noch nicht eingeladen" };
  const s = stufe(k);
  if (s !== "unterschrieben") return { bereit: false, grund: STUFE_INFO[s].label.toLowerCase() };
  const v = k.vertrag!;
  if (hatWiderrufsrecht(k)) {
    if (!v.bestaetigungGesendetAm) return { bereit: false, grund: "Vertragsbestätigung (PDF per E-Mail) noch nicht versandt" };
    if (!v.beginnwunschAm) {
      const ende = v.widerrufsfristEnde ? new Date(v.widerrufsfristEnde).getTime() : 0;
      const ab = ende + WIDERRUF_PUFFER_TAGE * 86_400_000;
      if (jetzt.getTime() < ab) {
        return { bereit: false, grund: `Widerrufsfrist läuft (Freigabe ab ${new Date(ab).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} oder nach ausdrücklichem Beginnwunsch)` };
      }
    }
  }
  return { bereit: true, grund: "bereit" };
}

export function aktiveFreigabe(v: VorgangRecord | null | undefined): boolean {
  return Boolean(v?.freigabe && !v.freigabe.zurueckgezogen);
}

// ---------------------------------------------------------------------------
// Zahlen und Beträge

export const UST_PROZENT = 19;

export function runde2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function euro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function zahlDe(n: number | null | undefined, stellen = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE", { maximumFractionDigits: stellen });
}

export function summeHa(flaechen: Flaeche[]): number | null {
  const werte = flaechen.map((f) => f.groesseHa).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return werte.length ? runde2(werte.reduce((a, b) => a + b, 0)) : null;
}

/** Pachtzins für ein volles Pachtjahr (netto): fester Betrag oder €/ha × Fläche. */
export function jahrespacht(d: PachtDaten): number | null {
  if (d.pachtzinsJahr != null && d.pachtzinsJahr > 0) return runde2(d.pachtzinsJahr);
  const ha = summeHa(d.flaechen);
  if (d.pachtzinsJeHa != null && ha != null) return runde2(d.pachtzinsJeHa * ha);
  return null;
}

/** Pachtjahre, über die eine Staffel gemittelt wird (siehe Nachweisvertrag Pacht, § 4). */
export const STAFFEL_JAHRE = 5;

/**
 * Maßgebliche Jahrespacht für die Provision: die für ein volles Pachtjahr
 * vereinbarte Pacht. Bei Staffelpacht der Durchschnitt der ersten fünf
 * Pachtjahre (bei kürzerer fester Laufzeit: der gesamten Laufzeit) — so zählen
 * weder ein pachtfreies Anlaufjahr noch eine späte Spitzenstufe allein.
 */
export function massgeblicheJahrespacht(d: PachtDaten): number | null {
  const basis = jahrespacht(d);
  if (basis == null) return null;
  const staffel = (d.staffel ?? []).filter((s) => s.pachtjahr >= 1 && Number.isFinite(s.betrag) && s.betrag >= 0);
  if (staffel.length === 0) return basis;
  const jahre = Math.max(1, Math.min(STAFFEL_JAHRE, d.laufzeitJahre && d.laufzeitJahre > 0 ? Math.floor(d.laufzeitJahre) : STAFFEL_JAHRE));
  let summe = 0;
  for (let j = 1; j <= jahre; j++) summe += staffel.find((s) => s.pachtjahr === j)?.betrag ?? basis;
  return runde2(summe / jahre);
}

export type ProvisionsBetrag = { netto: number | null; brutto: number | null; bemessung: number | null };

/** Provision nach den im Vertrag festgehaltenen Konditionen. */
export function provisionBerechnen(art: Art, bemessung: number | null, k: Konditionen): ProvisionsBetrag {
  if (bemessung == null || !Number.isFinite(bemessung)) return { netto: null, brutto: null, bemessung: null };
  const betrag = art === "pacht" ? bemessung * k.pachtJahrespachten : (bemessung * k.kaufProzent) / 100;
  const faktor = 1 + k.ustProzent / 100;
  const modus = art === "pacht" ? k.ust.pacht : k.ust.kauf;
  return modus === "zuzueglich"
    ? { netto: runde2(betrag), brutto: runde2(betrag * faktor), bemessung }
    : { netto: runde2(betrag / faktor), brutto: runde2(betrag), bemessung };
}

/** Kurzbeschreibung der Konditionen für Texte (z. B. „1 Jahrespacht zzgl. 19 % USt“). */
export function konditionenText(art: Art, k: Konditionen): string {
  const modus = art === "pacht" ? k.ust.pacht : k.ust.kauf;
  const ust = modus === "zuzueglich" ? `zzgl. ${zahlDe(k.ustProzent)} % Umsatzsteuer` : `inkl. ${zahlDe(k.ustProzent)} % Umsatzsteuer`;
  if (art === "pacht") {
    const n = k.pachtJahrespachten;
    const menge = n === 1 ? "eine volle Jahrespacht" : `das ${zahlDe(n)}-Fache einer vollen Jahrespacht`;
    return `${menge} (netto) ${ust}`;
  }
  return `${zahlDe(k.kaufProzent, 4)} % des Kaufpreises ${ust}`;
}

/** Gesamtpreisangabe für Verbraucher (PAngV): Bruttosatz. */
export function bruttoText(art: Art, k: Konditionen): string {
  const modus = art === "pacht" ? k.ust.pacht : k.ust.kauf;
  const faktor = modus === "zuzueglich" ? 1 + k.ustProzent / 100 : 1;
  const ust = `einschließlich ${zahlDe(k.ustProzent)} % Umsatzsteuer`;
  if (art === "pacht") {
    const prozent = runde2(k.pachtJahrespachten * faktor * 100);
    return `${zahlDe(prozent)} % einer vollen Jahrespacht (Gesamtbetrag ${ust})`;
  }
  const prozent = Math.round(k.kaufProzent * faktor * 10000) / 10000;
  return `${zahlDe(prozent, 4)} % des Kaufpreises (Gesamtbetrag ${ust})`;
}
