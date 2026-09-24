import "server-only";
import { listLeads, mutateZustand, readZustand } from "@/lib/admin/store";
import { leadView, type LeadView, type MatchMeta, type MatchStatus, type Zustand } from "@/lib/admin/model";
import { dokumentHash } from "@/lib/vertraege/hash";
import type { Dokument } from "@/lib/vertraege/dokument";
import { site } from "@/lib/site";
import { VORLAGEN, istFreigegeben } from "@/lib/vertraege/vorlagen";
import type { KaufabsichtDaten, PachtvertragDaten } from "@/lib/vertraege/vorlagen/typen";
import { GRUSS, verwaltungsLink } from "./ablauf";
import { pdfAblegen, protokollDokument } from "./dokumente";
import { adminInfo, kundenMail, type Anhang } from "./mail";
import * as M from "./model";
import { aendereKunde, aendereVorgang, alleVorgaenge, ladeEinstellungen, ladeKunde, ladeVorgang } from "./speicher";
import * as T from "./texte";

// Abläufe je Vorgang (Paar aus Angebot und Gesuch): Zustimmung zum Kontakt,
// Freigabe, Pachtvertrag, Kaufabsicht, externe Abschlüsse, Provision,
// Treue-Gutschein, Bewertungsbitte.

/** In diesen Status sieht der Kunde den Vorgang im Kundenbereich. */
export const SICHTBAR: MatchStatus[] = ["angefragt", "kontakt", "abschluss"];

/**
 * Zuständige Stelle für die Anzeige nach § 2 LPachtVG: in NRW die Geschäftsführung
 * der Kreisstelle der Landwirtschaftskammer als Landesbeauftragte (§ 5 Abs. 1 Nr. 2
 * ZustVO Agrar NRW), örtlich am Ort der Hofstelle des Verpächters, sonst der
 * Flächen (§ 6 LPachtVG). Für den Kreis Lippe: Kreisstellen Höxter, Lippe, Paderborn.
 */
export const PACHTANZEIGE_STELLE =
  "die Geschäftsführerin oder der Geschäftsführer der Kreisstelle der Landwirtschaftskammer Nordrhein-Westfalen als Landesbeauftragte(r) am Ort der Hofstelle des Verpächters, sonst am Ort der Flächen — für den Kreis Lippe die Kreisstellen Höxter, Lippe, Paderborn (Bohlenweg 3, 33034 Brakel; Postanschrift: Landwirtschaftskammer NRW, Kreisstellen Höxter, Lippe, Paderborn, 48108 Münster; Telefon 05272 3701-0)";

/** Genehmigungsbehörde nach dem Grundstückverkehrsgesetz (§ 5 Abs. 1 Nr. 3 ZustVO Agrar NRW). */
export const GRDSTVG_STELLE =
  "die Geschäftsführung der Kreisstelle der Landwirtschaftskammer Nordrhein-Westfalen als Landesbeauftragte — für den Kreis Lippe die Kreisstellen Höxter, Lippe, Paderborn in Brakel";

export type VorgangKontext = {
  key: string;
  art: M.Art;
  meta: MatchMeta | null;
  vorgang: M.VorgangRecord | null;
  angebot: LeadView;
  gesuch: LeadView;
  anbieter: M.KundeRecord | null;
  suchender: M.KundeRecord | null;
  zustand: Zustand;
};

export async function ladeVorgangKontext(key: string): Promise<VorgangKontext | null> {
  const [angebotId, gesuchId] = key.split("~");
  const [leads, { zustand }, vorgang, anbieter, suchender] = await Promise.all([
    listLeads(),
    readZustand(),
    ladeVorgang(key),
    ladeKunde(angebotId),
    ladeKunde(gesuchId),
  ]);
  const a = leads.find((l) => l.id === angebotId);
  const g = leads.find((l) => l.id === gesuchId);
  if (!a || !g) return null;
  const angebot = leadView(a, zustand.anfragen[a.id]);
  const gesuch = leadView(g, zustand.anfragen[g.id]);
  const art: M.Art = vorgang?.art ?? (angebot.art === "kauf" ? "kauf" : "pacht");
  return { key, art, meta: zustand.paare[key] ?? null, vorgang, angebot, gesuch, anbieter, suchender, zustand };
}

function jetzt(): string {
  return new Date().toISOString();
}

function kundenName(k: M.KundeRecord | null, l: LeadView): string {
  return k?.stammdaten?.name || k?.vertrag?.signatur.name || T.wert(l.name) || l.id;
}

async function paarAendern(von: string, key: string, aendern: (m: MatchMeta) => string | void): Promise<void> {
  await mutateZustand(von, (z) => {
    const m: MatchMeta = z.paare[key] ? { ...z.paare[key] } : { status: "vorschlag" };
    const was = aendern(m);
    if (!was) return;
    m.geaendert = { am: jetzt(), von };
    z.paare[key] = m;
    return { was, ref: key };
  });
}

// ---------------------------------------------------------------------------
// Anonyme Hinweise, Zustimmung, Freigabe

/** Anonymer Hinweis an eine Seite wurde gesendet; sind beide raus, gilt das Paar als „angefragt“. */
export async function hinweisVermerken(key: string, art: M.Art, rolle: M.Rolle, von: string): Promise<void> {
  const v = await aendereVorgang(key, art, (x) => {
    x.hinweise = { ...(x.hinweise ?? {}), [rolle]: jetzt() };
    M.ereignis(x, von, "hinweis", `Anonymer Hinweis an ${M.ROLLE_ARTIKEL[rolle].akk} gesendet`);
  });
  if (v.hinweise?.anbieter && v.hinweise?.suchender) {
    await paarAendern(von, key, (m) => {
      if (m.status !== "vorschlag" && m.status !== "vorgemerkt") return;
      m.status = "angefragt";
      return "Beide anonymen Hinweise gesendet → angefragt";
    });
  }
}

export async function zustimmungSetzen(key: string, art: M.Art, rolle: M.Rolle, quelle: string, erteilt: boolean): Promise<void> {
  const feld = rolle === "anbieter" ? "zustimmungAnbieter" : "zustimmungSuchender";
  await paarAendern(quelle === "kunde" ? `kunde:${rolle}` : quelle, key, (m) => {
    if (m.status === "verworfen") return;
    if (Boolean(m[feld]) === erteilt) return;
    m[feld] = erteilt ? jetzt() : null;
    m.zustimmungQuelle = { ...(m.zustimmungQuelle ?? {}), [rolle]: quelle };
    if (erteilt && m.ablehnung?.rolle === rolle) delete m.ablehnung;
    if (m.status === "vorschlag" || m.status === "vorgemerkt") m.status = "angefragt";
    return `${erteilt ? "Zustimmung" : "Zustimmung zurückgenommen"}: ${M.ROLLE_NAME[rolle]}${quelle === "kunde" ? " (im Kundenbereich)" : ""}`;
  });
  await aendereVorgang(key, art, (x) => {
    M.ereignis(x, quelle, "zustimmung", `${M.ROLLE_NAME[rolle]} ${erteilt ? "stimmt dem Kontakt zu" : "nimmt die Zustimmung zurück"}${quelle === "kunde" ? " (im Kundenbereich)" : ""}`);
  });
  if (quelle === "kunde") {
    await adminInfo(`${erteilt ? "Zustimmung zum Kontakt" : "Zustimmung zurückgenommen"}: ${M.ROLLE_NAME[rolle]} (${key})`, [
      `${rolle === "anbieter" ? "Der Anbieter" : "Der Suchende"} hat im Kundenbereich ${erteilt ? "dem Kontakt zugestimmt" : "seine Zustimmung zurückgenommen"}.`,
      "Die Freigabe ist möglich, sobald beide Seiten unterschrieben und zugestimmt haben.",
    ], verwaltungsLink(`/admin/vorgang/${key}`));
  }
}

