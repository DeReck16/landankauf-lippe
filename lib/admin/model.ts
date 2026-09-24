// Datenmodell der Verwaltung: Anfragen (unveränderlich, wie vom Formular
// geschrieben) plus Verwaltungszustand (Status, Notizen, Matching-Angaben),
// der als eine JSON-Datei im privaten Speicher liegt.

import { isGesuchIntent } from "@/lib/lead-options";

export type LeadRecord = {
  id: string;
  receivedAt: string;
  intent: string;
  flaechentyp: string;
  groesse: string;
  ort: string;
  flurstueck: string;
  message: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  consent: string;
  gclid: string;
};

export const LEAD_STATUS = {
  neu: { label: "Neu", tipp: "Noch nicht bearbeitet." },
  in_arbeit: { label: "In Arbeit", tipp: "Wird gerade geprüft oder bewertet." },
  beantwortet: { label: "Beantwortet", tipp: "Antwort ist raus, Rückmeldung steht aus." },
  erledigt: { label: "Erledigt", tipp: "Abgeschlossen — erscheint nicht mehr im Matching." },
  archiv: { label: "Archiv", tipp: "Test, Spam oder Dublette — ausgeblendet und nicht im Matching." },
} as const;
export type LeadStatus = keyof typeof LEAD_STATUS;

export type Rolle = "angebot" | "gesuch" | "keine";
export type Art = "kauf" | "pacht";

export type LeadMeta = {
  status?: LeadStatus;
  rolle?: Rolle;
  art?: Art | null;
  flaechentyp?: string;
  groesseMinHa?: number | null;
  groesseMaxHa?: number | null;
  ortMatching?: string;
  radiusKm?: number | null;
  notiz?: string;
  geaendert?: { am: string; von: string };
};

export const MATCH_STATUS = {
  vorschlag: { label: "Vorschlag", tipp: "Automatisch gefunden, noch nicht angesehen." },
  vorgemerkt: { label: "Vorgemerkt", tipp: "Passt — soll beiden Seiten anonym angeboten werden." },
  angefragt: { label: "Angefragt", tipp: "Beide Seiten haben den anonymen Hinweis bekommen, Zustimmung und Onboarding stehen aus." },
  kontakt: { label: "Kontakt freigegeben", tipp: "Beide haben unterschrieben und zugestimmt — die Kontaktdaten sind im Kundenbereich freigegeben." },
  abschluss: { label: "Vertrag geschlossen", tipp: "Pacht- oder Kaufvertrag ist geschlossen — die Provision ist erfasst." },
  verworfen: { label: "Verworfen", tipp: "Passt nicht — wird nicht mehr vorgeschlagen." },
} as const;
export type MatchStatus = keyof typeof MATCH_STATUS;

export type MatchMeta = {
  status: MatchStatus;
  /** Zustimmung zum konkreten Kontakt — im Kundenbereich oder von der Verwaltung erfasst. */
  zustimmungAnbieter?: string | null;
  zustimmungSuchender?: string | null;
  /** Wer die Zustimmung erfasst hat („kunde“ = selbst im Kundenbereich, sonst Admin-Adresse). */
  zustimmungQuelle?: { anbieter?: string; suchender?: string };
  /** Eine Seite hat im Kundenbereich „kein Interesse“ gemeldet. */
  ablehnung?: { rolle: "anbieter" | "suchender"; am: string; grund?: string };
  notiz?: string;
  geaendert?: { am: string; von: string };
};

export type GeoTreffer = {
  lat: number;
  lon: number;
  name: string;
  gemeinde?: string;
  ausdehnungKm: number;
  am: string;
};
export type GeoEintrag = GeoTreffer | { fehlt: true; am: string };

export type ProtokollEintrag = { am: string; von: string; was: string; ref?: string };

export type Zustand = {
  v: 1;
  anfragen: Record<string, LeadMeta>;
  paare: Record<string, MatchMeta>;
  orte: Record<string, GeoEintrag>;
  protokoll: ProtokollEintrag[];
};

