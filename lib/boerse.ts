import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { hasBlobToken } from "@/lib/admin/config";
import { istEigeneFlaeche, leadView, type BoerseMeta, type LeadView } from "@/lib/admin/model";
import { jsonAendern, kurzwert, listLeads, mutateZustand, readZustand, websiteDateiLesen } from "@/lib/admin/store";
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
  type BoerseArt,
  type BoerseEintrag,
} from "./boerse-regeln";

export { artText, boerseLuecken, haText, provisionHinweis, provisionHinweisPacht, type BoerseArt, type BoerseEintrag };

// Flächenbörse: Angebote zum Kauf und zur Pacht anonym auf lippeforst.de — nur Flächentyp, gerundete
// Größe, Gemeinde, ein kurzer Text und feste Zusatzangaben; nie Name, Flurstück oder genaue Lage.
// Veröffentlicht wird nur mit Einwilligung des Eigentümers und per Klick in der Verwaltung (bzw.
// über die eingeschaltete Automatik-Regel R1). Die Website liest ausschließlich diese bereinigte
// Datei, nie die Anfragen selbst. Interesse läuft über den normalen Ablauf (Gesuch → Einladung →
// Nachweisvertrag → Zustimmung → Freigabe → Vermittlung).
// Vergebene Flächen (Vertrag geschlossen) und Angebote von Eigentümern, die widerrufen, gekündigt
// oder deren Zugang gesperrt ist, verschwinden automatisch. Eigene Flächen des Geschäftsführers
// bzw. seiner Familie sind als solche gekennzeichnet und provisionsfrei (Dennis 27.09.2026).

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
    return { ...LEER, ...d, angebote };
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

export function neuerBoerseCode(vorhanden: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const code = `LF-${1000 + Math.floor(Math.random() * 9000)}`;
    if (!vorhanden.has(code)) return code;
  }
  return `LF-${Date.now().toString().slice(-4)}`;
}

/** Warum ein Angebot trotz „online“ nicht (mehr) erscheinen darf — vergeben oder Eigentümer ausgestiegen. */
export function sperrGrund(id: string, kunden: Map<string, M.KundeRecord>, vorgaenge: M.VorgangRecord[]): string | null {
  if (vorgaenge.some((v) => v.angebotId === id && v.abschluss)) return "vergeben (Vertrag geschlossen)";
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
        ...(istEigeneFlaeche(lead, meta) ? { eigen: true } : {}),
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
  const k = M.aktuelleKonditionen(einstellungen);
  const neu: BoerseDatei = { v: 1, stand: new Date().toISOString(), provision: provisionHinweis(k), provisionPacht: provisionHinweisPacht(k), angebote };
  await jsonAendern<BoerseDatei>(BOERSE_PFAD, () => ({ ...neu }), (d) => {
    d.v = 1;
    d.stand = neu.stand;
    d.provision = neu.provision;
    d.provisionPacht = neu.provisionPacht;
    d.angebote = neu.angebote;
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
      const m = z.anfragen[id];
      if (!m?.boerse?.online) continue;
      z.anfragen[id] = { ...m, boerse: { ...m.boerse, online: false, offline: { am, grund }, geaendert: { am, von } } };
      codes.push(m.boerse.code);
      anzahl++;
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
  if (l.rolle !== "angebot" || (l.art !== "kauf" && l.art !== "pacht")) return null;
  let ergebnis: "erteilt" | "widerrufen" | null = null;
  let warOnline = false;
  const jetzt = new Date().toISOString();
  await mutateZustand("kunde", (z) => {
    ergebnis = null;
    warOnline = false;
    const meta = { ...(z.anfragen[leadId] ?? {}) };
    const alt = meta.boerse;
    if (erteilt && alt?.einwilligung) {
      // Schon eingewilligt: nur neue Zusatzangaben übernehmen (sofern noch leer).
      const neuDetails = detailsBereinigen({ ...(details ?? {}), ...(alt.details ?? {}) });
      if (JSON.stringify(neuDetails ?? null) === JSON.stringify(detailsBereinigen(alt.details) ?? null)) return;
      meta.boerse = { ...alt, ...(neuDetails ? { details: neuDetails } : {}), geaendert: { am: jetzt, von: "kunde" } };
      z.anfragen[leadId] = meta;
      return { was: `Zusatzangaben für die Flächenbörse aus dem Kundenbereich übernommen (${alt.code})`, ref: leadId };
    }
    if (!erteilt && !alt?.einwilligung) return;
    const vorhanden = new Set(Object.values(z.anfragen).map((m) => m.boerse?.code).filter((c): c is string => Boolean(c)));
    const ha = flaechenHa ?? l.groesseWert.minHa ?? l.groesseWert.maxHa;
    const gemeinde = oeffentlicheLage(grobeLage(l, z.orte));
    const b: BoerseMeta = alt
      ? { ...alt }
      : {
          code: neuerBoerseCode(vorhanden),
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
      ergebnis = "erteilt";
    } else {
      b.einwilligung = null;
      warOnline = b.online;
      b.online = false;
      ergebnis = "widerrufen";
    }
    b.geaendert = { am: jetzt, von: "kunde" };
    meta.boerse = b;
    z.anfragen[leadId] = meta;
    return { was: erteilt ? `Einwilligung in die Flächenbörse im Kundenbereich erteilt (${b.code})` : `Einwilligung in die Flächenbörse im Kundenbereich widerrufen${warOnline ? " — Angebot offline" : ""}`, ref: leadId };
  });
  if (warOnline) await boerseNeuSchreiben();
  if (ergebnis) {
    const name = lead.name !== "—" ? lead.name : leadId;
    await adminInfo(
      ergebnis === "erteilt" ? `Flächenbörse: ${name} ist einverstanden — jetzt veröffentlichen` : `Flächenbörse: ${name} hat die Einwilligung widerrufen`,
      ergebnis === "erteilt"
        ? ["Der Eigentümer hat im Kundenbereich angekreuzt, dass seine Fläche anonym in der Flächenbörse erscheinen darf.", "Angaben prüfen und im Dashboard mit einem Klick veröffentlichen (oder Automatik-Regel R1 einschalten)."]
        : ["Der Eigentümer hat seine Einwilligung im Kundenbereich zurückgenommen.", warOnline ? "Das Angebot wurde sofort von der Website genommen." : "Das Angebot war nicht online."],
      `${site.url}/admin/dashboard#boerse`,
    );
  }
  return ergebnis;
}
