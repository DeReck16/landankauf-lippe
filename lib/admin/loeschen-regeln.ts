// Regeln für „Vorgang endgültig löschen (DSGVO)“ (Dennis 27.09.2026: „ja“) — ohne Speicherzugriff,
// damit sie sich einzeln prüfen lassen. Ausgeführt wird in lib/admin/loeschen.ts.
//
// Grundsatz: Alles zu einer Anfrage wird gelöscht — außer, was eine Aufbewahrungspflicht hat
// (Art. 17 Abs. 3 lit. b DSGVO): unterschriebene Verträge samt Unterschriftsprotokoll und zugehöriger
// Korrespondenz, Nachweis und Provision. Das wird nur gesperrt (Art. 18 DSGVO) — „gesperrt bis“ mit
// Grund — und liegt getrennt von allem, was der Alltag liest (Sperrakte bzw. Vorgang mit Sperrvermerk).
// Fristen wie in der Datenschutzerklärung (app/datenschutz): 6 Jahre, als Buchungsgrundlage 8 Jahre,
// jeweils ab Ende des Kalenderjahres.

import { INTENTS } from "@/lib/lead-options";
import { PROVISION_STATUS } from "@/lib/portal/model";
import type * as M from "@/lib/portal/model";
import { ableitenAusAnliegen, LEAD_STATUS, type GesperrtPosten, type LeadMeta, type LeadRecord } from "./model";

/** Ersatz für geschwärzte Personendaten in Verläufen und Protokollen. */
export const SCHWARZ = "[gelöscht]";

/**
 * Aufbewahrungspflichten nach Handels- und Steuerrecht. Seit dem 1.1.2025 gelten für Buchungsbelege acht
 * statt zehn Jahre (Viertes Bürokratieentlastungsgesetz) — Jahresabschlüsse und Bücher führt Lippe Forst nicht.
 */
export const AUFBEWAHRUNG = {
  geschaeftsbrief: { jahre: 6, norm: "§ 257 Abs. 1 Nr. 2, 3, Abs. 4 HGB, § 147 Abs. 1 Nr. 2, 3, Abs. 3 AO" },
  buchungsbeleg: { jahre: 8, norm: "§ 257 Abs. 1 Nr. 4, Abs. 4 HGB, § 147 Abs. 1 Nr. 4, Abs. 3 AO" },
} as const;

export type Aufbewahrung = keyof typeof AUFBEWAHRUNG;

/** Mails der Kundenakte, die zum Vertrag gehören (Geschäftsbriefe) — bleiben mit dem Vertrag gesperrt. */
export const KUNDE_KORRESPONDENZ: readonly string[] = ["vertragsbestaetigung", "widerruf-bestaetigung", "kuendigung-bestaetigung"];
/** Mails eines Vorgangs, die zu Nachweis, Vertrag oder Abschluss gehören. */
export const VORGANG_KORRESPONDENZ: readonly string[] = ["freigabe", "pachtvertrag", "kaufabsicht", "anzeige", "abschluss"];
/** Dokumente der Kundenakte, die zum Vertrag gehören (PDF mit Unterschriftsprotokoll, Bestätigungen). */
export const VERTRAGS_DOKUMENTE: readonly M.DokumentArt[] = ["maklervertrag", "anbietervereinbarung", "bestaetigung"];

/** Letzter Tag der Aufbewahrung: Die Frist beginnt mit dem Schluss des Kalenderjahres (§ 257 Abs. 5 HGB, § 147 Abs. 4 AO). */
export function aufbewahrenBis(iso: string, art: Aufbewahrung): string {
  const jahr = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }).format(new Date(iso)));
  return `${jahr + AUFBEWAHRUNG[art].jahre}-12-31`;
}