export function leererZustand(): Zustand {
  return { v: 1, anfragen: {}, paare: {}, orte: {}, protokoll: [] };
}

export function paarKey(angebotId: string, gesuchId: string): string {
  return `${angebotId}~${gesuchId}`;
}

// ---------------------------------------------------------------------------
// Ableitungen aus dem Formular

export function ableitenAusAnliegen(intent: string): { rolle: Rolle; art: Art | null } {
  if (intent === "Verkaufen") return { rolle: "angebot", art: "kauf" };
  if (intent === "Verpachten") return { rolle: "angebot", art: "pacht" };
  if (isGesuchIntent(intent)) return { rolle: "gesuch", art: intent.includes("Kauf") ? "kauf" : "pacht" };
  return { rolle: "keine", art: null };
}

/** Zahl im deutschen Format lesen („10.114“ = 10114, „1,5“ = 1,5). */
function zahl(raw: string, einheit: string | undefined): { wert: number; unsicher: boolean } | null {
  const s = raw.trim();
  if (!s) return null;
  const einheitQm = Boolean(einheit && /^(m²|m2|qm|quadratmeter)$/i.test(einheit));
  let unsicher = false;
  let norm: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    norm = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{3}$/.test(s) && (einheitQm || (!einheit && Number(s.replace(",", ".")) >= 50))) {
    // „272,917“ — Komma statt Tausenderpunkt: 272.917 m² (27 ha) ist plausibler
    // als 272 m² oder 272,9 ha.
    norm = s.replace(",", "");
    unsicher = true;
  } else {
    norm = s.replace(",", ".");
  }
  const wert = Number(norm);
  return Number.isFinite(wert) ? { wert, unsicher } : null;
}

const EINHEIT = /(?<![a-zäöüß])(hektare?|ha|m²|m2|qm|quadratmeter|ar|a|morgen)(?![a-zäöüß0-9])/i;

function inHektar(wert: number, einheit: string | undefined): { ha: number; unsicher: boolean } {
  const e = (einheit || "").toLowerCase();
  if (e.startsWith("h")) return { ha: wert, unsicher: false };
  if (e.startsWith("m") && e !== "morgen") return { ha: wert / 10000, unsicher: false };
  if (e === "qm" || e.startsWith("quadrat")) return { ha: wert / 10000, unsicher: false };
  if (e === "ar" || e === "a") return { ha: wert / 100, unsicher: false };
  if (e === "morgen") return { ha: wert * 0.25, unsicher: true };
  // Ohne Einheit: große Zahlen sind fast immer m², kleine Hektar.
  return wert >= 500 ? { ha: wert / 10000, unsicher: true } : { ha: wert, unsicher: true };
}

export type Groesse = { minHa: number | null; maxHa: number | null; unsicher: boolean };

/** Freitext-Größe in Hektar: „5 ha“, „10.114 m²“, „5–10 ha“, „ab 3 ha“, „bis 2 ha“. */
export function parseGroesse(text: string | undefined | null): Groesse {
  const leer: Groesse = { minHa: null, maxHa: null, unsicher: false };
  if (!text || text === "—") return leer;
  const t = text
    .toLowerCase()
    .replace(/\b(ca|circa|etwa|rund|ungefähr|ungefaehr|knapp|gut)\b\.?/g, " ")
    .replace(/~/g, " ")
    .trim();
  const einheitMatch = t.match(EINHEIT);
  const einheit = einheitMatch?.[1];
  const zahlen = [...t.matchAll(/\d[\d.,]*/g)].map((m) => m[0].replace(/[.,]$/, ""));
  if (zahlen.length === 0) return leer;

  const umrechnen = (raw: string) => {
    const z = zahl(raw, einheit);
    if (!z) return null;
    const h = inHektar(z.wert, einheit);
    return { ha: Math.round(h.ha * 100) / 100, unsicher: z.unsicher || h.unsicher };
  };

  const istSpanne = zahlen.length >= 2 && /(\d)\s*(-|–|bis)\s*\d|zwischen/.test(t);
  if (istSpanne) {
    const a = umrechnen(zahlen[0]);
    const b = umrechnen(zahlen[1]);
    if (a && b) {
      return { minHa: Math.min(a.ha, b.ha), maxHa: Math.max(a.ha, b.ha), unsicher: a.unsicher || b.unsicher };
    }
  }
  const eins = umrechnen(zahlen[0]);
  if (!eins) return leer;
  if (/\b(ab|mind|mindestens|mehr als|über|ueber)\b|>/.test(t)) return { minHa: eins.ha, maxHa: null, unsicher: eins.unsicher };
  if (/\b(bis|max|maximal|höchstens|hoechstens|unter)\b|</.test(t)) return { minHa: null, maxHa: eins.ha, unsicher: eins.unsicher };
  return { minHa: eins.ha, maxHa: eins.ha, unsicher: eins.unsicher };
}

