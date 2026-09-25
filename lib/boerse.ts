import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { blobToken, dataPrefix, hasBlobToken } from "@/lib/admin/config";
import { leadView, type BoerseMeta, type LeadView } from "@/lib/admin/model";
import { jsonAendern, listLeads, mutateZustand, readZustand } from "@/lib/admin/store";
import { grobeLage } from "@/lib/admin/matching";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { adminInfo } from "@/lib/portal/mail";
import { site } from "@/lib/site";
import * as M from "@/lib/portal/model";
import { ladeEinstellungen } from "@/lib/portal/speicher";

// Flächenbörse: Kaufangebote anonym auf lippeforst.de — nur Flächentyp, ungefähre
// Größe, grobe Lage und ein kurzer Text; nie Name, Flurstück oder genaue Lage.
// Veröffentlicht wird nur mit Einwilligung des Eigentümers und per Klick in der
// Verwaltung. Die Website liest ausschließlich diese bereinigte Datei, nie die
// Anfragen selbst. Interesse läuft über den normalen Ablauf (Gesuch → Einladung
// → Provisionsvereinbarung → Zustimmung → Freigabe → Vermittlung).

export const BOERSE_PFAD = "boerse/angebote.json";
export const BOERSE_TAG = "flaechenboerse";

export type BoerseEintrag = {
  code: string;
  art: "kauf";
  typ: string;
  groesseHa: number | null;
  lage: string;
  text: string;
  seit: string;
};

export type BoerseDatei = {
  v: 1;
  stand: string;
  /** Käuferprovision als Text (Stand beim letzten Veröffentlichen). */
  provision: string;
  angebote: BoerseEintrag[];
};

const LEER: BoerseDatei = { v: 1, stand: "", provision: "", angebote: [] };

/** Öffentliche Liste — gecacht (5 Minuten) und beim Veröffentlichen sofort erneuert. */
export async function ladeBoerse(): Promise<BoerseDatei> {
  if (!hasBlobToken()) return LEER;
  try {
    const token = blobToken();
    const storeId = token.split("_")[3];
    // Cache-Buster: Das Blob-CDN hält überschriebene Dateien sonst bis zu einer Minute alt vor.
    // Gecacht wird die Seite selbst (ISR, 5 Minuten, beim Veröffentlichen sofort erneuert).
    const res = await fetch(`https://${storeId}.private.blob.vercel-storage.com/${dataPrefix()}${BOERSE_PFAD}?cache=0&r=${Date.now()}`, {
      headers: { authorization: `Bearer ${token}` },
      next: { revalidate: 300, tags: [BOERSE_TAG] },
    });
    if (!res.ok) return LEER;
    const d = (await res.json()) as Partial<BoerseDatei>;
    return { ...LEER, ...d, angebote: Array.isArray(d.angebote) ? d.angebote : [] };
  } catch {
    return LEER;
  }
}

export async function boerseAngebot(code: string): Promise<{ angebot: BoerseEintrag | null; provision: string }> {
  const d = await ladeBoerse();
  return { angebot: d.angebote.find((a) => a.code === code) ?? null, provision: d.provision };
}

/** Provisionshinweis der Börse — vor der ersten Veröffentlichung mit den Standardkonditionen. */
export function provisionOderStandard(d: BoerseDatei): string {
  return d.provision || provisionHinweis(M.STANDARD_KONDITIONEN);
}

function zahlDe(n: number, stellen = 2): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: stellen });
}

export function haText(ha: number | null): string {
  return ha == null ? "Größe auf Anfrage" : `ca. ${zahlDe(ha, 1)} ha`;
}

/** Käuferprovision als kurzer, vollständiger Hinweis (Preisangabe inkl. USt für Verbraucher). */
export function provisionHinweis(k: M.Konditionen): string {
  if (k.ust.kauf === "zuzueglich") {
    const brutto = Math.round(k.kaufProzent * (1 + k.ustProzent / 100) * 100) / 100;
    return `${zahlDe(k.kaufProzent)} % des Kaufpreises zzgl. ${zahlDe(k.ustProzent)} % USt (${zahlDe(brutto)} % inkl. USt)`;
  }
  return `${zahlDe(k.kaufProzent)} % des Kaufpreises inkl. ${zahlDe(k.ustProzent)} % USt`;
}

export function neuerBoerseCode(vorhanden: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const code = `LF-${1000 + Math.floor(Math.random() * 9000)}`;
    if (!vorhanden.has(code)) return code;
  }
  return `LF-${Date.now().toString().slice(-4)}`;
}