function spaetestes(daten: (string | null | undefined)[]): string | null {
  const gueltig = daten.filter((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return gueltig.length ? gueltig.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
}

function datumDe(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function grundText(art: Aufbewahrung, was: string): string {
  const a = AUFBEWAHRUNG[art];
  return `${was}: Aufbewahrungspflicht ${a.jahre} Jahre ab Jahresende (${a.norm}) — bis dahin nur gesperrt (Art. 17 Abs. 3 lit. b, Art. 18 DSGVO).`;
}

// ---------------------------------------------------------------------------
// Personendaten erkennen und schwärzen (Verläufe, Protokolle, Postausgang)

export type Kennungen = { texte: string[]; telefone: string[] };

/** Allgemeine Wörter, die nie als Kennung taugen (würden sonst überall geschwärzt). */
const ALLGEMEIN = new Set(["privat", "keine", "keiner", "landwirt", "landwirtschaft", "gbr", "kg", "gmbh", "hof", "betrieb", "unbekannt"]);

function brauchbar(s: string | null | undefined, min = 3): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t && t !== "—" && t.length >= min && !ALLGEMEIN.has(t.toLowerCase()) ? t : null;
}

/** Namen, Adressen und Kontaktdaten der Person aus Anfrage und Kundenakte (für das Schwärzen). */
export function kennungenSammeln(q: { lead?: LeadRecord | null; kunde?: M.KundeRecord | null; weitere?: (string | null | undefined)[] }): Kennungen {
  const texte = new Set<string>();
  const telefone = new Set<string>();
  const dazu = (s: string | null | undefined, min = 3) => {
    const t = brauchbar(s, min);
    if (t) texte.add(t);
  };
  const l = q.lead;
  if (l) {
    dazu(l.name);
    dazu(l.email);
    if (brauchbar(l.phone)) telefone.add(l.phone);
  }
  const k = q.kunde;
  if (k) {
    dazu(k.email);
    dazu(k.name);
    dazu(k.stammdaten?.name);
    // Betriebsname und Straße erst ab 6 Zeichen — kürzere wären zu oft ein allgemeines Wort.
    dazu(k.stammdaten?.betrieb, 6);
    dazu(k.stammdaten?.strasse, 6);
    if (brauchbar(k.stammdaten?.telefon)) telefone.add(k.stammdaten!.telefon);
    for (const v of [k.vertrag, ...(k.fruehereVertraege ?? []).map((f) => f.vertrag)]) {
      dazu(v?.signatur.name);
      dazu(v?.signatur.email);
    }
  }
  for (const w of q.weitere ?? []) dazu(w, 6);
  // Längere zuerst, damit „Max Mustermann“ vor „Max“ greift.
  return { texte: [...texte].sort((a, b) => b.length - a.length), telefone: [...telefone] };
}

export function kennungenVereinen(a: Kennungen, b: Kennungen): Kennungen {
  return {
    texte: [...new Set([...a.texte, ...b.texte])].sort((x, y) => y.length - x.length),
    telefone: [...new Set([...a.telefone, ...b.telefone])],
  };
}

function regexText(s: string): RegExp {
  const muster = s
    .split(" ")
    .map((teil) => teil.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  // Nicht mitten in einem Wort („Ali“ nicht in „Qualität“).
  return new RegExp(`(?<![\\p{L}\\p{N}])${muster}(?![\\p{L}\\p{N}])`, "giu");
}

/** Telefonnummer in allen üblichen Schreibweisen (0170 123…, +49 170 123…, +49 (0)170 …). */
function regexTelefon(tel: string): RegExp | null {
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("0049")) d = d.slice(4);
  else if (/^\s*\+/.test(tel) && d.startsWith("49")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.length < 6) return null;
  const trenner = "[\\s\\-/().]*";
  const rest = d.split("").join(trenner);
  return new RegExp(`(?<!\\d)(?:(?:\\+|00)49${trenner}(?:\\(0\\)${trenner})?|0)${trenner}${rest}(?!\\d)`, "g");
}

/** Personendaten in einem Text durch „[gelöscht]“ ersetzen. */
export function schwaerzen(text: string, k: Kennungen): string {
  let t = text;
  for (const tel of k.telefone) {
    const r = regexTelefon(tel);
    if (r) t = t.replace(r, SCHWARZ);
  }
  for (const s of k.texte) t = t.replace(regexText(s), SCHWARZ);
  return t;
}

export function enthaeltKennung(text: string, k: Kennungen): boolean {
  return schwaerzen(text, k) !== text;
}

// ---------------------------------------------------------------------------
// Einstufung: löschen, nur sperren oder (noch) nicht möglich

export type Einstufung =
  | { wie: "loeschen" }
  | { wie: "sperren"; bis: string; grund: string; was: string; aufbewahrung: Aufbewahrung }
  | { wie: "blockiert"; gruende: string[] };

const KAUF_LAUFEND: M.KaufStand["status"][] = ["zur_bestaetigung", "bestaetigt", "beurkundet"];
const PROVISION_OFFEN: M.ProvisionStatus[] = ["aufschiebend", "faellig", "abgerechnet"];

/**
 * Vorgang (Paar) einer zu löschenden Anfrage:
 * - blockiert, solange er abgewickelt wird (Vertrag in Unterschrift, Kauf läuft, Provision offen,
 *   Kontakt freigegeben ohne Abschluss und nicht beendet) — die Daten werden dafür noch gebraucht
 *   (Art. 17 Abs. 1 lit. a DSGVO); erst abschließen bzw. „Vorgang beenden (ohne Abschluss)“.
 * - gesperrt, wenn Nachweis, Vertrag oder Provision dokumentiert sind (Geschäftsbriefe; mit gebuchter
 *   Provision Buchungsgrundlage),
 * - sonst gelöscht (reine Vorschläge, anonyme Hinweise, Zustimmungen ohne Freigabe).
 */
export function vorgangEinstufen(v: M.VorgangRecord | null): Einstufung {
  if (!v) return { wie: "loeschen" };
  const gruende: string[] = [];
  if (v.pachtvertrag?.status === "zur_unterschrift") gruende.push("Der Landpachtvertrag liegt zur Unterschrift vor — erst abschließen oder verwerfen.");
  if (v.kauf && KAUF_LAUFEND.includes(v.kauf.status)) gruende.push("Der Kauf wird gerade abgewickelt — erst wirksam oder abgebrochen vermerken.");
  const offen = v.provisionen.filter((p) => PROVISION_OFFEN.includes(p.status));
  if (offen.length) gruende.push(`Provision noch offen (${[...new Set(offen.map((p) => PROVISION_STATUS[p.status].label))].join(", ")}) — erst bezahlt oder storniert vermerken.`);
  if (v.freigabe && !v.freigabe.zurueckgezogen && !v.abschluss && !v.beendet) {
    gruende.push("Der Kontakt ist freigegeben und der Vorgang weder abgeschlossen noch beendet — erst „Vorgang beenden (ohne Abschluss)“.");
  }
  if (gruende.length) return { wie: "blockiert", gruende };

  const pvUnterschrift = Boolean(v.pachtvertrag && (v.pachtvertrag.unterschriften.verpaechter || v.pachtvertrag.unterschriften.paechter));
  const kaufBestaetigt = Boolean(v.kauf && (v.kauf.bestaetigungen.verkaeufer || v.kauf.bestaetigungen.kaeufer));
  const dokumentiert = Boolean(v.freigabe || v.abschluss || v.provisionen.length || v.externeVertraege.length || pvUnterschrift || kaufBestaetigt);
  if (!dokumentiert) return { wie: "loeschen" };

  const gebucht = v.provisionen.filter((p) => p.status === "bezahlt" || p.rechnung);
  if (gebucht.length) {
    const ab = spaetestes(gebucht.flatMap((p) => [p.entstandenAm, p.rechnung?.datum, ...p.verlauf.map((x) => x.am)])) ?? v.angelegtAm;
    return {
      wie: "sperren",
      aufbewahrung: "buchungsbeleg",
      bis: aufbewahrenBis(ab, "buchungsbeleg"),
      was: `Vorgang mit abgerechneter Provision (${[v.abschluss ? `Abschluss ${datumDe(v.abschluss.am)}` : "", `${gebucht.length} Provision${gebucht.length === 1 ? "" : "en"}`].filter(Boolean).join(", ")})`,
      grund: grundText("buchungsbeleg", "Grundlage einer Provisionsrechnung"),
    };
  }
  const ab =
    spaetestes([
      v.abschluss?.am,
      v.freigabe?.am,
      v.freigabe?.zurueckgezogen?.am,
      v.beendet?.am,
      v.pachtvertrag?.abgeschlossenAm,
      v.pachtvertrag?.unterschriften.verpaechter?.am,
      v.pachtvertrag?.unterschriften.paechter?.am,
      v.kauf?.notar.beurkundetAm,
      v.kauf?.notar.wirksamAm,
      v.kauf?.bestaetigungen.verkaeufer?.am,
      v.kauf?.bestaetigungen.kaeufer?.am,
      ...v.externeVertraege.map((e) => e.erfasstAm),
      ...v.provisionen.flatMap((p) => [p.entstandenAm, ...p.verlauf.map((x) => x.am)]),
    ]) ?? v.angelegtAm;
  const teile = [
    v.abschluss ? `Vertrag geschlossen am ${datumDe(v.abschluss.am)}` : "",
    v.freigabe ? `Nachweis (Kontaktfreigabe) am ${datumDe(v.freigabe.am)}` : "",
    pvUnterschrift && !v.abschluss ? "Pachtvertrag unterschrieben" : "",
    kaufBestaetigt && !v.abschluss ? "Kauf bestätigt" : "",
  ].filter(Boolean);
  return {
    wie: "sperren",
    aufbewahrung: "geschaeftsbrief",
    bis: aufbewahrenBis(ab, "geschaeftsbrief"),
    was: `Vorgang (${teile.join(", ") || "dokumentiert"})`,
    grund: grundText("geschaeftsbrief", "Nachweis und Vertrag als Geschäftsbriefe"),
  };
}

/**
 * Kundenakte: ohne unterschriebenen Vertrag ganz löschen; mit Vertrag (auch früherem) Vertrag,
 * Unterschriftsprotokoll, Vertrags-PDFs und Vertragskorrespondenz sperren, alles andere löschen.
 * `provisionGebuchtAm`: letzte gebuchte Provision, für die dieser Vertrag die Grundlage ist (8 Jahre).
 */
export function kundeEinstufen(k: M.KundeRecord | null, provisionGebuchtAm: string | null = null): Einstufung {
  if (!k) return { wie: "loeschen" };
  const vertraege = [k.vertrag, ...(k.fruehereVertraege ?? []).map((f) => f.vertrag)].filter((v): v is M.KundenVertrag => Boolean(v));
  if (vertraege.length === 0) return { wie: "loeschen" };
  const titel = vertraege.map((v) => `${v.titel} (unterschrieben ${datumDe(v.signatur.am)})`).join(", ");
  if (provisionGebuchtAm) {
    return {
      wie: "sperren",
      aufbewahrung: "buchungsbeleg",
      bis: aufbewahrenBis(provisionGebuchtAm, "buchungsbeleg"),
      was: `Vertrag: ${titel}`,
      grund: grundText("buchungsbeleg", "Provisionsvereinbarung als Grundlage einer Provisionsrechnung"),
    };
  }
  const ab =
    spaetestes([
      ...vertraege.map((v) => v.signatur.am),
      ...vertraege.map((v) => v.ergaenzt?.am),
      k.widerruf?.am,
      k.kuendigung?.am,
      ...(k.fruehereVertraege ?? []).flatMap((f) => [f.kuendigung?.am, f.widerruf?.am, f.abgelegtAm]),
      ...k.mails.filter((m) => KUNDE_KORRESPONDENZ.includes(m.zweck)).map((m) => m.am),
    ]) ?? k.angelegtAm;
  return {
    wie: "sperren",
    aufbewahrung: "geschaeftsbrief",
    bis: aufbewahrenBis(ab, "geschaeftsbrief"),
    was: `Vertrag: ${titel}`,
    grund: grundText("geschaeftsbrief", "Unterschriebener Vertrag mit Unterschriftsprotokoll und Vertragskorrespondenz"),
  };
}

/** Was von einer Kundenakte gesperrt bleibt: Vertragsdaten, Vertrags-PDFs, Vertragskorrespondenz — sonst nichts. */
export function kundeFuerSperre(k: M.KundeRecord): M.KundeRecord {
  return {
    v: 1,
    id: k.id,
    rolle: k.rolle,
    art: k.art,
    email: k.email,
    angelegtAm: k.angelegtAm,
    angelegtVon: k.angelegtVon,
    ...(k.stammdaten ? { stammdaten: k.stammdaten } : {}),
    ...(k.flaechen?.length ? { flaechen: k.flaechen } : {}),
    ...(k.vertrag ? { vertrag: k.vertrag } : {}),
    ...(k.widerruf ? { widerruf: k.widerruf } : {}),
    ...(k.kuendigung ? { kuendigung: k.kuendigung } : {}),
    ...(k.fruehereVertraege?.length ? { fruehereVertraege: k.fruehereVertraege } : {}),
    dokumente: k.dokumente.filter((d) => VERTRAGS_DOKUMENTE.includes(d.art)),
    ereignisse: [],
    mails: k.mails.filter((m) => KUNDE_KORRESPONDENZ.includes(m.zweck)),
  };
}

// ---------------------------------------------------------------------------
// Grabstein: was nach dem Löschen übrig bleibt (ohne Personendaten)

/** Art der Anfrage nur aus festen Begriffen (nie Freitext). */
export function artDerAnfrage(lead: Pick<LeadRecord, "intent"> | null, meta: LeadMeta | undefined): string {
  const intent = lead && (INTENTS as readonly string[]).includes(lead.intent) ? lead.intent : "";
  const abgeleitet = ableitenAusAnliegen(intent);
  const rolle = meta?.rolle ?? abgeleitet.rolle;
  const art = meta?.art !== undefined ? meta.art : abgeleitet.art;
  if (rolle === "angebot" || rolle === "gesuch") {
    return `${rolle === "angebot" ? "Angebot" : "Gesuch"}${art ? ` · ${art === "kauf" ? "Kauf" : "Pacht"}` : ""}${intent ? ` (${intent})` : ""}`;
  }
  return intent ? `Auskunft (${intent})` : "Anfrage";
}

export function statusDerAnfrage(meta: LeadMeta | undefined, stufe: string | null): string {
  const s = LEAD_STATUS[meta?.status ?? "neu"]?.label ?? "Neu";
  return stufe ? `${s} · Kundenbereich: ${stufe}` : s;
}

/** Sperrakte einer gelöschten Anfrage (portal/gesperrt/<LL-ID>.json): nur Aufbewahrung, keine Verarbeitung. */
export type Sperrakte = {
  v: 1;
  id: string;
  seit: string;
  von: string;
  /** Spätestes „gesperrt bis“ aller Posten. */
  bis: string;
  posten: GesperrtPosten[];
  kunde?: M.KundeRecord;
  /** Direktankauf, den die TR Vertriebs GmbH vollzogen hat — Angebot und Ergebnis als Geschäftsbrief. */
  ankauf?: {
    anfrage: Pick<LeadRecord, "receivedAt" | "name" | "email" | "ort" | "flurstueck" | "groesse" | "flaechentyp">;
    stand: NonNullable<LeadMeta["ankauf"]>;
    mails: M.GesendeteMail[];
  };
};