export async function ablehnen(key: string, art: M.Art, rolle: M.Rolle, grund: string): Promise<void> {
  await paarAendern(`kunde:${rolle}`, key, (m) => {
    m.ablehnung = { rolle, am: jetzt(), ...(grund ? { grund } : {}) };
    if (rolle === "anbieter") m.zustimmungAnbieter = null;
    else m.zustimmungSuchender = null;
    return `${M.ROLLE_NAME[rolle]} hat kein Interesse gemeldet`;
  });
  await aendereVorgang(key, art, (x) => {
    M.ereignis(x, "kunde", "ablehnung", `${M.ROLLE_NAME[rolle]} meldet kein Interesse${grund ? `: ${grund}` : ""}`);
  });
  await adminInfo(`Kein Interesse: ${M.ROLLE_NAME[rolle]} (${key})`, [
    `${rolle === "anbieter" ? "Der Anbieter" : "Der Suchende"} hat im Kundenbereich „kein Interesse“ gemeldet.`,
    ...(grund ? [`Begründung: ${grund}`] : []),
    "Das Paar kann im Matching verworfen werden.",
  ], verwaltungsLink(`/admin/vorgang/${key}`));
}

export type Pruefpunkt = { ok: boolean; text: string };

export function freigabePruefung(ctx: VorgangKontext, jetztD = new Date()): { bereit: boolean; punkte: Pruefpunkt[] } {
  const a = M.freigabeBereit(ctx.anbieter, jetztD);
  const s = M.freigabeBereit(ctx.suchender, jetztD);
  const status = ctx.meta?.status ?? "vorschlag";
  const punkte: Pruefpunkt[] = [
    { ok: a.bereit, text: a.bereit ? "Anbieter hat unterschrieben" : `Anbieter: ${a.grund}` },
    { ok: s.bereit, text: s.bereit ? "Suchender hat unterschrieben (Widerrufsfrist geklärt)" : `Suchender: ${s.grund}` },
    { ok: Boolean(ctx.meta?.zustimmungAnbieter), text: ctx.meta?.zustimmungAnbieter ? `Anbieter stimmt dem Kontakt zu (${T.datumDe(ctx.meta.zustimmungAnbieter)})` : "Zustimmung des Anbieters zu diesem Kontakt fehlt" },
    { ok: Boolean(ctx.meta?.zustimmungSuchender), text: ctx.meta?.zustimmungSuchender ? `Suchender stimmt dem Kontakt zu (${T.datumDe(ctx.meta.zustimmungSuchender)})` : "Zustimmung des Suchenden zu diesem Kontakt fehlt" },
    { ok: status !== "verworfen", text: status === "verworfen" ? "Paar ist verworfen" : "Paar ist aktiv" },
  ];
  return { bereit: punkte.every((x) => x.ok), punkte };
}

export async function freigeben(key: string, von: string): Promise<{ ok: boolean; fehler?: string }> {
  const ctx = await ladeVorgangKontext(key);
  if (!ctx) return { ok: false, fehler: "Vorgang nicht gefunden" };
  if (M.aktiveFreigabe(ctx.vorgang)) return { ok: true };
  const pr = freigabePruefung(ctx);
  if (!pr.bereit) return { ok: false, fehler: pr.punkte.filter((x) => !x.ok).map((x) => x.text).join(" · ") };
  await paarAendern(von, key, (m) => {
    m.status = "kontakt";
    return "Kontakt freigegeben — Kontaktdaten im Kundenbereich sichtbar";
  });
  await aendereVorgang(key, ctx.art, (x) => {
    x.freigabe = { am: jetzt(), von };
    M.ereignis(x, von, "freigabe", "Kontakt freigegeben: beide Seiten sehen jetzt Namen, Kontaktdaten und Flächenangaben");
  });
  for (const k of [ctx.anbieter, ctx.suchender]) {
    if (!k) continue;
    await aendereKunde(k.id, (x) => {
      M.ereignis(x, von, "freigabe", `Kontakt freigegeben (Vorgang ${key})`);
    });
  }
  await adminInfo(`Freigabe erteilt: ${kundenName(ctx.anbieter, ctx.angebot)} ↔ ${kundenName(ctx.suchender, ctx.gesuch)}`, [
    `Vorgang ${key}: Die Kontaktdaten sind freigegeben (durch ${von}).`,
    "Beide Seiten sehen sie im Kundenbereich. Die Freigabe-Mitteilungen können im Vorgang gesendet werden.",
  ], verwaltungsLink(`/admin/vorgang/${key}`));
  return { ok: true };
}

export async function freigabeZurueckziehen(key: string, von: string, grund: string): Promise<void> {
  const v = await ladeVorgang(key);
  // Nach einem Abschluss bleibt die Freigabe bestehen — beide Seiten brauchen Zugriff auf ihren Vertrag.
  if (!v || !M.aktiveFreigabe(v) || v.abschluss) return;
  await aendereVorgang(key, v.art, (x) => {
    if (!x.freigabe || x.freigabe.zurueckgezogen) return false;
    x.freigabe.zurueckgezogen = { am: jetzt(), von, grund };
    M.ereignis(x, von, "freigabe-zurueck", `Freigabe zurückgezogen${grund ? `: ${grund}` : ""} — Kontaktdaten wieder verborgen (der Nachweis bleibt bestehen)`);
  });
  await paarAendern(von, key, (m) => {
    if (m.status !== "kontakt") return;
    m.status = "angefragt";
    return "Freigabe zurückgezogen";
  });
}

// ---------------------------------------------------------------------------
// Pachtvertrag

export function pachtVorschlag(ctx: VorgangKontext): M.PachtDaten {
  const a = ctx.anbieter;
  const s = ctx.suchender;
  const flaechen: M.Flaeche[] = a?.flaechen?.length
    ? a.flaechen.map((f) => ({ ...f }))
    : [{ gemarkung: T.wert(ctx.angebot.ort), flur: "", flurstueck: T.wert(ctx.angebot.flurstueck), groesseHa: ctx.angebot.groesseWert.maxHa ?? ctx.angebot.groesseWert.minHa, nutzung: ctx.angebot.typ }];
  const heute = new Date();
  const beginn = new Date(Date.UTC(heute.getUTCFullYear() + (heute.getUTCMonth() >= 9 ? 1 : 0), 9, 1));
  return {
    verpaechter: { name: kundenName(a, ctx.angebot), anschrift: T.anschrift(a?.stammdaten) },
    paechter: { name: kundenName(s, ctx.gesuch), anschrift: T.anschrift(s?.stammdaten), betrieb: s?.stammdaten?.betrieb ?? "" },
    flaechen,
    nutzungsart: ctx.angebot.typ === "Wiese / Grünland" ? "Grünland" : ctx.angebot.typ,
    pachtBeginn: beginn.toISOString().slice(0, 10),
    laufzeitJahre: 10,
    pachtjahr: "wirtschaftsjahr",
    pachtzinsJeHa: null,
    pachtzinsJahr: null,
    staffel: [],
    zahlweise: "jaehrlich",
    faelligkeit: "jeweils im Voraus zum 1. Oktober",
    umsatzsteuer: "ohne",
    kontoinhaber: "",
    iban: "",
    wasserverband: "verpaechter",
    verpflichtungen: "",
    besonderes: "",
  };
}

function addJahre(ymd: string, jahre: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const ende = new Date(Date.UTC(y + jahre, m - 1, d - 1));
  return ende.toISOString().slice(0, 10);
}

