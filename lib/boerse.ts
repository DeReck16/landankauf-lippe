import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { hasBlobToken } from "@/lib/admin/config";
import { eckdatenFuer, fehlendeEckdaten } from "@/lib/admin/boerse-vorschlag";
import { leadView, type BoerseMeta, type LeadMeta, type LeadRecord, type LeadView } from "@/lib/admin/model";
import { drosseln, jsonAendern, kurzwert, listLeads, mutateZustand, readZustand, websiteDateiLesen } from "@/lib/admin/store";
import { grobeLage } from "@/lib/admin/matching";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { gleichePerson } from "@/lib/portal/anbieter-regeln";
import { adminInfo } from "@/lib/portal/mail";
import { site } from "@/lib/site";
import * as M from "@/lib/portal/model";
import { alleKunden, alleVorgaenge, ladeEinstellungen } from "@/lib/portal/speicher";
import {
  artText,
  boerseLuecken,
  detailsBereinigen,
  haText,
  oeffentlicheHa,
  oeffentlicheLage,
  provisionHinweis,
  provisionHinweisPacht,
  standardProvision,
  sucheLuecken,
  type BoerseArt,
  type BoerseEintrag,
} from "./boerse-regeln";

export { artText, boerseLuecken, haText, provisionHinweis, provisionHinweisPacht, sucheLuecken, type BoerseArt, type BoerseEintrag };

// Flächenbörse: Angebote zum Kauf und zur Pacht anonym auf lippeforst.de — nur Flächentyp, gerundete
// Größe, Gemeinde, ein kurzer Text und feste Zusatzangaben; nie Name, Flurstück oder genaue Lage.
// Veröffentlicht wird nur mit Einwilligung des Eigentümers und per Klick in der Verwaltung (bzw.
// über die eingeschaltete Automatik-Regel R1). Die Website liest ausschließlich diese bereinigte
// Datei, nie die Anfragen selbst. Interesse läuft über den normalen Ablauf (Gesuch → Einladung →
// Nachweisvertrag → Zustimmung → Freigabe → Vermittlung).
// Vergebene Flächen (Vertrag geschlossen) und Angebote von Eigentümern, die widerrufen, gekündigt
// oder deren Zugang gesperrt ist, verschwinden automatisch. Eigene Flächen des Geschäftsführers
// bzw. seiner Familie sind provisionsfrei, werden hier aber NICHT gekennzeichnet — die Offenlegung
// kommt erst später, in Einladung, Hinweis-Mail, Vorgang und Vertrag (Dennis 01.10.2026: „zu offen“).

export const BOERSE_PFAD = "boerse/angebote.json";
export const BOERSE_TAG = "flaechenboerse";

export type BoerseDatei = {
  v: 1;
  stand: string;
  /** Käuferprovision als Text (Stand beim letzten Veröffentlichen). */
  provision: string;
  /** Pächterprovision als Text (Stand beim letzten Veröffentlichen). */
  provisionPacht?: string;
  angebote: BoerseEintrag[];
  /** Suchaufträge („Gesucht“) mit Einwilligung des Suchenden — Kennung LS-…, ohne Zusatzangaben und Pakete. */
  gesuche?: BoerseEintrag[];
};

const LEER: BoerseDatei = { v: 1, stand: "", provision: "", angebote: [] };

/** Öffentliche Liste — gecacht (5 Minuten) und beim Veröffentlichen sofort erneuert. */
export async function ladeBoerse(): Promise<BoerseDatei> {
  if (!hasBlobToken()) return LEER;
  try {
    // Gecacht wird die Seite selbst (ISR, 5 Minuten, beim Veröffentlichen sofort erneuert).
    const d = await websiteDateiLesen<Partial<BoerseDatei>>(BOERSE_PFAD, { revalidate: 300, tags: [BOERSE_TAG] });
    if (!d) return LEER;
    // Ältere Dateien kennen nur Kaufangebote (ohne „art“).
    const angebote = Array.isArray(d.angebote) ? d.angebote.map((a) => ({ ...a, art: a.art === "pacht" ? ("pacht" as const) : ("kauf" as const) })) : [];
    const gesuche = Array.isArray(d.gesuche) ? d.gesuche.map((a) => ({ ...a, art: a.art === "pacht" ? ("pacht" as const) : ("kauf" as const) })) : [];
    return { ...LEER, ...d, angebote, gesuche };
  } catch {
    return LEER;
  }
}