export function formatHa(ha: number | null | undefined): string {
  if (ha == null) return "?";
  if (ha < 1) return `${Math.round(ha * 10000).toLocaleString("de-DE")} m²`;
  return `${ha.toLocaleString("de-DE", { maximumFractionDigits: ha < 10 ? 2 : 1 })} ha`;
}

export function formatGroesse(g: { minHa: number | null; maxHa: number | null }): string {
  const { minHa, maxHa } = g;
  if (minHa == null && maxHa == null) return "Größe offen";
  if (minHa != null && maxHa != null) return minHa === maxHa ? formatHa(minHa) : `${formatHa(minHa)} – ${formatHa(maxHa)}`;
  if (minHa != null) return `ab ${formatHa(minHa)}`;
  return `bis ${formatHa(maxHa)}`;
}

// ---------------------------------------------------------------------------
// Sicht auf eine Anfrage: Formulardaten + Übersteuerungen aus der Verwaltung

export type LeadView = LeadRecord & {
  meta: LeadMeta;
  status: LeadStatus;
  rolle: Rolle;
  art: Art | null;
  typ: string;
  groesseWert: Groesse;
  ortText: string;
  radiusKm: number;
  ausAds: boolean;
};

export const STANDARD_RADIUS_KM = 20;

export function leadView(lead: LeadRecord, meta: LeadMeta | undefined): LeadView {
  const m = meta ?? {};
  const abgeleitet = ableitenAusAnliegen(lead.intent);
  const geparst = parseGroesse(lead.groesse);
  const groesseWert: Groesse =
    m.groesseMinHa !== undefined || m.groesseMaxHa !== undefined
      ? { minHa: m.groesseMinHa ?? null, maxHa: m.groesseMaxHa ?? null, unsicher: false }
      : geparst;
  return {
    ...lead,
    meta: m,
    status: m.status ?? "neu",
    rolle: m.rolle ?? abgeleitet.rolle,
    art: m.art !== undefined ? m.art : abgeleitet.art,
    typ: m.flaechentyp || (lead.flaechentyp !== "—" ? lead.flaechentyp : "Sonstiges"),
    groesseWert,
    ortText: (m.ortMatching || (lead.ort !== "—" ? lead.ort : "")).trim(),
    radiusKm: m.radiusKm ?? STANDARD_RADIUS_KM,
    ausAds: Boolean(lead.gclid && lead.gclid !== "—"),
  };
}

export function normalizeLead(raw: Record<string, unknown>, fallbackId: string): LeadRecord {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "—");
  return {
    id: typeof raw.id === "string" ? raw.id : fallbackId,
    receivedAt: typeof raw.receivedAt === "string" ? raw.receivedAt : new Date(0).toISOString(),
    intent: s(raw.intent),
    flaechentyp: s(raw.flaechentyp),
    groesse: s(raw.groesse),
    ort: s(raw.ort),
    flurstueck: s(raw.flurstueck),
    message: s(raw.message),
    name: s(raw.name),
    phone: s(raw.phone),
    email: s(raw.email),
    source: s(raw.source),
    consent: s(raw.consent),
    gclid: s(raw.gclid),
  };
}