export function pachtVorlagenDaten(key: string, d: M.PachtDaten): PachtvertragDaten {
  const ha = M.summeHa(d.flaechen);
  const jp = M.jahrespacht(d);
  const befristet = Boolean(d.laufzeitJahre && d.laufzeitJahre > 0);
  const zins =
    d.pachtzinsJahr != null && d.pachtzinsJahr > 0
      ? `${M.euro(d.pachtzinsJahr)} je Pachtjahr${ha ? ` (entspricht ${M.euro(M.runde2(d.pachtzinsJahr / ha))} je Hektar)` : ""}`
      : d.pachtzinsJeHa != null
        ? `${M.euro(d.pachtzinsJeHa)} je Hektar und Pachtjahr${ha ? ` bei ${T.haText(ha)}` : ""}`
        : "«noch offen»";
  const staffel = (d.staffel ?? [])
    .slice()
    .sort((x, y) => x.pachtjahr - y.pachtjahr)
    .map((s) => `im ${s.pachtjahr}. Pachtjahr ${M.euro(s.betrag)}`)
    .join("; ");
  return {
    vorgang: key,
    verpaechter: { name: d.verpaechter.name || "«Verpächter»", anschrift: d.verpaechter.anschrift || "«Anschrift»" },
    paechter: { name: d.paechter.name || "«Pächter»", anschrift: d.paechter.anschrift || "«Anschrift»", betrieb: d.paechter.betrieb },
    flaechen: d.flaechen.map(T.flaecheText),
    gesamtFlaeche: T.haText(ha),
    nutzungsart: d.nutzungsart || "landwirtschaftliche Nutzung",
    pachtBeginn: T.tagDe(d.pachtBeginn),
    befristet,
    laufzeit: befristet ? `${d.laufzeitJahre} ${d.laufzeitJahre === 1 ? "Pachtjahr" : "Pachtjahre"}` : "unbestimmte Zeit",
    pachtEnde: befristet && d.pachtBeginn ? T.tagDe(addJahre(d.pachtBeginn, d.laufzeitJahre!)) : "",
    pachtjahr: d.pachtjahr === "kalenderjahr" ? "das Kalenderjahr" : "der Zeitraum vom 1. Oktober bis zum 30. September (Wirtschaftsjahr)",
    pachtzins: zins,
    jahrespacht: jp != null ? M.euro(jp) : "«noch offen»",
    staffel: staffel ? `${staffel} (übrige Pachtjahre wie oben)` : "",
    zahlweise: `${d.zahlweise === "halbjaehrlich" ? "in zwei gleichen Raten" : "jährlich"} ${d.faelligkeit || "nach Vereinbarung"}`.trim(),
    umsatzsteuer: d.umsatzsteuer,
    konto: d.iban ? `${d.kontoinhaber ? `${d.kontoinhaber}, ` : ""}IBAN ${d.iban}` : "",
    wasserverband: d.wasserverband,
    verpflichtungen: d.verpflichtungen,
    besonderes: d.besonderes,
    anzeigeStelle: PACHTANZEIGE_STELLE,
  };
}

export function pachtDokument(key: string, d: M.PachtDaten): Dokument {
  return VORLAGEN.pachtvertrag.render(pachtVorlagenDaten(key, d));
}

export function pachtHash(key: string, d: M.PachtDaten): string {
  return dokumentHash(pachtDokument(key, d));
}

/** Was fehlt, bevor der Pachtvertrag zur Unterschrift gehen kann? */
export function pachtLuecken(d: M.PachtDaten): string[] {
  const l: string[] = [];
  if (!d.verpaechter.name || !d.verpaechter.anschrift) l.push("Name und Anschrift des Verpächters");
  if (!d.paechter.name || !d.paechter.anschrift) l.push("Name und Anschrift des Pächters");
  if (d.flaechen.length === 0 || d.flaechen.some((f) => !f.gemarkung || !f.flurstueck || f.groesseHa == null)) l.push("Flächen mit Gemarkung, Flurstück und Größe");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.pachtBeginn)) l.push("Pachtbeginn");
  if (M.jahrespacht(d) == null) l.push("Pachtzins (je ha oder je Jahr)");
  return l;
}

export async function pachtSpeichern(key: string, art: M.Art, daten: M.PachtDaten, von: string): Promise<{ ok: boolean; fehler?: string }> {
  let fehler = "";
  await aendereVorgang(key, art, (x) => {
    if (x.pachtvertrag && x.pachtvertrag.status !== "entwurf" && x.pachtvertrag.status !== "verworfen") {
      fehler = "Der Pachtvertrag ist bereits zur Unterschrift freigegeben — erst „Zurück zum Entwurf“ wählen.";
      return false;
    }
    const neu = !x.pachtvertrag || x.pachtvertrag.status === "verworfen";
    x.pachtvertrag = {
      status: "entwurf",
      daten,
      erstelltAm: neu ? jetzt() : x.pachtvertrag!.erstelltAm,
      von,
      geaendertAm: jetzt(),
      unterschriften: {},
    };
    M.ereignis(x, von, "pacht-entwurf", neu ? "Pachtvertrag vorbereitet (Entwurf)" : "Pachtvertrag-Entwurf geändert");
  });
  return fehler ? { ok: false, fehler } : { ok: true };
}

const WIDERRUFEN_FEHLER = "Eine Seite hat ihren Vertrag mit Lippe Forst widerrufen — über die Plattform wird nichts mehr zur Unterschrift vorgelegt.";

async function parteiWiderrufen(key: string): Promise<boolean> {
  const [aId, gId] = key.split("~");
  const [a, g] = await Promise.all([ladeKunde(aId), ladeKunde(gId)]);
  return Boolean(a?.widerruf || g?.widerruf);
}

export async function pachtZurUnterschrift(key: string, von: string): Promise<{ ok: boolean; fehler?: string }> {
  const [v, e] = await Promise.all([ladeVorgang(key), ladeEinstellungen()]);
  if (!v?.pachtvertrag || v.pachtvertrag.status !== "entwurf") return { ok: false, fehler: "Kein Entwurf vorhanden." };
  if (!M.aktiveFreigabe(v)) return { ok: false, fehler: "Erst nach der Freigabe möglich." };
  if (await parteiWiderrufen(key)) return { ok: false, fehler: WIDERRUFEN_FEHLER };
  if (!istFreigegeben(e, "pachtvertrag")) return { ok: false, fehler: "Die Vorlage „Landpachtvertrag“ ist nicht freigegeben (Verwaltung → Vorlagen)." };
  const luecken = pachtLuecken(v.pachtvertrag.daten);
  if (luecken.length) return { ok: false, fehler: `Es fehlen: ${luecken.join(", ")}.` };
  const hash = pachtHash(key, v.pachtvertrag.daten);
  await aendereVorgang(key, v.art, (x) => {
    if (!x.pachtvertrag || x.pachtvertrag.status !== "entwurf") return false;
    x.pachtvertrag.status = "zur_unterschrift";
    x.pachtvertrag.textHash = hash;
    x.pachtvertrag.unterschriften = {};
    x.pachtvertrag.geaendertAm = jetzt();
    M.ereignis(x, von, "pacht-zur-unterschrift", "Pachtvertrag zur Unterschrift freigegeben — beide Seiten sehen ihn im Kundenbereich");
  });
  return { ok: true };
}

export async function pachtZurueck(key: string, von: string, verwerfen: boolean): Promise<void> {
  const v = await ladeVorgang(key);
  if (!v?.pachtvertrag || v.pachtvertrag.status === "abgeschlossen") return;
  await aendereVorgang(key, v.art, (x) => {
    if (!x.pachtvertrag || x.pachtvertrag.status === "abgeschlossen") return false;
    const hatteUnterschrift = Boolean(x.pachtvertrag.unterschriften.verpaechter || x.pachtvertrag.unterschriften.paechter);
    x.pachtvertrag.status = verwerfen ? "verworfen" : "entwurf";
    x.pachtvertrag.unterschriften = {};
    delete x.pachtvertrag.textHash;
    x.pachtvertrag.geaendertAm = jetzt();
    M.ereignis(x, von, verwerfen ? "pacht-verworfen" : "pacht-entwurf", `${verwerfen ? "Pachtvertrag verworfen" : "Pachtvertrag zurück zum Entwurf"}${hatteUnterschrift ? " — bereits geleistete Unterschriften sind damit ungültig" : ""}`);
  });
}