/** Was einer Veröffentlichung im Weg steht (leer = darf online). */
export function boerseLuecken(b: BoerseMeta | undefined, l: LeadView): string[] {
  const fehlt: string[] = [];
  if (l.rolle !== "angebot" || l.art !== "kauf") fehlt.push("nur Kaufangebote (Rolle „Angebot“, Art „Kauf“) kommen in die Börse");
  if (l.status === "archiv" || l.status === "erledigt") fehlt.push("die Anfrage ist erledigt oder archiviert");
  if (!b) return [...fehlt, "noch keine Angaben für die Börse gespeichert"];
  if (!b.einwilligung) fehlt.push("Einwilligung des Eigentümers fehlt");
  if (!b.typ) fehlt.push("Flächentyp fehlt");
  if (!b.groesseHa || b.groesseHa <= 0) fehlt.push("ungefähre Größe fehlt");
  if (!b.lage.trim()) fehlt.push("grobe Lage fehlt");
  const oeffentlich = `${b.lage} ${b.text}`.toLowerCase();
  if (/flur|gemarkung|\b\d{1,4}\s*\/\s*\d{1,4}\b/.test(oeffentlich)) fehlt.push("Lage oder Text enthält Flur-/Flurstücksangaben");
  if (/stra(ss|ß)e|\bweg\s+\d|\bstr\.\s*\d|@|\+?\d[\d\s/-]{6,}/.test(oeffentlich)) fehlt.push("Lage oder Text enthält eine Adresse, E-Mail oder Telefonnummer");
  const namensteile = (l.name || "").split(/[\s,.-]+/).filter((t) => t.length >= 3 && t !== "—");
  if (namensteile.some((t) => oeffentlich.includes(t.toLowerCase()))) fehlt.push("Lage oder Text enthält den Namen des Eigentümers");
  return fehlt;
}

/** Baut die öffentliche Datei aus allen freigegebenen Angeboten neu und erneuert die Seiten. */
export async function boerseNeuSchreiben(): Promise<number> {
  const [leads, { zustand }, einstellungen] = await Promise.all([listLeads(), readZustand(), ladeEinstellungen()]);
  const angebote: BoerseEintrag[] = [];
  for (const lead of leads) {
    const meta = zustand.anfragen[lead.id];
    const b = meta?.boerse;
    if (!b?.online) continue;
    const l = leadView(lead, meta);
    if (boerseLuecken(b, l).length) continue;
    angebote.push({ code: b.code, art: "kauf", typ: b.typ, groesseHa: b.groesseHa, lage: b.lage.trim(), text: b.text.trim(), seit: b.seit ?? new Date().toISOString() });
  }
  angebote.sort((a, b) => b.seit.localeCompare(a.seit));
  const neu: BoerseDatei = { v: 1, stand: new Date().toISOString(), provision: provisionHinweis(M.aktuelleKonditionen(einstellungen)), angebote };
  await jsonAendern<BoerseDatei>(BOERSE_PFAD, () => ({ ...neu }), (d) => {
    d.v = 1;
    d.stand = neu.stand;
    d.provision = neu.provision;
    d.angebote = neu.angebote;
  });
  revalidateTag(BOERSE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/flaechenboerse");
  revalidatePath("/flaechenboerse/[code]", "page");
  return angebote.length;
}

/** Angebot zu einer Börsen-Kennung (für das Verknüpfen eines Interessenten). */
export function angebotZuCode(anfragen: Record<string, { boerse?: BoerseMeta }>, code: string): string | null {
  for (const [id, m] of Object.entries(anfragen)) if (m.boerse?.code === code) return id;
  return null;
}

/**
 * Einwilligung aus dem Kundenbereich (Häkchen im Angaben-Formular eines Verkäufers).
 * Legt fehlende Börsen-Angaben mit Vorschlägen an (Typ, gerundete Größe, „Raum <Gemeinde>“),
 * damit „Veröffentlichen“ im Dashboard ein Klick ist. Veröffentlicht wird NIE automatisch.
 * Widerruf nimmt ein veröffentlichtes Angebot sofort von der Website.
 */
export async function boerseEinwilligungKunde(leadId: string, erteilt: boolean, flaechenHa: number | null): Promise<"erteilt" | "widerrufen" | null> {
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const lead = leads.find((x) => x.id === leadId);
  if (!lead) return null;
  const l = leadView(lead, zustand.anfragen[leadId]);
  if (l.rolle !== "angebot" || l.art !== "kauf") return null;
  let ergebnis: "erteilt" | "widerrufen" | null = null;
  let warOnline = false;
  const jetzt = new Date().toISOString();
  await mutateZustand("kunde", (z) => {
    ergebnis = null;
    warOnline = false;
    const meta = { ...(z.anfragen[leadId] ?? {}) };
    const alt = meta.boerse;
    if (erteilt && alt?.einwilligung) return;
    if (!erteilt && !alt?.einwilligung) return;
    const vorhanden = new Set(Object.values(z.anfragen).map((m) => m.boerse?.code).filter((c): c is string => Boolean(c)));
    const ha = flaechenHa ?? l.groesseWert.minHa ?? l.groesseWert.maxHa;
    const gemeinde = grobeLage(l, z.orte);
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
        ? ["Der Verkäufer hat im Kundenbereich angekreuzt, dass seine Fläche anonym in der Flächenbörse erscheinen darf.", "Angaben prüfen und im Dashboard unter „Flächenbörse“ mit einem Klick veröffentlichen."]
        : ["Der Verkäufer hat seine Einwilligung im Kundenbereich zurückgenommen.", warOnline ? "Das Angebot wurde sofort von der Website genommen." : "Das Angebot war nicht online."],
      `${site.url}/admin/dashboard#boerse`,
    );
  }
  return ergebnis;
}