export async function boerseAngebot(code: string): Promise<{ angebot: BoerseEintrag | null; provision: string }> {
  const d = await ladeBoerse();
  return { angebot: d.angebote.find((a) => a.code === code) ?? null, provision: d.provision };
}

/** Provisionshinweis der Börse — vor der ersten Veröffentlichung mit den Standardkonditionen. */
export function provisionOderStandard(d: BoerseDatei, art: BoerseArt = "kauf"): string {
  if (art === "pacht") return d.provisionPacht || standardProvision("pacht");
  return d.provision || standardProvision("kauf");
}

/** Kennung eines Angebots („LF-1234“) bzw. — mit Präfix „LS“ — eines Suchauftrags („LS-1234“). */
export function neuerBoerseCode(vorhanden: Set<string>, prefix: "LF" | "LS" = "LF"): string {
  for (let i = 0; i < 50; i++) {
    const code = `${prefix}-${1000 + Math.floor(Math.random() * 9000)}`;
    if (!vorhanden.has(code)) return code;
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

/** Alle vergebenen Kennungen (Angebote und Suchaufträge) — damit keine zweimal vorkommt. */
export function vergebeneCodes(anfragen: Record<string, { boerse?: BoerseMeta; suche?: BoerseMeta }>): Set<string> {
  return new Set(Object.values(anfragen).flatMap((m) => [m.boerse?.code, m.suche?.code]).filter((c): c is string => Boolean(c)));
}

/** Warum ein Angebot trotz „online“ nicht (mehr) erscheinen darf — vergeben oder Eigentümer ausgestiegen. */
export function sperrGrund(id: string, kunden: Map<string, M.KundeRecord>, vorgaenge: M.VorgangRecord[]): string | null {
  if (vorgaenge.some((v) => v.angebotId === id && v.abschluss)) return "vergeben (Vertrag geschlossen)";
  if (vorgaenge.some((v) => v.gesuchId === id && v.abschluss)) return "erfüllt (Vertrag geschlossen)";
  const k = kunden.get(id);
  if (k?.widerruf) return "Eigentümer hat seine Vereinbarung widerrufen";
  if (k?.kuendigung) return "Eigentümer hat seine Vereinbarung gekündigt";
  if (k?.gesperrt) return "Zugang des Eigentümers gesperrt";
  return null;
}

/** Baut die öffentliche Datei aus allen freigegebenen Angeboten neu und erneuert die Seiten. */
export async function boerseNeuSchreiben(): Promise<number> {
  const [leads, { zustand }, einstellungen, kundenListe, vorgaenge] = await Promise.all([listLeads(), readZustand(), ladeEinstellungen(), alleKunden(), alleVorgaenge()]);
  const kunden = new Map(kundenListe.map((k) => [k.id, k]));
  const kandidaten: { e: BoerseEintrag; l: LeadView; einzeln: boolean }[] = [];
  for (const lead of leads) {
    const meta = zustand.anfragen[lead.id];
    const b = meta?.boerse;
    if (!b?.online) continue;
    const l = leadView(lead, meta);
    if (boerseLuecken(b, l).length) continue;
    if (sperrGrund(lead.id, kunden, vorgaenge)) continue;
    const details = detailsBereinigen(b.details);
    kandidaten.push({
      l,
      einzeln: Boolean(b.einzeln),
      e: {
        code: b.code,
        art: l.art === "pacht" ? "pacht" : "kauf",
        typ: b.typ,
        groesseHa: oeffentlicheHa(b.groesseHa),
        lage: oeffentlicheLage(b.lage),
        text: b.text.trim(),
        seit: b.seit ?? new Date().toISOString(),
        ...(details ? { details } : {}),
      },
    });
  }
  // Pakete: mehrere Flächen desselben Eigentümers (gleiche E-Mail, gleiche Person), gleicher Art,
  // gleichen Typs, gleicher Gemeinde — erscheinen als eine Karte (Kennung ohne Rückschluss auf die Person).
  const gruppen = new Map<string, { e: BoerseEintrag; l: LeadView }[]>();
  for (const k of kandidaten) {
    if (k.einzeln) continue;
    const email = (kunden.get(k.l.id)?.email || k.l.email || "").toLowerCase();
    const schluessel = `${email}|${k.e.art}|${k.e.typ}|${k.e.lage.toLowerCase()}`;
    const liste = gruppen.get(schluessel) ?? [];
    liste.push(k);
    gruppen.set(schluessel, liste);
  }
  for (const [schluessel, liste] of gruppen) {
    // Innerhalb der Gruppe nur wirklich dieselbe Person (z. B. nicht Dennis und eine vertretene Angehörige).
    const erster = liste[0];
    const gleiche = liste.filter((x) => gleichePerson(x.l.name, erster.l.name));
    if (gleiche.length < 2) continue;
    const paket = `P${kurzwert(`${schluessel}|${erster.l.name}`, "boerse-paket").slice(0, 8)}`;
    for (const x of gleiche) x.e.paket = paket;
  }
  const angebote = kandidaten.map((k) => k.e).sort((a, b) => b.seit.localeCompare(a.seit));
  // Suchaufträge: gleiche Regeln (Einwilligung, keine verräterischen Angaben, nicht erfüllt/ausgestiegen), nie als Paket.
  const gesuche: BoerseEintrag[] = [];
  for (const lead of leads) {
    const meta = zustand.anfragen[lead.id];
    const b = meta?.suche;
    if (!b?.online) continue;
    const l = leadView(lead, meta);
    if (sucheLuecken(b, l).length || sperrGrund(lead.id, kunden, vorgaenge)) continue;
    gesuche.push({
      code: b.code,
      art: l.art === "pacht" ? "pacht" : "kauf",
      typ: b.typ,
      groesseHa: oeffentlicheHa(b.groesseHa),
      lage: oeffentlicheLage(b.lage),
      text: b.text.trim(),
      seit: b.seit ?? new Date().toISOString(),
    });
  }
  gesuche.sort((a, b) => b.seit.localeCompare(a.seit));
  const k = M.aktuelleKonditionen(einstellungen);
  const neu: BoerseDatei = { v: 1, stand: new Date().toISOString(), provision: provisionHinweis(k), provisionPacht: provisionHinweisPacht(k), angebote, gesuche };
  await jsonAendern<BoerseDatei>(BOERSE_PFAD, () => ({ ...neu }), (d) => {
    d.v = 1;
    d.stand = neu.stand;
    d.provision = neu.provision;
    d.provisionPacht = neu.provisionPacht;
    d.angebote = neu.angebote;
    d.gesuche = neu.gesuche;
  });
  revalidateTag(BOERSE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/flaechenboerse");
  revalidatePath("/flaechenboerse/[code]", "page");
  revalidatePath("/api/boerse");
  return angebote.length;
}

/**
 * Angebote offline nehmen, weil sie vergeben sind oder der Eigentümer ausgestiegen ist (Vertrag
 * geschlossen, Widerruf, Kündigung, Sperre) — mit Grund, damit die Verwaltung sieht, warum.
 * Schreibt die öffentliche Datei sofort neu. Liefert die Anzahl der offline genommenen Angebote.
 */
export async function boerseOfflineNehmen(ids: string[], grund: string, von: string): Promise<number> {
  const ziel = new Set(ids.filter((x) => /^LL-[A-Z0-9]+$/.test(x)));
  if (ziel.size === 0) return 0;
  let anzahl = 0;
  const am = new Date().toISOString();
  await mutateZustand(von, (z) => {
    anzahl = 0;
    const codes: string[] = [];
    for (const id of ziel) {
      for (const feld of ["boerse", "suche"] as const) {
        const m = z.anfragen[id];
        const b = m?.[feld];
        if (!m || !b?.online) continue;
        z.anfragen[id] = { ...m, [feld]: { ...b, online: false, offline: { am, grund }, geaendert: { am, von } } };
        codes.push(b.code);
        anzahl++;
      }
    }
    if (!anzahl) return;
    return { was: `Flächenbörse: ${codes.join(", ")} offline — ${grund}`, ref: [...ziel][0] };
  });
  // Auch ohne eigene Änderung neu schreiben: Die Datei filtert vergebene und ausgestiegene Angebote ohnehin.
  await boerseNeuSchreiben().catch((err) => console.error("[boerse] Neu schreiben fehlgeschlagen", err));
  return anzahl;
}

/**
 * Veröffentlichen ohne Klick (Automatik R1): nur mit Einwilligung, ohne Lücken, nicht vergeben/gekündigt
 * und nie für Angebote, die schon einmal offline genommen wurden (`offline` gesetzt) — die bleiben
 * offline, bis die Verwaltung sie selbst veröffentlicht.
 */
export async function boerseVeroeffentlichen(id: string, von: string): Promise<{ ok: boolean; grund?: string; code?: string }> {
  const [leads, kundenListe, vorgaenge] = await Promise.all([listLeads(), alleKunden(), alleVorgaenge()]);
  const lead = leads.find((x) => x.id === id);
  if (!lead) return { ok: false, grund: "Anfrage nicht gefunden" };
  const gesperrt = sperrGrund(id, new Map(kundenListe.map((k) => [k.id, k])), vorgaenge);
  if (gesperrt) return { ok: false, grund: gesperrt };
  const jetzt = new Date().toISOString();
  let ok = false;
  let grund = "";
  let code = "";
  await mutateZustand(von, (z) => {
    ok = false;
    const meta = z.anfragen[id];
    const b = meta?.boerse;
    if (!meta || !b?.einwilligung) {
      grund = "keine Einwilligung";
      return;
    }
    if (b.online || b.offline) {
      grund = b.online ? "schon online" : `von Hand offline genommen (${b.offline?.grund ?? "—"})`;
      return;
    }
    const luecken = boerseLuecken(b, leadView(lead, meta));
    if (luecken.length) {
      grund = luecken.join(" · ");
      return;
    }
    z.anfragen[id] = { ...meta, boerse: { ...b, online: true, seit: b.seit ?? jetzt, geaendert: { am: jetzt, von } } };
    ok = true;
    code = b.code;
    return { was: `In der Flächenbörse veröffentlicht (${b.code}) — automatisch nach Einwilligung (R1)`, ref: id };
  });
  if (ok) await boerseNeuSchreiben().catch((err) => console.error("[boerse] Neu schreiben fehlgeschlagen", err));
  return ok ? { ok, code } : { ok, grund };
}

export const EINWILLIGUNG_QUELLEN = ["telefonisch", "per E-Mail", "schriftlich", "im Kundenbereich"] as const;
/** Einwilligung per Bestätigungslink (Häkchen im Anfrageformular) — nur über `veroeffentlichungBestaetigen`, nie als Wahl in der Verwaltung. */
export const LINK_QUELLE = "per Bestätigungslink";
/** Höchstens so viele Bestätigungen je Tag gehen allein online — danach bleibt der Klick der Verwaltung (Schutz vor Massen-Einträgen). */
export const BESTAETIGUNG_LIMIT_PRO_TAG = 10;
/** So lange nach dem Eingang der Anfrage gilt der Bestätigungslink zum Bestätigen (der Widerruf über denselben Link bleibt länger möglich). */
export const BESTAETIGUNG_FRIST_TAGE = 30;

/** Was der Schalter „Öffentlich“ noch braucht, bevor er veröffentlichen kann — die Verwaltung ergänzt es direkt dort. */
export type SeiteFormular = {
  /** Es ist noch keine Einwilligung erfasst — die Verwaltung gibt an, wie sie erteilt wurde. */
  einwilligungNoetig: boolean;
  /** Vorschlag bzw. gespeicherte Eckdaten (Typ, Größe in ha, grobe Lage) zum Prüfen und Ändern. */
  typ: string;
  groesseHa: number | null;
  lage: string;
  /** Was an den Eckdaten noch fehlt oder verräterisch ist. */
  luecken: string[];
};

/** Warum ein Bestätigungslink nichts (mehr) bewirkt — feste Hinweise für die Seite, kein Freitext in der Adresse. */
export type BestaetigungCode = "keine" | "abgelaufen" | "widerrufen" | "offline" | "bereits" | "zuviel";

export type SeiteErgebnis = { ok: boolean; meldung: string; formular?: SeiteFormular; code?: BestaetigungCode };

/** Eingaben der Verwaltung beim Veröffentlichen: nur Eckdaten. */
export type SeiteOptionen = {
  /** Wie die Einwilligung erteilt wurde — nur nötig, wenn noch keine erfasst ist. */
  quelle?: string;
  /** Eckdaten überschreiben (Flächentyp, Größe in ha, grobe Lage). */
  angaben?: { typ?: string; groesseHa?: number | null; lage?: string };
  /** Einwilligung und Eckdaten erfassen, aber nicht veröffentlichen. */
  nurVorbereiten?: boolean;
};

type Kontext = { leads: LeadRecord[]; kunden: Map<string, M.KundeRecord>; vorgaenge: M.VorgangRecord[] };

async function ladeKontext(): Promise<Kontext> {
  const [leads, kundenListe, vorgaenge] = await Promise.all([listLeads(), alleKunden(), alleVorgaenge()]);
  return { leads, kunden: new Map(kundenListe.map((k) => [k.id, k])), vorgaenge };
}

/**
 * Ein Angebot bzw. Suchauftrag öffentlich machen oder von der Seite nehmen — ohne die öffentliche Datei neu zu schreiben
 * (`datei` sagt, ob das nötig ist). Öffentlich wird nur mit erfasster Einwilligung (so verspricht es die Datenschutzerklärung).
 * Ohne Eingaben prüft der Aufruf nur: Fehlt die Einwilligung oder sind die Eckdaten unvollständig, schreibt er nichts und
 * liefert das Formular mit Vorschlag zurück; mit `quelle` bzw. `angaben` wird erfasst und, wenn nichts fehlt, veröffentlicht.
 */
async function schalteEinzeln(ctx: Kontext, id: string, ziel: "oeffentlich" | "nicht", von: string, opt?: SeiteOptionen): Promise<{ ergebnis: SeiteErgebnis; datei: boolean }> {
  const lead = ctx.leads.find((x) => x.id === id);
  if (!lead) return { ergebnis: { ok: false, meldung: "Anfrage nicht gefunden." }, datei: false };
  const sperre = sperrGrund(id, ctx.kunden, ctx.vorgaenge);
  const jetzt = new Date().toISOString();
  let ergebnis: SeiteErgebnis = { ok: false, meldung: "Keine Änderung." };
  let datei = false;

  await mutateZustand(von, (z) => {
    ergebnis = { ok: false, meldung: "Keine Änderung." };
    datei = false;
    const meta: LeadMeta = { ...(z.anfragen[id] ?? {}) };
    const l = leadView(lead, meta);
    const gesuch = l.rolle === "gesuch";
    if ((l.rolle !== "angebot" && !gesuch) || (l.art !== "kauf" && l.art !== "pacht")) {
      ergebnis = { ok: false, meldung: "Nur Angebote und Gesuche mit Kauf oder Pacht kommen auf die Seite." };
      return;
    }
    const feld = gesuch ? "suche" : "boerse";
    const luecken = gesuch ? sucheLuecken : boerseLuecken;
    const wort = gesuch ? "Suchauftrag" : "Fläche";

    if (ziel === "nicht") {
      const b = meta[feld];
      if (!b?.online) {
        ergebnis = { ok: true, meldung: "Stand schon nicht öffentlich." };
        return;
      }
      meta[feld] = { ...b, online: false, geaendert: { am: jetzt, von } };
      z.anfragen[id] = meta;
      datei = true;
      ergebnis = { ok: true, meldung: `${wort} von der Website genommen (${b.code}).` };
      return { was: `${gesuch ? "Suchliste" : "Flächenbörse"}: ${b.code} von Hand offline genommen (Anfragen-Liste)`, ref: id };
    }

    if (sperre) {
      ergebnis = { ok: false, meldung: `Nicht möglich: ${sperre}.` };
      return;
    }
    // Eckdaten: Gespeichertes zuerst, sonst aus der Anfrage vorgeschlagen; Eingaben der Verwaltung überschreiben.
    const b: BoerseMeta = meta[feld]
      ? { ...meta[feld]! }
      : { code: neuerBoerseCode(vergebeneCodes(z.anfragen), gesuch ? "LS" : "LF"), typ: "", groesseHa: null, lage: "", text: "", einwilligung: null, online: false };
    const e = eckdatenFuer(l, b, z.orte);
    b.typ = e.typ;
    b.groesseHa = e.groesseHa;
    b.lage = e.lage;
    const a = opt?.angaben;
    if (a) {
      if (a.typ && (FLAECHENTYPEN as readonly string[]).includes(a.typ)) b.typ = a.typ;
      if (a.groesseHa !== undefined) b.groesseHa = a.groesseHa != null && Number.isFinite(a.groesseHa) && a.groesseHa > 0 ? a.groesseHa : null;
      if (a.lage !== undefined) b.lage = a.lage.replace(/\s+/g, " ").trim().slice(0, 80);
    }
    const quelle = opt?.quelle;
    const quelleOk = Boolean(quelle) && [...EINWILLIGUNG_QUELLEN, LINK_QUELLE].includes(quelle!);
    const fehlt = fehlendeEckdaten(l, { ...b, einwilligung: b.einwilligung ?? { am: "", quelle: "", von: "" } }, z.orte);
    const einwilligungNoetig = !b.einwilligung && !quelleOk;
    // Reine Anfrage („Öffentlich“ gewählt, nichts mitgegeben): fehlt etwas, nichts speichern und das Formular mit Vorschlag zeigen.
    if (!a && !quelle && (einwilligungNoetig || fehlt.length)) {
      ergebnis = {
        ok: false,
        meldung: einwilligungNoetig ? `Keine Einwilligung erfasst — wie hat ${gesuch ? "der Suchende" : "der Eigentümer"} eingewilligt?` : `Eckdaten ergänzen: ${fehlt.join(" · ")}`,
        formular: { einwilligungNoetig, typ: b.typ, groesseHa: b.groesseHa, lage: b.lage, luecken: fehlt },
      };
      return;
    }
    if (einwilligungNoetig) {
      ergebnis = {
        ok: false,
        meldung: `Keine Einwilligung erfasst — wie hat ${gesuch ? "der Suchende" : "der Eigentümer"} eingewilligt?`,
        formular: { einwilligungNoetig: true, typ: b.typ, groesseHa: b.groesseHa, lage: b.lage, luecken: fehlt },
      };
      return;
    }
    if (!b.einwilligung) {
      b.einwilligung = { am: jetzt.slice(0, 10), quelle: quelle!, von };
      delete b.offline;
      delete b.widerrufenAm;
    }
    const offen = luecken(b, leadView(lead, { ...meta, [feld]: b }));
    b.geaendert = { am: jetzt, von };
    if (offen.length === 0 && opt?.nurVorbereiten) {
      ergebnis = { ok: false, meldung: `${wort} vorbereitet (${b.code}) — wartet auf den Klick der Verwaltung.` };
    } else if (offen.length === 0) {
      b.online = true;
      b.seit ??= jetzt;
      delete b.offline;
      datei = true;
      ergebnis = { ok: true, meldung: `${wort} ist öffentlich (${b.code}).` };
    } else {
      ergebnis = {
        ok: false,
        meldung: `Noch nicht veröffentlicht: ${offen.join(" · ")}.`,
        formular: { einwilligungNoetig: false, typ: b.typ, groesseHa: b.groesseHa, lage: b.lage, luecken: offen },
      };
    }
    meta[feld] = b;
    z.anfragen[id] = meta;
    const wie = von === "Kunde" ? "automatisch nach Bestätigung per E-Mail-Link" : "per Schalter in der Anfragen-Liste";
    return {
      was: b.online
        ? `${gesuch ? "In der Suchliste" : "In der Flächenbörse"} veröffentlicht (${b.code}) — ${wie}`
        : `${gesuch ? "Suchliste" : "Flächenbörse"}: Angaben vorbereitet (${b.code}), noch nicht veröffentlicht — ${offen.length ? offen.join(" · ") : "wartet auf den Klick der Verwaltung"}`,
      ref: id,
    };
  });

  return { ergebnis, datei };
}

/**
 * Schalter „Auf der Seite“ in der Anfragen-Liste: eine Fläche (Angebot) bzw. einen Suchauftrag (Gesuch) von Hand
 * öffentlich machen oder von der Website nehmen — immer nur mit den Eckdaten (Flächentyp, ungefähre Größe, grobe Lage).
 */
export async function seiteSchalten(id: string, ziel: "oeffentlich" | "nicht", von: string, opt?: SeiteOptionen): Promise<SeiteErgebnis> {
  const { ergebnis, datei } = await schalteEinzeln(await ladeKontext(), id, ziel, von, opt);
  if (datei) await boerseNeuSchreiben().catch((err) => console.error("[boerse] Neu schreiben fehlgeschlagen", err));
  return ergebnis;
}

/** Sammel-Schalter: mehrere Anfragen nacheinander öffentlich machen, die öffentliche Datei nur einmal neu schreiben. */
export async function seiteSchaltenViele(ids: string[], von: string, opt?: Pick<SeiteOptionen, "quelle">): Promise<{ id: string; ok: boolean; meldung: string }[]> {
  const ctx = await ladeKontext();
  const out: { id: string; ok: boolean; meldung: string }[] = [];
  let datei = false;
  for (const id of ids) {
    const r = await schalteEinzeln(ctx, id, "oeffentlich", von, opt?.quelle ? { quelle: opt.quelle } : undefined);
    datei ||= r.datei;
    out.push({ id, ok: r.ergebnis.ok, meldung: r.ergebnis.meldung });
  }
  if (datei) await boerseNeuSchreiben().catch((err) => console.error("[boerse] Neu schreiben fehlgeschlagen", err));
  return out;
}

/**
 * Bestätigungslink aus der Eingangsbestätigung (Häkchen „anonym anzeigen“ im Anfrageformular): Erst jetzt gilt die
 * Einwilligung — die E-Mail-Adresse ist damit bestätigt. Erfasst sie und veröffentlicht sofort, wenn die Eckdaten reichen.
 * Höchstens `BESTAETIGUNG_LIMIT_PRO_TAG` je Tag gehen so allein online — darüber wird die Einwilligung nur erfasst und die
 * Verwaltung veröffentlicht mit einem Klick.
 */
export async function veroeffentlichungBestaetigen(id: string): Promise<SeiteErgebnis> {
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const lead = leads.find((x) => x.id === id);
  if (!lead?.veroeffentlichen) return { ok: false, code: "keine", meldung: "Für diese Anfrage wurde keine Anzeige gewünscht." };
  if (Date.now() - Date.parse(lead.receivedAt) > BESTAETIGUNG_FRIST_TAGE * 86_400_000) return { ok: false, code: "abgelaufen", meldung: "Der Bestätigungslink ist abgelaufen." };
  // Ein Klick ändert nur, was der Kunde noch nicht entschieden hat: einmal bestätigen, danach nur noch zurücknehmen —
  // nie eine Anzeige gegen einen Widerruf oder eine Entscheidung der Verwaltung wieder einschalten.
  const meta = zustand.anfragen[id];
  const b = meta?.[leadView(lead, meta).rolle === "gesuch" ? "suche" : "boerse"];
  if (b?.widerrufenAm) return { ok: false, code: "widerrufen", meldung: "Die Einwilligung wurde zurückgenommen." };
  if (b?.offline) return { ok: false, code: "offline", meldung: "Die Anzeige wurde von der Verwaltung offline genommen." };
  if (b?.einwilligung) return { ok: true, code: "bereits", meldung: "Die Bestätigung liegt bereits vor." };
  // Wiederholte Versuche mit demselben Link zählen nicht gegen das gemeinsame Tageskontingent.
  if (!(await drosseln("boerse-bestaetigung-anfrage", id, [{ sekunden: 86_400, max: 3 }]))) return { ok: false, code: "zuviel", meldung: "Zu viele Versuche heute." };
  const frei = await drosseln("boerse-bestaetigung", "alle", [{ sekunden: 86_400, max: BESTAETIGUNG_LIMIT_PRO_TAG }]);
  const r = await seiteSchalten(id, "oeffentlich", "Kunde", { quelle: LINK_QUELLE, nurVorbereiten: !frei });
  const name = lead.name !== "—" ? lead.name : id;
  await adminInfo(
    `Flächenbörse: ${name} hat die Anzeige bestätigt`,
    ["Der Bestätigungslink aus der Eingangsbestätigung wurde geklickt — die Einwilligung ist damit erfasst.", r.ok ? r.meldung : `Noch nicht online: ${r.meldung}`],
    `${site.url}/admin/anfrage/${id}#boerse`,
  ).catch((err) => console.error("[boerse] Verwaltungs-Hinweis", err));
  return r;
}

/**
 * Angebot zu einer Börsen-Kennung (für das Verknüpfen eines Interessenten). Mit `nurOnline`
 * nur Angebote, die gerade veröffentlicht sind — vergebene oder zurückgezogene nicht.
 */
export function angebotZuCode(anfragen: Record<string, { boerse?: BoerseMeta; status?: string }>, code: string, opt: { nurOnline?: boolean } = {}): string | null {
  for (const [id, m] of Object.entries(anfragen)) {
    if (m.boerse?.code !== code) continue;
    if (opt.nurOnline && (!m.boerse.online || m.status === "erledigt" || m.status === "archiv")) return null;
    return id;
  }
  return null;
}

/**
 * Einwilligung aus dem Kundenbereich (Häkchen im Angaben-Formular eines Anbieters).
 * Legt fehlende Börsen-Angaben mit Vorschlägen an (Typ, gerundete Größe, „Raum <Gemeinde>“,
 * Zusatzangaben aus den Angaben des Anbieters), damit „Veröffentlichen“ ein Klick ist.
 * Veröffentlicht wird nur per Klick der Verwaltung oder über die eingeschaltete Automatik-Regel R1.
 * Widerruf nimmt ein veröffentlichtes Angebot sofort von der Website.
 */
export async function boerseEinwilligungKunde(
  leadId: string,
  erteilt: boolean,
  flaechenHa: number | null,
  details?: BoerseMeta["details"],
): Promise<"erteilt" | "widerrufen" | null> {
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const lead = leads.find((x) => x.id === leadId);
  if (!lead) return null;
  const l = leadView(lead, zustand.anfragen[leadId]);
  const gesuch = l.rolle === "gesuch";
  // Erteilt wird im Kundenbereich nur für Angebote; widerrufen werden kann auch ein Suchauftrag (Link der Bestätigungsmail).
  if ((l.rolle !== "angebot" && !(gesuch && !erteilt)) || (l.art !== "kauf" && l.art !== "pacht")) return null;
  const feld = gesuch ? "suche" : "boerse";
  let ergebnis: "erteilt" | "widerrufen" | null = null;
  let warOnline = false;
  const jetzt = new Date().toISOString();
  await mutateZustand("kunde", (z) => {
    ergebnis = null;
    warOnline = false;
    const meta = { ...(z.anfragen[leadId] ?? {}) };
    const alt = meta[feld];
    if (erteilt && alt?.einwilligung) {
      // Schon eingewilligt: nur neue Zusatzangaben übernehmen (sofern noch leer).
      const neuDetails = detailsBereinigen({ ...(details ?? {}), ...(alt.details ?? {}) });
      if (JSON.stringify(neuDetails ?? null) === JSON.stringify(detailsBereinigen(alt.details) ?? null)) return;
      meta.boerse = { ...alt, ...(neuDetails ? { details: neuDetails } : {}), geaendert: { am: jetzt, von: "kunde" } };
      z.anfragen[leadId] = meta;
      return { was: `Zusatzangaben für die Flächenbörse aus dem Kundenbereich übernommen (${alt.code})`, ref: leadId };
    }
    if (!erteilt && !alt?.einwilligung) return;
    const ha = flaechenHa ?? l.groesseWert.minHa ?? l.groesseWert.maxHa;
    const gemeinde = oeffentlicheLage(grobeLage(l, z.orte));
    const b: BoerseMeta = alt
      ? { ...alt }
      : {
          code: neuerBoerseCode(vergebeneCodes(z.anfragen), gesuch ? "LS" : "LF"),
          typ: (FLAECHENTYPEN as readonly string[]).includes(l.typ) ? l.typ : "Sonstiges",
          groesseHa: ha != null && ha > 0 ? Math.max(0.5, Math.round(ha * 2) / 2) : null,
          lage: gemeinde ? `Raum ${gemeinde}` : "",
          text: "",
          einwilligung: null,
          online: false,
        };
    if (erteilt) {
      b.einwilligung = { am: jetzt.slice(0, 10), quelle: "im Kundenbereich", von: "kunde" };
      const d = detailsBereinigen({ ...(details ?? {}), ...(b.details ?? {}) });
      if (d) b.details = d;
      delete b.offline;
      delete b.widerrufenAm;
      ergebnis = "erteilt";
    } else {
      b.einwilligung = null;
      b.widerrufenAm = jetzt;
      warOnline = b.online;
      b.online = false;
      ergebnis = "widerrufen";
    }
    b.geaendert = { am: jetzt, von: "kunde" };
    meta[feld] = b;
    z.anfragen[leadId] = meta;
    const bn = gesuch ? "Suchliste" : "Flächenbörse";
    return { was: erteilt ? `Einwilligung in die ${bn} im Kundenbereich erteilt (${b.code})` : `Einwilligung in die ${bn} widerrufen${warOnline ? ` — ${gesuch ? "Suchauftrag" : "Angebot"} offline` : ""}`, ref: leadId };
  });
  if (warOnline) await boerseNeuSchreiben();
  if (ergebnis) {
    const name = lead.name !== "—" ? lead.name : leadId;
    await adminInfo(
      ergebnis === "erteilt" ? `Flächenbörse: ${name} ist einverstanden — jetzt veröffentlichen` : `Flächenbörse: ${name} hat die Einwilligung widerrufen`,
      ergebnis === "erteilt"
        ? ["Der Eigentümer hat im Kundenbereich angekreuzt, dass seine Fläche anonym in der Flächenbörse erscheinen darf.", "Angaben prüfen und im Dashboard mit einem Klick veröffentlichen (oder Automatik-Regel R1 einschalten)."]
        : [`${gesuch ? "Der Suchende hat" : "Der Eigentümer hat"} seine Einwilligung zurückgenommen.`, warOnline ? `${gesuch ? "Der Suchauftrag" : "Das Angebot"} wurde sofort von der Website genommen.` : `${gesuch ? "Der Suchauftrag" : "Das Angebot"} war nicht online.`],
      `${site.url}/admin/dashboard#boerse`,
    );
  }
  return ergebnis;
}