export async function pachtUnterschreiben(opts: {
  key: string;
  rolle: M.Rolle;
  kunde: M.KundeRecord;
  name: string;
  textHash: string;
  erklaerungen: { id: string; text: string }[];
  herkunft: { ip: string; userAgent: string; sitzung: string };
}): Promise<{ ok: boolean; fehler?: string; abgeschlossen?: boolean }> {
  const v = await ladeVorgang(opts.key);
  const pv = v?.pachtvertrag;
  if (!v || !pv || pv.status !== "zur_unterschrift" || !pv.textHash) return { ok: false, fehler: "Der Pachtvertrag liegt nicht zur Unterschrift vor." };
  if (!M.aktiveFreigabe(v) || (await parteiWiderrufen(opts.key))) {
    return { ok: false, fehler: "Der Pachtvertrag kann über Lippe Forst derzeit nicht unterschrieben werden. Bitte sprechen Sie uns an." };
  }
  if (pachtHash(opts.key, pv.daten) !== pv.textHash || opts.textHash !== pv.textHash) {
    return { ok: false, fehler: "Der Vertragstext hat sich geändert. Bitte die Seite neu laden und den Text erneut prüfen." };
  }
  const feld = opts.rolle === "anbieter" ? "verpaechter" : "paechter";
  const signatur: M.Signatur = {
    name: opts.name,
    email: opts.kunde.email,
    am: jetzt(),
    ip: opts.herkunft.ip,
    userAgent: opts.herkunft.userAgent,
    textHash: pv.textHash,
    vorlageId: "pachtvertrag",
    vorlageVersion: VORLAGEN.pachtvertrag.version,
    erklaerungen: opts.erklaerungen,
    sitzung: opts.herkunft.sitzung,
  };
  let schliesseAb = false;
  let schonDa = false;
  const reserviert = M.kurzId("DOK");
  await aendereVorgang(opts.key, v.art, (x) => {
    const p = x.pachtvertrag;
    if (!p || p.status !== "zur_unterschrift" || p.textHash !== signatur.textHash) return false;
    if (p.unterschriften[feld]) {
      schonDa = true;
      return false;
    }
    p.unterschriften[feld] = signatur;
    M.ereignis(x, "kunde", "pacht-unterschrift", `Pachtvertrag unterschrieben als ${feld === "verpaechter" ? "Verpächter" : "Pächter"}: „${opts.name}“`);
    if (p.unterschriften.verpaechter && p.unterschriften.paechter) {
      p.status = "abgeschlossen";
      p.abgeschlossenAm = jetzt();
      p.dokumentId = reserviert;
      x.abschluss = { am: p.abgeschlossenAm, grundlage: "pachtvertrag" };
      schliesseAb = true;
    }
  });
  if (schonDa) return { ok: false, fehler: "Sie haben bereits unterschrieben." };
  await aendereKunde(opts.kunde.id, (k) => {
    M.ereignis(k, "kunde", "pacht-unterschrift", `Pachtvertrag unterschrieben (Vorgang ${opts.key})`);
  });
  if (!schliesseAb) {
    await adminInfo(`Pachtvertrag: ${opts.rolle === "anbieter" ? "Verpächter" : "Pächter"} hat unterschrieben (${opts.key})`, [
      `„${opts.name}“ hat den Pachtvertrag online unterschrieben. Die Unterschrift der anderen Seite steht noch aus.`,
    ], verwaltungsLink(`/admin/vorgang/${opts.key}`));
    return { ok: true, abgeschlossen: false };
  }
  await pachtAbschliessen(opts.key, reserviert);
  return { ok: true, abgeschlossen: true };
}

/** Nach der zweiten Unterschrift: PDF, Ablage, Provision, Gutschein, Mails. Auch zur Reparatur nutzbar. */
export async function pachtAbschliessen(key: string, dokumentId: string): Promise<void> {
  const ctx = await ladeVorgangKontext(key);
  const pv = ctx?.vorgang?.pachtvertrag;
  if (!ctx || !ctx.vorgang || !pv || pv.status !== "abgeschlossen") return;
  if (ctx.vorgang.dokumente.some((d) => d.id === dokumentId)) return;
  const dok = pachtDokument(key, pv.daten);
  const { meta, bytes } = await pdfAblegen({
    eigentuemer: { typ: "vorgang", key },
    art: "pachtvertrag",
    titel: "Landpachtvertrag",
    dateiname: `landpachtvertrag-${key.replace("~", "-")}.pdf`,
    teile: [
      { dok },
      {
        dok: protokollDokument(dokumentId, [
          { rolle: `Verpächter: ${pv.unterschriften.verpaechter!.name}`, s: pv.unterschriften.verpaechter! },
          { rolle: `Pächter: ${pv.unterschriften.paechter!.name}`, s: pv.unterschriften.paechter! },
        ]),
        neueSeite: true,
      },
    ],
    fusszeile: `Vorlage pachtvertrag v${VORLAGEN.pachtvertrag.version} · SHA-256 Vertragstext ${pv.textHash?.slice(0, 16)}…`,
    sichtbarFuer: ["anbieter", "suchender"],
    von: "system",
    version: VORLAGEN.pachtvertrag.version,
    dokumentId,
  });
  const bemessung = M.massgeblicheJahrespacht(pv.daten);
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  const provision = provisionNeu("pachtvertrag", "pacht", bemessung, konditionen, "faellig", "system", konditionen ? undefined : "Kein unterschriebener Nachweisvertrag des Suchenden gefunden — Anspruch prüfen.");
  const e = await ladeEinstellungen();
  const gutschein = gutscheinNeu(e, ctx.suchender, "system");
  await aendereVorgang(key, ctx.art, (x) => {
    if (x.dokumente.some((d) => d.id === dokumentId)) return false;
    x.dokumente.unshift(meta);
    x.provisionen.unshift(provision);
    if (gutschein && !x.gutschein) x.gutschein = gutschein;
    M.ereignis(x, "system", "pacht-abgeschlossen", "Pachtvertrag von beiden Seiten unterschrieben — abgeschlossen, PDF abgelegt");
    M.ereignis(x, "system", "provision", `Provision fällig: ${M.euro(provision.netto)} netto / ${M.euro(provision.brutto)} brutto (Bemessung: Jahrespacht ${M.euro(bemessung)})`);
    if (gutschein && x.gutschein?.code === gutschein.code) M.ereignis(x, "system", "gutschein", `Treue-Gutschein ${gutschein.code} über ${M.euro(gutschein.betrag)} an den Pächter ausgegeben`);
  });
  await paarAendern("system", key, (m) => {
    m.status = "abschluss";
    return "Pachtvertrag geschlossen — Provision erfasst";
  });
  await abschlussMails(ctx, "pachtvertrag", { dateiname: meta.dateiname, inhalt: bytes }, gutschein);
  await adminInfo(`Provision fällig: Pachtvertrag ${kundenName(ctx.anbieter, ctx.angebot)} ↔ ${kundenName(ctx.suchender, ctx.gesuch)}`, [
    `Der Pachtvertrag im Vorgang ${key} ist von beiden Seiten unterschrieben.`,
    `Maßgebliche Jahrespacht: ${M.euro(bemessung)}`,
    `Provision (Konditionen Nr. ${konditionen?.version ?? "?"}): ${M.euro(provision.netto)} netto, ${M.euro(provision.brutto)} brutto — Schuldner: Pächter ${kundenName(ctx.suchender, ctx.gesuch)}`,
    "Rechnung bitte über die Buchhaltung stellen (hier wird keine Rechnungsnummer vergeben).",
    ...(gutschein ? [`Treue-Gutschein ${gutschein.code} (${M.euro(gutschein.betrag)}) an den Pächter ausgegeben.`] : []),
    "Erinnerung: Der Verpächter muss den Vertrag binnen eines Monats nach § 2 LPachtVG anzeigen.",
  ], verwaltungsLink(`/admin/vorgang/${key}`));
}

// ---------------------------------------------------------------------------
// Kauf: Kaufabsicht (unverbindlich), Beurkundung, Wirksamkeit

export function kaufVorschlag(ctx: VorgangKontext): M.KaufDaten {
  const a = ctx.anbieter;
  const s = ctx.suchender;
  return {
    verkaeufer: { name: kundenName(a, ctx.angebot), anschrift: T.anschrift(a?.stammdaten) },
    kaeufer: { name: kundenName(s, ctx.gesuch), anschrift: T.anschrift(s?.stammdaten), betrieb: s?.stammdaten?.betrieb ?? "" },
    flaechen: a?.flaechen?.length
      ? a.flaechen.map((f) => ({ ...f }))
      : [{ gemarkung: T.wert(ctx.angebot.ort), flur: "", flurstueck: T.wert(ctx.angebot.flurstueck), groesseHa: ctx.angebot.groesseWert.maxHa ?? ctx.angebot.groesseWert.minHa, nutzung: ctx.angebot.typ }],
    kaufpreis: null,
    uebergabe: "",
    bestehendePacht: "",
    notarWunsch: "",
    besonderes: "",
  };
}

export function kaufVorlagenDaten(key: string, d: M.KaufDaten, konditionen: M.Konditionen | null): KaufabsichtDaten {
  return {
    vorgang: key,
    verkaeufer: { name: d.verkaeufer.name || "«Verkäufer»", anschrift: d.verkaeufer.anschrift || "«Anschrift»" },
    kaeufer: { name: d.kaeufer.name || "«Käufer»", anschrift: d.kaeufer.anschrift || "«Anschrift»", betrieb: d.kaeufer.betrieb },
    flaechen: d.flaechen.map(T.flaecheText),
    gesamtFlaeche: T.flaechenSumme(d.flaechen),
    kaufpreis: d.kaufpreis != null ? M.euro(d.kaufpreis) : "«noch offen»",
    uebergabe: d.uebergabe,
    bestehendePacht: d.bestehendePacht,
    notarWunsch: d.notarWunsch,
    besonderes: d.besonderes,
    provisionKaeufer: konditionen ? M.konditionenText("kauf", konditionen) : "laut Nachweisvertrag",
    genehmigungStelle: GRDSTVG_STELLE,
  };
}

export function kaufDokument(key: string, d: M.KaufDaten, konditionen: M.Konditionen | null): Dokument {
  return VORLAGEN.kaufabsicht.render(kaufVorlagenDaten(key, d, konditionen));
}

export async function kaufSpeichern(key: string, daten: M.KaufDaten, von: string): Promise<{ ok: boolean; fehler?: string }> {
  let fehler = "";
  await aendereVorgang(key, "kauf", (x) => {
    if (x.kauf && x.kauf.status !== "entwurf" && x.kauf.status !== "abgebrochen") {
      fehler = "Die Kaufabsicht liegt bereits zur Bestätigung vor — erst „Zurück zum Entwurf“ wählen.";
      return false;
    }
    const neu = !x.kauf || x.kauf.status === "abgebrochen";
    x.kauf = {
      status: "entwurf",
      daten,
      erstelltAm: neu ? jetzt() : x.kauf!.erstelltAm,
      von,
      geaendertAm: jetzt(),
      bestaetigungen: {},
      notar: x.kauf?.notar ?? {},
    };
    M.ereignis(x, von, "kauf-entwurf", neu ? "Kaufabsicht vorbereitet (Entwurf)" : "Kaufabsicht geändert");
  });
  return fehler ? { ok: false, fehler } : { ok: true };
}

export async function kaufZurBestaetigung(key: string, von: string): Promise<{ ok: boolean; fehler?: string }> {
  const [ctx, e] = await Promise.all([ladeVorgangKontext(key), ladeEinstellungen()]);
  const k = ctx?.vorgang?.kauf;
  if (!ctx || !k || k.status !== "entwurf") return { ok: false, fehler: "Kein Entwurf vorhanden." };
  if (!M.aktiveFreigabe(ctx.vorgang)) return { ok: false, fehler: "Erst nach der Freigabe möglich." };
  if (ctx.anbieter?.widerruf || ctx.suchender?.widerruf) return { ok: false, fehler: WIDERRUFEN_FEHLER };
  if (!istFreigegeben(e, "kaufabsicht")) return { ok: false, fehler: "Die Vorlage „Kaufabsicht“ ist nicht freigegeben (Verwaltung → Vorlagen)." };
  const hash = dokumentHash(kaufDokument(key, k.daten, ctx.suchender?.vertrag?.konditionen ?? null));
  await aendereVorgang(key, "kauf", (x) => {
    if (!x.kauf || x.kauf.status !== "entwurf") return false;
    x.kauf.status = "zur_bestaetigung";
    x.kauf.textHash = hash;
    x.kauf.bestaetigungen = {};
    x.kauf.geaendertAm = jetzt();
    M.ereignis(x, von, "kauf-zur-bestaetigung", "Kaufabsicht beiden Seiten zur Bestätigung vorgelegt");
  });
  return { ok: true };
}

export async function kaufZurueck(key: string, von: string): Promise<void> {
  await aendereVorgang(key, "kauf", (x) => {
    if (!x.kauf || !["zur_bestaetigung", "bestaetigt"].includes(x.kauf.status)) return false;
    x.kauf.status = "entwurf";
    x.kauf.bestaetigungen = {};
    delete x.kauf.textHash;
    x.kauf.geaendertAm = jetzt();
    M.ereignis(x, von, "kauf-entwurf", "Kaufabsicht zurück zum Entwurf — Bestätigungen verworfen");
  });
}

export async function kaufBestaetigen(opts: {
  key: string;
  rolle: M.Rolle;
  kunde: M.KundeRecord;
  name: string;
  textHash: string;
  erklaerungen: { id: string; text: string }[];
  herkunft: { ip: string; userAgent: string; sitzung: string };
}): Promise<{ ok: boolean; fehler?: string }> {
  const ctx = await ladeVorgangKontext(opts.key);
  const k = ctx?.vorgang?.kauf;
  if (!ctx || !k || k.status !== "zur_bestaetigung" || !k.textHash) return { ok: false, fehler: "Die Kaufabsicht liegt nicht zur Bestätigung vor." };
  if (!M.aktiveFreigabe(ctx.vorgang) || ctx.anbieter?.widerruf || ctx.suchender?.widerruf) {
    return { ok: false, fehler: "Die Eckdaten können über Lippe Forst derzeit nicht bestätigt werden. Bitte sprechen Sie uns an." };
  }
  const aktuell = dokumentHash(kaufDokument(opts.key, k.daten, ctx.suchender?.vertrag?.konditionen ?? null));
  if (aktuell !== k.textHash || opts.textHash !== k.textHash) return { ok: false, fehler: "Der Text hat sich geändert. Bitte die Seite neu laden." };
  const feld = opts.rolle === "anbieter" ? "verkaeufer" : "kaeufer";
  const signatur: M.Signatur = {
    name: opts.name,
    email: opts.kunde.email,
    am: jetzt(),
    ip: opts.herkunft.ip,
    userAgent: opts.herkunft.userAgent,
    textHash: k.textHash,
    vorlageId: "kaufabsicht",
    vorlageVersion: VORLAGEN.kaufabsicht.version,
    erklaerungen: opts.erklaerungen,
    sitzung: opts.herkunft.sitzung,
  };
  let beide = false;
  const reserviert = M.kurzId("DOK");
  await aendereVorgang(opts.key, "kauf", (x) => {
    const kk = x.kauf;
    if (!kk || kk.status !== "zur_bestaetigung" || kk.bestaetigungen[feld]) return false;
    kk.bestaetigungen[feld] = signatur;
    M.ereignis(x, "kunde", "kauf-bestaetigt", `Kaufabsicht bestätigt als ${feld === "verkaeufer" ? "Verkäufer" : "Käufer"}: „${opts.name}“`);
    if (kk.bestaetigungen.verkaeufer && kk.bestaetigungen.kaeufer) {
      kk.status = "bestaetigt";
      kk.dokumentId = reserviert;
      beide = true;
    }
  });
  if (beide) {
    const frisch = await ladeVorgang(opts.key);
    const kk = frisch?.kauf;
    if (kk) {
      const dok = kaufDokument(opts.key, kk.daten, ctx.suchender?.vertrag?.konditionen ?? null);
      const { meta } = await pdfAblegen({
        eigentuemer: { typ: "vorgang", key: opts.key },
        art: "kaufabsicht",
        titel: "Kaufabsicht und Eckdaten für den Notar",
        dateiname: `kaufabsicht-${opts.key.replace("~", "-")}.pdf`,
        teile: [
          { dok },
          {
            dok: protokollDokument(reserviert, [
              { rolle: `Verkäufer: ${kk.bestaetigungen.verkaeufer!.name}`, s: kk.bestaetigungen.verkaeufer! },
              { rolle: `Käufer: ${kk.bestaetigungen.kaeufer!.name}`, s: kk.bestaetigungen.kaeufer! },
            ]),
            neueSeite: true,
          },
        ],
        fusszeile: `Vorlage kaufabsicht v${VORLAGEN.kaufabsicht.version} · unverbindlich · SHA-256 ${kk.textHash?.slice(0, 16)}…`,
        sichtbarFuer: ["anbieter", "suchender"],
        von: "system",
        version: VORLAGEN.kaufabsicht.version,
        dokumentId: reserviert,
      });
      await aendereVorgang(opts.key, "kauf", (x) => {
        if (x.dokumente.some((d) => d.id === meta.id)) return false;
        x.dokumente.unshift(meta);
        M.ereignis(x, "system", "kauf-bestaetigt", "Kaufabsicht von beiden Seiten bestätigt — PDF für den Notar abgelegt");
      });
    }
  }
  await adminInfo(`Kaufabsicht bestätigt${beide ? " (beide Seiten)" : ""}: ${opts.key}`, [
    `„${opts.name}“ hat die Eckdaten als ${feld === "verkaeufer" ? "Verkäufer" : "Käufer"} bestätigt.`,
    beide ? "Beide Seiten haben bestätigt — die Eckdaten können an den Notar." : "Die Bestätigung der anderen Seite steht noch aus.",
  ], verwaltungsLink(`/admin/vorgang/${opts.key}`));
  return { ok: true };
}

export async function kaufNotarSpeichern(key: string, von: string, notar: { name: string; termin: string }): Promise<void> {
  await aendereVorgang(key, "kauf", (x) => {
    if (!x.kauf) return false;
    x.kauf.notar = { ...x.kauf.notar, name: notar.name || undefined, termin: notar.termin || undefined };
    M.ereignis(x, von, "kauf-notar", `Notar: ${notar.name || "—"}${notar.termin ? `, Termin ${T.tagDe(notar.termin)}` : ""}`);
  });
}

export async function kaufBeurkundet(
  key: string,
  von: string,
  daten: { datum: string; kaufpreis: number; genehmigung: "offen" | "nicht_noetig" | "beantragt" | "erteilt" },
): Promise<{ ok: boolean; fehler?: string }> {
  const [ctx, e] = await Promise.all([ladeVorgangKontext(key), ladeEinstellungen()]);
  if (!ctx?.vorgang) return { ok: false, fehler: "Vorgang nicht gefunden" };
  if (ctx.vorgang.provisionen.some((p) => p.grundlage === "kaufvertrag" && p.status !== "storniert")) return { ok: false, fehler: "Beurkundung ist bereits erfasst." };
  const wirksam = daten.genehmigung === "nicht_noetig" || daten.genehmigung === "erteilt";
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  const provision = provisionNeu("kaufvertrag", "kauf", daten.kaufpreis, konditionen, wirksam ? "faellig" : "aufschiebend", von, konditionen ? undefined : "Kein unterschriebener Nachweisvertrag des Käufers gefunden — Anspruch prüfen.");
  const gutschein = gutscheinNeu(e, ctx.suchender, von);
  await aendereVorgang(key, "kauf", (x) => {
    x.kauf ??= { status: "entwurf", daten: kaufVorschlag(ctx), erstelltAm: jetzt(), von, geaendertAm: jetzt(), bestaetigungen: {}, notar: {} };
    x.kauf.status = wirksam ? "wirksam" : "beurkundet";
    x.kauf.notar = { ...x.kauf.notar, beurkundetAm: daten.datum, kaufpreis: daten.kaufpreis, genehmigung: daten.genehmigung, ...(wirksam ? { wirksamAm: daten.datum } : {}) };
    x.kauf.geaendertAm = jetzt();
    x.abschluss = { am: jetzt(), grundlage: "kaufvertrag" };
    x.provisionen.unshift(provision);
    if (gutschein && !x.gutschein) x.gutschein = gutschein;
    M.ereignis(x, von, "kauf-beurkundet", `Kaufvertrag beurkundet am ${T.tagDe(daten.datum)}, Kaufpreis ${M.euro(daten.kaufpreis)}${wirksam ? " — wirksam" : " — Genehmigung ausstehend"}`);
    M.ereignis(x, von, "provision", `Provision ${wirksam ? "fällig" : "entstanden (aufschiebend bis zur Genehmigung)"}: ${M.euro(provision.netto)} netto / ${M.euro(provision.brutto)} brutto`);
    if (gutschein && x.gutschein?.code === gutschein.code) M.ereignis(x, von, "gutschein", `Treue-Gutschein ${gutschein.code} über ${M.euro(gutschein.betrag)} an den Käufer ausgegeben`);
  });
  await paarAendern(von, key, (m) => {
    m.status = "abschluss";
    return "Kaufvertrag beurkundet — Provision erfasst";
  });
  await abschlussMails(ctx, "kaufvertrag", null, gutschein);
  await adminInfo(`${wirksam ? "Provision fällig" : "Provision entstanden (aufschiebend)"}: Kauf ${key}`, [
    `Kaufvertrag beurkundet am ${T.tagDe(daten.datum)}, Kaufpreis ${M.euro(daten.kaufpreis)}.`,
    `Provision (Konditionen Nr. ${konditionen?.version ?? "?"}): ${M.euro(provision.netto)} netto, ${M.euro(provision.brutto)} brutto — Schuldner: Käufer.`,
    wirksam ? "Rechnung bitte über die Buchhaltung stellen." : "Fällig erst mit Wirksamkeit (Genehmigung nach GrdstVG) — bitte dann „Kauf wirksam“ erfassen.",
  ], verwaltungsLink(`/admin/vorgang/${key}`));
  return { ok: true };
}

export async function kaufWirksam(key: string, von: string, datum: string): Promise<void> {
  await aendereVorgang(key, "kauf", (x) => {
    if (!x.kauf) return false;
    x.kauf.status = "wirksam";
    x.kauf.notar = { ...x.kauf.notar, genehmigung: "erteilt", wirksamAm: datum };
    for (const p of x.provisionen) {
      if (p.grundlage === "kaufvertrag" && p.status === "aufschiebend") {
        p.status = "faellig";
        p.faelligAm = jetzt();
        p.verlauf.unshift({ am: jetzt(), von, was: `Kaufvertrag wirksam am ${T.tagDe(datum)} → fällig` });
      }
    }
    M.ereignis(x, von, "kauf-wirksam", `Kaufvertrag wirksam (Genehmigung erteilt) am ${T.tagDe(datum)} — Provision fällig`);
  });
  await adminInfo(`Provision fällig: Kauf ${key} ist wirksam`, [`Der Kaufvertrag ist seit ${T.tagDe(datum)} wirksam. Rechnung bitte über die Buchhaltung stellen.`], verwaltungsLink(`/admin/vorgang/${key}`));
}

export async function kaufAbbrechen(key: string, von: string, grund: string): Promise<void> {
  await aendereVorgang(key, "kauf", (x) => {
    if (!x.kauf) return false;
    x.kauf.status = "abgebrochen";
    for (const p of x.provisionen) {
      if (p.grundlage === "kaufvertrag" && (p.status === "aufschiebend" || p.status === "faellig")) {
        p.status = "storniert";
        p.verlauf.unshift({ am: jetzt(), von, was: `Storniert: ${grund || "Kauf abgebrochen"}` });
      }
    }
    M.ereignis(x, von, "kauf-abgebrochen", `Kauf abgebrochen${grund ? `: ${grund}` : ""}`);
  });
}

// ---------------------------------------------------------------------------
// Außerhalb geschlossene Verträge, Provision, Gutschein

function provisionNeu(
  grundlage: M.Provision["grundlage"],
  art: M.Art,
  bemessung: number | null,
  konditionen: M.VertragsKonditionen | null,
  status: M.ProvisionStatus,
  von: string,
  notiz?: string,
): M.Provision {
  const k = konditionen ?? { ...M.STANDARD_KONDITIONEN, version: 0 };
  const b = M.provisionBerechnen(art, bemessung, k);
  return {
    id: M.kurzId("PRV"),
    grundlage,
    art,
    bemessung,
    konditionen,
    netto: b.netto,
    ustProzent: k.ustProzent,
    brutto: b.brutto,
    entstandenAm: jetzt(),
    faelligAm: status === "faellig" ? jetzt() : null,
    status,
    ...(notiz ? { notiz } : {}),
    verlauf: [{ am: jetzt(), von, was: `Anspruch erfasst (${M.PROVISION_STATUS[status].label})` }],
  };
}

function gutscheinNeu(e: M.Einstellungen, zahler: M.KundeRecord | null, von: string): M.Gutschein | null {
  if (!e.gutschein?.aktiv || !zahler || e.gutschein.betrag <= 0) return null;
  const am = jetzt();
  return { code: M.gutscheinCode(), betrag: e.gutschein.betrag, kundeId: zahler.id, ausgegebenAm: am, gueltigBis: M.gutscheinGueltigBis(am), von };
}

export function gutscheinBedingungen(g: M.Gutschein): string {
  return `Gutscheinbedingungen: Der Treue-Gutschein ${g.code} über ${M.euro(g.betrag)} wird auf die Provision Ihres nächsten erfolgreichen Geschäfts mit Lippe Forst angerechnet (Preisnachlass auf den Bruttobetrag, höchstens bis zur Höhe dieser Provision). Er ist nicht übertragbar und wird nicht bar ausgezahlt. Gültig bis ${T.tagDe(g.gueltigBis)}.`;
}

export async function externErfassen(
  key: string,
  art: M.Art,
  von: string,
  daten: { datum: string; flaecheHa: number | null; betrag: number | null; quelle: string; notiz: string },
): Promise<void> {
  const [ctx, e] = await Promise.all([ladeVorgangKontext(key), ladeEinstellungen()]);
  const konditionen = ctx?.suchender?.vertrag?.konditionen ?? null;
  const provision = provisionNeu("extern", art, daten.betrag, konditionen, "faellig", von, konditionen ? "Außerhalb der Plattform geschlossen" : "Außerhalb geschlossen; kein unterschriebener Nachweisvertrag gefunden — Anspruch prüfen.");
  const gutschein = gutscheinNeu(e, ctx?.suchender ?? null, von);
  const ext: M.ExternerVertrag = {
    id: M.kurzId("EXT"),
    art,
    datum: daten.datum,
    flaecheHa: daten.flaecheHa,
    betrag: daten.betrag,
    quelle: daten.quelle,
    notiz: daten.notiz,
    erfasstAm: jetzt(),
    von,
    provisionId: provision.id,
  };
  await aendereVorgang(key, art, (x) => {
    x.externeVertraege.unshift(ext);
    x.provisionen.unshift(provision);
    x.abschluss ??= { am: jetzt(), grundlage: "extern" };
    if (gutschein && !x.gutschein) x.gutschein = gutschein;
    M.ereignis(x, von, "extern", `Außerhalb geschlossener ${art === "kauf" ? "Kaufvertrag" : "Pachtvertrag"} erfasst (${T.tagDe(daten.datum)}, Quelle: ${daten.quelle || "—"})`);
    M.ereignis(x, von, "provision", `Provision fällig: ${M.euro(provision.netto)} netto / ${M.euro(provision.brutto)} brutto`);
    if (gutschein && x.gutschein?.code === gutschein.code) M.ereignis(x, von, "gutschein", `Treue-Gutschein ${gutschein.code} ausgegeben`);
  });
  await paarAendern(von, key, (m) => {
    m.status = "abschluss";
    return "Außerhalb geschlossener Vertrag erfasst — Provision erfasst";
  });
  if (ctx) await abschlussMails(ctx, "extern", null, gutschein);
  await adminInfo(`Provision fällig (externer Abschluss): ${key}`, [
    `Erfasst durch ${von}: ${art === "kauf" ? "Kaufvertrag" : "Pachtvertrag"} vom ${T.tagDe(daten.datum)}${daten.flaecheHa ? `, ${T.haText(daten.flaecheHa)}` : ""}.`,
    `Bemessung: ${M.euro(daten.betrag)} → Provision ${M.euro(provision.netto)} netto / ${M.euro(provision.brutto)} brutto.`,
  ], verwaltungsLink(`/admin/vorgang/${key}`));
}

export async function provisionStatusSetzen(key: string, id: string, status: M.ProvisionStatus, notiz: string, von: string): Promise<void> {
  const v = await ladeVorgang(key);
  if (!v) return;
  await aendereVorgang(key, v.art, (x) => {
    const p = x.provisionen.find((q) => q.id === id);
    if (!p || (p.status === status && !notiz)) return false;
    p.status = status;
    if (status === "faellig" && !p.faelligAm) p.faelligAm = jetzt();
    if (notiz) p.notiz = notiz;
    p.verlauf.unshift({ am: jetzt(), von, was: `${M.PROVISION_STATUS[status].label}${notiz ? `: ${notiz}` : ""}` });
    M.ereignis(x, von, "provision", `Provision ${p.id}: ${M.PROVISION_STATUS[status].label}${notiz ? ` (${notiz})` : ""}`);
  });
}

/** Alle ausgegebenen Gutscheine (für die Übersicht). */
export async function alleGutscheine(): Promise<{ vorgang: string; g: M.Gutschein }[]> {
  return (await alleVorgaenge()).filter((v) => v.gutschein).map((v) => ({ vorgang: v.key, g: v.gutschein! }));
}

/** Gutschein auf eine Provision anrechnen — nur für denselben Kunden (E-Mail), gültig, nicht eingelöst. */
export async function gutscheinAnrechnen(key: string, provisionId: string, code: string, von: string): Promise<{ ok: boolean; fehler?: string }> {
  const sauber = code.trim().toUpperCase();
  const [alle, ziel] = await Promise.all([alleVorgaenge(), ladeVorgangKontext(key)]);
  const quelle = alle.find((v) => v.gutschein?.code === sauber);
  if (!quelle?.gutschein || !ziel?.vorgang) return { ok: false, fehler: "Gutschein nicht gefunden." };
  const g = quelle.gutschein;
  if (g.eingeloest || g.storniert) return { ok: false, fehler: "Gutschein ist bereits eingelöst oder storniert." };
  if (new Date(`${g.gueltigBis}T23:59:59+01:00`).getTime() < Date.now()) return { ok: false, fehler: "Gutschein ist abgelaufen." };
  if (quelle.key === key) return { ok: false, fehler: "Der Gutschein gilt erst für das nächste Geschäft." };
  const inhaber = await ladeKunde(g.kundeId);
  if (!inhaber || !ziel.suchender || inhaber.email !== ziel.suchender.email) return { ok: false, fehler: "Der Gutschein ist nicht übertragbar — er gehört einem anderen Kunden." };
  let fehler = "";
  await aendereVorgang(key, ziel.art, (x) => {
    const p = x.provisionen.find((q) => q.id === provisionId);
    if (!p || p.status === "storniert") {
      fehler = "Provision nicht gefunden.";
      return false;
    }
    if (p.gutschein) {
      fehler = "Auf diese Provision ist bereits ein Gutschein angerechnet.";
      return false;
    }
    p.gutschein = { code: g.code, abzugBrutto: Math.min(g.betrag, p.brutto ?? g.betrag) };
    p.verlauf.unshift({ am: jetzt(), von, was: `Treue-Gutschein ${g.code} angerechnet (−${M.euro(p.gutschein.abzugBrutto)} brutto)` });
    M.ereignis(x, von, "gutschein", `Treue-Gutschein ${g.code} auf Provision ${p.id} angerechnet`);
  });
  if (fehler) return { ok: false, fehler };
  await aendereVorgang(quelle.key, quelle.art, (x) => {
    if (!x.gutschein || x.gutschein.eingeloest) return false;
    x.gutschein.eingeloest = { am: jetzt(), von, vorgang: key };
    M.ereignis(x, von, "gutschein", `Treue-Gutschein ${g.code} eingelöst im Vorgang ${key}`);
  });
  return { ok: true };
}

export async function gutscheinStornieren(key: string, von: string, grund: string): Promise<void> {
  const v = await ladeVorgang(key);
  if (!v?.gutschein) return;
  await aendereVorgang(key, v.art, (x) => {
    if (!x.gutschein || x.gutschein.eingeloest || x.gutschein.storniert) return false;
    x.gutschein.storniert = { am: jetzt(), von, grund };
    M.ereignis(x, von, "gutschein", `Treue-Gutschein ${x.gutschein.code} storniert${grund ? `: ${grund}` : ""}`);
  });
}

// ---------------------------------------------------------------------------
// Meldungen der Kunden (Abschluss außerhalb, Rückfragen)

export async function kundenMeldung(key: string, art: M.Art, rolle: M.Rolle, typ: "abschluss" | "rueckfrage", text: string): Promise<void> {
  await aendereVorgang(key, art, (x) => {
    x.meldungen.unshift({ id: M.kurzId("MLD"), am: jetzt(), rolle, art: typ, text });
    M.ereignis(x, "kunde", typ === "abschluss" ? "meldung-abschluss" : "meldung-rueckfrage", `${M.ROLLE_NAME[rolle]}: ${typ === "abschluss" ? "meldet einen Vertragsschluss" : "Rückfrage"} — ${text.slice(0, 140)}`);
  });
  await adminInfo(`${typ === "abschluss" ? "Kunde meldet Vertragsschluss" : "Rückfrage aus dem Kundenbereich"}: ${key}`, [
    `Von: ${M.ROLLE_NAME[rolle]}`,
    "",
    text,
    ...(typ === "abschluss" ? ["", "Bitte prüfen und im Vorgang als „außerhalb geschlossenen Vertrag“ erfassen (Provision)."] : []),
  ], verwaltungsLink(`/admin/vorgang/${key}`));
}

// ---------------------------------------------------------------------------
// Mails nach dem Abschluss (Vertrag als PDF, Gutschein getrennt, KEINE Bewertungsbitte)

async function abschlussMails(ctx: VorgangKontext, grundlage: "pachtvertrag" | "kaufvertrag" | "extern", pdf: Anhang | null, gutschein: M.Gutschein | null): Promise<void> {
  const parteien: { k: M.KundeRecord | null; l: LeadView; rolle: M.Rolle }[] = [
    { k: ctx.anbieter, l: ctx.angebot, rolle: "anbieter" },
    { k: ctx.suchender, l: ctx.gesuch, rolle: "suchender" },
  ];
  for (const { k, l, rolle } of parteien) {
    if (!k) continue;
    // Nur der unterschriebene Pachtvertrag geht automatisch an beide (Textform, § 585a BGB).
    // Bei Kauf/extern entsteht keine Pflicht-Mail — die Verwaltung schreibt bei Bedarf selbst.
    if (grundlage !== "pachtvertrag") {
      if (rolle === "suchender" && gutschein) await gutscheinMail(ctx, k, l, gutschein);
      continue;
    }
    const zeilen = [
      `Guten Tag ${kundenName(k, l)},`,
      "",
      "der Landpachtvertrag ist von beiden Seiten online unterschrieben und damit geschlossen. Im Anhang finden Sie den vollständigen Vertrag als PDF mit dem Unterschriftsprotokoll beider Parteien; im Kundenbereich ist er ebenfalls abrufbar.",
      "",
      rolle === "anbieter"
        ? "Bitte denken Sie daran: Als Verpächter zeigen Sie den Vertrag binnen eines Monats der Landwirtschaftskammer NRW an (§ 2 Landpachtverkehrsgesetz; für den Kreis Lippe die Kreisstellen Höxter, Lippe, Paderborn in Brakel). Verträge über Flächen bis 1 ha sind ausgenommen."
        : "Die Provision für unseren Nachweis stellen wir Ihnen gesondert in Rechnung.",
    ];
    if (rolle === "suchender" && gutschein) {
      zeilen.push("", `Als Dankeschön für Ihren Abschluss erhalten Sie einen Treue-Gutschein über ${M.euro(gutschein.betrag)} für Ihr nächstes Geschäft mit Lippe Forst: Code ${gutschein.code}.`, gutscheinBedingungen(gutschein));
    }
    zeilen.push("", `Ihr Kundenbereich: ${site.url}/kunde`, "", GRUSS);
    const betreff = `Landpachtvertrag geschlossen — Ihr Exemplar (${ctx.key})`;
    const text = zeilen.join("\n");
    const r = await kundenMail({ an: k.email, betreff, text, anhaenge: pdf ? [pdf] : [] });
    await aendereVorgang(ctx.key, ctx.art, (x) => {
      x.mails.unshift({ id: M.kurzId("M"), am: jetzt(), von: "system", an: k.email, betreff, text, zweck: "abschluss", test: r.test, ok: r.ok, fehler: r.fehler, anhang: pdf?.dateiname });
    });
  }
}

async function gutscheinMail(ctx: VorgangKontext, k: M.KundeRecord, l: LeadView, g: M.Gutschein): Promise<void> {
  const betreff = `Ihr Treue-Gutschein von Lippe Forst (${g.code})`;
  const text = [
    `Guten Tag ${kundenName(k, l)},`,
    "",
    `herzlichen Glückwunsch zu Ihrem Abschluss! Als Dankeschön erhalten Sie einen Treue-Gutschein über ${M.euro(g.betrag)} für Ihr nächstes Geschäft mit Lippe Forst: Code ${g.code}.`,
    "",
    gutscheinBedingungen(g),
    "",
    GRUSS,
  ].join("\n");
  const r = await kundenMail({ an: k.email, betreff, text });
  await aendereVorgang(ctx.key, ctx.art, (x) => {
    x.mails.unshift({ id: M.kurzId("M"), am: jetzt(), von: "system", an: k.email, betreff, text, zweck: "gutschein", test: r.test, ok: r.ok, fehler: r.fehler });
  });
}

// ---------------------------------------------------------------------------
// Bitte um Google-Bewertung (ohne Anreiz, an alle abgeschlossenen Kunden)

export function bewertungFaellig(v: M.VorgangRecord, e: M.Einstellungen, jetztD = new Date()): M.Rolle[] {
  if (!v.abschluss) return [];
  const ab = new Date(v.abschluss.am).getTime() + (e.bewertung?.nachTagen ?? 3) * 86_400_000;
  if (jetztD.getTime() < ab) return [];
  return (["anbieter", "suchender"] as M.Rolle[]).filter((r) => !v.bewertung?.[r]);
}

export function bewertungsText(name: string, art: M.Art, url: string): { betreff: string; text: string } {
  return {
    betreff: "Ihre Erfahrung mit Lippe Forst",
    text: [
      `Guten Tag ${name},`,
      "",
      `Ihr ${art === "kauf" ? "Flächenkauf" : "Pachtvertrag"} über Lippe Forst ist abgeschlossen — vielen Dank für Ihr Vertrauen.`,
      "",
      "Wenn Sie mögen, freuen wir uns über eine ehrliche Bewertung Ihrer Erfahrung bei Google. Das dauert etwa eine Minute und ist selbstverständlich freiwillig:",
      url,
      "",
      "Sie haben beim Vertragsschluss eingewilligt, dass wir Sie einmal um eine Bewertung bitten dürfen. Möchten Sie keine solchen E-Mails mehr, genügt eine kurze Antwort auf diese E-Mail.",
      "",
      GRUSS,
    ].join("\n"),
  };
}

export async function bewertungVermerken(key: string, art: M.Art, rolle: M.Rolle, von: string): Promise<void> {
  await aendereVorgang(key, art, (x) => {
    x.bewertung = { ...(x.bewertung ?? {}), [rolle]: jetzt() };
    M.ereignis(x, von, "bewertung", `Bitte um Google-Bewertung an ${M.ROLLE_ARTIKEL[rolle].akk} gesendet`);
  });
}

/** Täglicher Cron: fällige Bewertungsbitten senden — nur wenn in den Einstellungen eingeschaltet. */
export async function bewertungenAutomatisch(envUrl: string | undefined): Promise<{ gesendet: number; aus?: string }> {
  const e = await ladeEinstellungen();
  if (!e.bewertung?.autoVersand) return { gesendet: 0, aus: "Automatischer Versand ist ausgeschaltet." };
  const url = M.bewertungsUrl(e, envUrl);
  if (!url) return { gesendet: 0, aus: "Kein Bewertungslink hinterlegt." };
  let gesendet = 0;
  for (const v of await alleVorgaenge()) {
    for (const rolle of bewertungFaellig(v, e)) {
      const k = await ladeKunde(rolle === "anbieter" ? v.angebotId : v.gesuchId);
      if (!M.bewertungsmailErlaubt(k)) continue;
      if (!k) continue;
      const name = k.stammdaten?.name || k.vertrag?.signatur.name || "";
      const { betreff, text } = bewertungsText(name, v.art, url);
      const r = await kundenMail({ an: k.email, betreff, text });
      await aendereVorgang(v.key, v.art, (x) => {
        x.mails.unshift({ id: M.kurzId("M"), am: jetzt(), von: "cron", an: k.email, betreff, text, zweck: "bewertung", test: r.test, ok: r.ok, fehler: r.fehler });
        if (r.ok) {
          x.bewertung = { ...(x.bewertung ?? {}), [rolle]: jetzt() };
          M.ereignis(x, "cron", "bewertung", `Bitte um Google-Bewertung automatisch an ${M.ROLLE_ARTIKEL[rolle].akk} gesendet`);
        }
      });
      if (r.ok) gesendet++;
    }
  }
  return { gesendet };
}
