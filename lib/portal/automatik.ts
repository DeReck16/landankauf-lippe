import "server-only";
import { findeKandidaten } from "@/lib/admin/matching";
import { leadView, type LeadView, type Zustand } from "@/lib/admin/model";
import { einmalMarker, jsonAendern, jsonLesen, listLeads, readZustand } from "@/lib/admin/store";
import { boerseLuecken, boerseVeroeffentlichen, sperrGrund } from "@/lib/boerse";
import { site } from "@/lib/site";
import { anfrageVorschlag } from "./anfrage-vorschlag";
import { assistentPlan } from "./assistent";
import { alleAktionen, type AssistentAktion, type AssistentMail } from "./assistent-typen";
import { anfrageEinladen, linkErstellen, mailsSenden, type AusfuehrZeile, type Umgebung } from "./ausfuehren";
import { REGELN, automatikVon, erinnerungFaellig, regelWirksam, tagBerlin, type AutomatikEinstellungen, type RegelId } from "./automatik-regeln";
import { boerseOnlineText } from "./boerse-mails";
import { adminInfo } from "./mail";
import * as M from "./model";
import { alleKunden, alleVorgaenge, ladeEinstellungen } from "./speicher";
import * as T from "./texte";
import { verwaltungsMailSenden } from "./versand";
import * as V from "./vorgang";

// Automatik (Review 27.09.2026, Phase 1+2; Regeln in lib/portal/automatik-regeln.ts).
// Auslöser: after() nach Kundenhandlungen und neuen Anfragen, dazu der tägliche Lauf
// (/api/cron/taeglich). Jede Regel ist einzeln schaltbar (Standard AUS), dazu Not-Aus,
// Probelauf (nur protokollieren), Tageslimit für Mails und eine tägliche Zusammenfassung.
// Ausgeführt wird genau das, was der Klick-Assistent anbieten würde — mit denselben
// Sperren (Pläne aus lib/portal/assistent.ts, Versand über lib/portal/versand.ts).
// Jede Aktion läuft höchstens einmal (Einmal-Marker je Regel und Gegenstand).

const VON = "automatik";

export type AutomatikEintrag = { am: string; regel: RegelId | "system"; ref: string; text: string; art: "ok" | "fehler" | "probe" | "info" };

type Tagesprotokoll = { v: 1; tag: string; eintraege: AutomatikEintrag[]; mails: number; zusammenfassungAm?: string };

const protokollPfad = (tag: string) => `automatik/protokoll/${tag}.json`;
const sicher = (s: string) => s.replace(/[^A-Za-z0-9~_-]+/g, "_").slice(0, 120);

function leeresProtokoll(tag: string): Tagesprotokoll {
  return { v: 1, tag, eintraege: [], mails: 0 };
}

async function protokollieren(eintraege: AutomatikEintrag[]): Promise<void> {
  if (!eintraege.length) return;
  const tag = tagBerlin();
  await jsonAendern<Tagesprotokoll>(protokollPfad(tag), () => leeresProtokoll(tag), (d) => {
    d.eintraege = [...eintraege, ...(d.eintraege ?? [])].slice(0, 500);
  });
}

/** Protokoll der letzten Tage (neueste zuerst) — für den Dashboard-Abschnitt „Automatisch erledigt“. */
export async function automatikProtokoll(tage = 2): Promise<AutomatikEintrag[]> {
  const out: AutomatikEintrag[] = [];
  for (let i = 0; i < tage; i++) {
    const tag = tagBerlin(new Date(Date.now() - i * 86_400_000));
    const p = await jsonLesen<Tagesprotokoll>(protokollPfad(tag)).catch(() => null);
    out.push(...(p?.daten.eintraege ?? []));
  }
  return out;
}

/** Kontingent für automatische Kunden-Mails (Tageslimit, alle Regeln zusammen): reserviert `n` Mails. */
async function kontingent(n: number, limit: number): Promise<boolean> {
  if (n <= 0) return true;
  const tag = tagBerlin();
  let ok = false;
  await jsonAendern<Tagesprotokoll>(protokollPfad(tag), () => leeresProtokoll(tag), (d) => {
    ok = (d.mails ?? 0) + n <= limit;
    if (!ok) return false;
    d.mails = (d.mails ?? 0) + n;
  });
  return ok;
}

async function markerDa(relPfad: string): Promise<boolean> {
  return Boolean(await jsonLesen<unknown>(relPfad).catch(() => null));
}

type Lauf = {
  a: AutomatikEinstellungen;
  u: Umgebung;
  leads: LeadView[];
  zustand: Zustand;
  vorgaenge: Map<string, M.VorgangRecord>;
  eintraege: AutomatikEintrag[];
  jetzt: Date;
};

async function basis(): Promise<string> {
  if (process.env.NODE_ENV === "production") return site.url;
  try {
    const { basisUrl } = await import("./sitzung");
    return await basisUrl();
  } catch {
    return "http://localhost:3000";
  }
}

async function laufVorbereiten(): Promise<Lauf | null> {
  const e = await ladeEinstellungen();
  const a = automatikVon(e.automatik);
  if (a.notAus || !REGELN.some((r) => a.regeln[r.id])) return null;
  const [roh, { zustand }, kunden, vorgaenge] = await Promise.all([listLeads(), readZustand(), alleKunden(), alleVorgaenge()]);
  const u: Umgebung = {
    einstellungen: e,
    basis: await basis(),
    bewertungsUrl: M.bewertungsUrl(e, process.env.GOOGLE_REVIEW_URL),
    kunden: new Map(kunden.map((k) => [k.id, k])),
  };
  return {
    a,
    u,
    leads: roh.map((l) => leadView(l, zustand.anfragen[l.id])),
    zustand,
    vorgaenge: new Map(vorgaenge.map((v) => [v.key, v])),
    eintraege: [],
    jetzt: new Date(),
  };
}

function eintrag(l: Lauf, regel: RegelId, ref: string, text: string, art: AutomatikEintrag["art"]): void {
  l.eintraege.push({ am: new Date().toISOString(), regel, ref, text, art });
}

/**
 * Eine Aktion höchstens einmal ausführen. Probelauf: nur „würde …“ protokollieren (einmal je Tag),
 * nichts markieren — nach dem Umschalten läuft sie dann wirklich. Tageslimit: bei Überschreitung
 * nicht ausführen (einmal je Tag protokolliert), der nächste Lauf versucht es erneut.
 */
async function einmal(l: Lauf, regel: RegelId, ref: string, schluessel: string, was: string, mails: number, ausfuehren: () => Promise<AusfuehrZeile[]>): Promise<void> {
  const tag = tagBerlin();
  const erledigt = `automatik/erledigt/${regel}/${sicher(schluessel)}.json`;
  if (await markerDa(erledigt)) return;
  if (l.a.probelauf) {
    if (await einmalMarker(`automatik/probe/${tag}/${regel}/${sicher(schluessel)}.json`)) eintrag(l, regel, ref, `Probelauf — würde: ${was}`, "probe");
    return;
  }
  if (!(await kontingent(mails, l.a.tageslimit))) {
    if (await einmalMarker(`automatik/limit/${tag}/${regel}/${sicher(schluessel)}.json`)) eintrag(l, regel, ref, `Tageslimit (${l.a.tageslimit} Mails) erreicht — verschoben: ${was}`, "info");
    return;
  }
  // Gegen doppelte Ausführung bei gleichzeitigen Läufen (after() und Cron): erst markieren, dann ausführen.
  if (!(await einmalMarker(erledigt))) return;
  let zeilen: AusfuehrZeile[];
  try {
    zeilen = await ausfuehren();
  } catch (err) {
    zeilen = [{ art: "fehler", text: err instanceof Error ? err.message : "Unbekannter Fehler" }];
  }
  const fehler = zeilen.filter((z) => z.art === "fehler");
  eintrag(l, regel, ref, `${was}${zeilen.length ? ` — ${zeilen.map((z) => (z.art === "fehler" ? `✗ ${z.text}` : z.text)).join(" · ")}` : ""}`, fehler.length ? "fehler" : "ok");
}

// ---------------------------------------------------------------------------
// R1 · Börse nach Einwilligung im Kundenbereich veröffentlichen

async function r1(l: Lauf, nur?: Set<string>): Promise<void> {
  if (!regelWirksam(l.a, "r1").an) return;
  for (const lead of l.leads) {
    if (nur && !nur.has(lead.id)) continue;
    const b = lead.meta.boerse;
    if (!b?.einwilligung || b.online || b.offline || b.einwilligung.quelle !== "im Kundenbereich") continue;
    if (boerseLuecken(b, lead).length || sperrGrund(lead.id, l.u.kunden, [...l.vorgaenge.values()])) continue;
    const name = T.wert(lead.name) || lead.id;
    await einmal(l, "r1", lead.id, `${lead.id}|${b.code}|${b.einwilligung.am}`, `${b.code} veröffentlichen und ${name} informieren`, 1, async () => {
      const r = await boerseVeroeffentlichen(lead.id, VON);
      if (!r.ok) return [{ art: "fehler", text: `nicht veröffentlicht: ${r.grund}` }];
      const zeilen: AusfuehrZeile[] = [{ art: "ok", text: `${b.code} ist online` }];
      const k = l.u.kunden.get(lead.id);
      const an = (k?.email || T.wert(lead.email)).toLowerCase();
      const m = boerseOnlineText(lead, b, l.u.basis);
      const v = await verwaltungsMailSenden(VON, { zweck: "boerse", kundeId: lead.id, rolle: "anbieter", an, betreff: m.betreff, text: m.text });
      zeilen.push(v.ok ? { art: "ok", text: `E-Mail an ${name}: „${m.betreff}“` } : { art: "fehler", text: `E-Mail an ${name} nicht gesendet: ${v.text}` });
      return zeilen;
    });
  }
}

// ---------------------------------------------------------------------------
// R2 · Matching: passende Paare vormerken (keine Mail)

async function r2(l: Lauf, nur?: Set<string>): Promise<void> {
  if (!regelWirksam(l.a, "r2").an) return;
  const { kandidaten } = findeKandidaten(l.leads, l.zustand);
  for (const k of kandidaten) {
    if (k.meta || (k.score ?? 0) < l.a.schwelle) continue;
    if (nur && !nur.has(k.angebot.id) && !nur.has(k.gesuch.id)) continue;
    const titel = `${T.wert(k.angebot.name) || k.angebot.id} ↔ ${T.wert(k.gesuch.name) || k.gesuch.id}`;
    await einmal(l, "r2", k.key, k.key, `Paar ${titel} vormerken (${k.score} % Übereinstimmung)`, 0, async () => {
      const ok = await V.paarVormerken(k.key, VON, `Automatik R2 (${k.score} % Übereinstimmung)`);
      return [ok ? { art: "ok", text: "vorgemerkt" } : { art: "info", text: "schon bearbeitet" }];
    });
  }
}

// ---------------------------------------------------------------------------
// Vorgänge (nur Pacht): Plan des Assistenten berechnen und passende Aktionen ausführen

function vorgangsKontexte(l: Lauf, nur?: Set<string>): V.VorgangKontext[] {
  const byId = new Map(l.leads.map((x) => [x.id, x]));
  const out: V.VorgangKontext[] = [];
  for (const [key, meta] of Object.entries(l.zustand.paare)) {
    if (!["vorgemerkt", "angefragt", "kontakt"].includes(meta.status)) continue;
    const [aId, gId] = key.split("~");
    if (nur && !nur.has(key) && !nur.has(aId) && !nur.has(gId)) continue;
    const angebot = byId.get(aId);
    const gesuch = byId.get(gId);
    if (!angebot || !gesuch) continue;
    const vorgang = l.vorgaenge.get(key) ?? null;
    const art: M.Art = vorgang?.art ?? (angebot.art === "kauf" ? "kauf" : "pacht");
    // Kauf-Vorgänge bleiben ausgenommen (erst mit GwG-Ablauf).
    if (art !== "pacht") continue;
    out.push({ key, art, meta, vorgang, angebot, gesuch, anbieter: l.u.kunden.get(aId) ?? null, suchender: l.u.kunden.get(gId) ?? null, zustand: l.zustand });
  }
  return out;
}

function aktionMit(l: Lauf, ctx: V.VorgangKontext, ids: string[]): AssistentAktion | null {
  const plan = assistentPlan(ctx, { ...l.u, jetzt: l.jetzt });
  return alleAktionen(plan).find((x) => ids.includes(x.id) && !x.gesperrt && x.mails.length > 0) ?? null;
}

function titelVon(ctx: V.VorgangKontext): string {
  return `${ctx.anbieter?.stammdaten?.name || T.wert(ctx.angebot.name)} ↔ ${ctx.suchender?.stammdaten?.name || T.wert(ctx.gesuch.name)}`;
}

/** Einladungen für vorgemerkte Paare (Teil von R3). */
async function r3Paare(l: Lauf, kontexte: V.VorgangKontext[]): Promise<void> {
  for (const ctx of kontexte) {
    const a = aktionMit(l, ctx, ["einladen"]);
    if (!a) continue;
    // Angebote mit offenem Weg nicht automatisch einladen — dort entscheidet die Verwaltung (Selbst kaufen / Vermitteln).
    const mails = a.mails.filter((m) => !(m.rolle === "anbieter" && ctx.angebot.meta.weg !== "vermittlung"));
    if (!mails.length) continue;
    await einmal(l, "r3", ctx.key, `${ctx.key}|einladen|${mails.map((m) => m.rolle).join("+")}`, `Einladung(en) im Vorgang ${titelVon(ctx)}`, mails.length, async () => {
      const zeilen: AusfuehrZeile[] = [];
      for (const m of mails) {
        if (m.neuerLink && !(await linkErstellen(VON, m, l.u, zeilen))) continue;
        await mailsSenden(VON, ctx.key, l.u, [m], zeilen);
      }
      return zeilen;
    });
  }
}

/** R3 · Einladung zu neuen Anfragen ohne Paar (Pacht-Gesuche; Pacht-Angebote nur mit Weg „Vermitteln“). */
async function r3(l: Lauf, nur?: Set<string>): Promise<void> {
  if (!regelWirksam(l.a, "r3").an) return;
  for (const lead of l.leads) {
    if (nur && !nur.has(lead.id)) continue;
    if (lead.status !== "neu") continue;
    const rr = T.rolleVonLead(lead);
    if (!rr || rr.art !== "pacht") continue;
    if (rr.rolle === "anbieter" && lead.meta.weg !== "vermittlung") continue;
    const k = l.u.kunden.get(lead.id) ?? null;
    const v = anfrageVorschlag(lead, k, { ...l.u, jetzt: l.jetzt });
    if (v.aktion.id !== "einladen" || v.aktion.gesperrt) continue;
    const name = T.wert(lead.name) || lead.id;
    await einmal(l, "r3", lead.id, `${lead.id}|einladung`, `Einladung an ${name} (${rr.rolle === "anbieter" ? "Pacht-Angebot" : "Pacht-Gesuch"})`, 1, async () => {
      const zeilen: AusfuehrZeile[] = [];
      await anfrageEinladen(lead, VON, l.u, zeilen);
      return zeilen;
    });
  }
  await r3Paare(l, vorgangsKontexte(l, nur));
}

/** R4 · Anonyme Hinweise, sobald beide unterschrieben haben. */
async function r4(l: Lauf, kontexte: V.VorgangKontext[]): Promise<void> {
  if (!regelWirksam(l.a, "r4").an) return;
  for (const ctx of kontexte) {
    const a = aktionMit(l, ctx, ["hinweise"]);
    if (!a) continue;
    // Nur erstmalige Hinweise — Erinnerungen laufen über R7.
    const mails = a.mails.filter((m) => !m.zuletzt);
    if (!mails.length) continue;
    await einmal(l, "r4", ctx.key, `${ctx.key}|hinweise`, `Anonyme Hinweise im Vorgang ${titelVon(ctx)}`, mails.length, async () => {
      const zeilen: AusfuehrZeile[] = [];
      await mailsSenden(VON, ctx.key, l.u, mails, zeilen);
      return zeilen;
    });
  }
}

/** R5 · Freigabe und Mitteilungen, sobald beide zugestimmt haben und die Prüfung grün ist. */
async function r5(l: Lauf, kontexte: V.VorgangKontext[]): Promise<void> {
  if (!regelWirksam(l.a, "r5").an) return;
  for (const ctx of kontexte) {
    const plan = assistentPlan(ctx, { ...l.u, jetzt: l.jetzt });
    const a = alleAktionen(plan).find((x) => (x.id === "freigeben" || x.id === "freigabe-mitteilen") && !x.gesperrt);
    if (!a) continue;
    if (a.id === "freigeben" && !V.freigabePruefung(ctx, l.jetzt).bereit) continue;
    const runde = ctx.vorgang?.freigabe?.am ?? "neu";
    await einmal(l, "r5", ctx.key, `${ctx.key}|${a.id}|${runde}`, `${a.id === "freigeben" ? "Kontakt freigeben und beide informieren" : "Freigabe mitteilen"}: ${titelVon(ctx)}`, a.mails.length || 2, async () => {
      const zeilen: AusfuehrZeile[] = [];
      if (a.id === "freigeben") {
        const r = await V.freigeben(ctx.key, VON);
        if (!r.ok) return [{ art: "fehler", text: `Freigabe nicht möglich: ${r.fehler}` }];
        zeilen.push({ art: "ok", text: "Kontakt freigegeben" });
      }
      await mailsSenden(VON, ctx.key, l.u, a.mails, zeilen);
      return zeilen;
    });
  }
}

/** Zeitpunkte bisheriger Mails dieses Zwecks an diese Adresse in der laufenden Runde (für R7). */
function bisherige(ctx: V.VorgangKontext, l: Lauf, m: AssistentMail): string[] {
  const k = l.u.kunden.get(m.kundeId);
  const an = m.an.toLowerCase();
  if (m.zweck === "erinnerung" || m.zweck === "einladung") {
    const ab = k?.einladung?.erstelltAm ?? "";
    return (k?.mails ?? []).filter((x) => x.ok && x.an.toLowerCase() === an && (x.zweck === "einladung" || x.zweck === "erinnerung") && x.am >= ab).map((x) => x.am);
  }
  const ab = m.zweck === "pachtvertrag" ? (ctx.vorgang?.pachtvertrag?.geaendertAm ?? "") : "";
  return (ctx.vorgang?.mails ?? []).filter((x) => x.ok && x.an.toLowerCase() === an && x.zweck === m.zweck && x.am >= ab).map((x) => x.am);
}

/** R7 · Erinnerungen (Einladung, Hinweis, Pachtvertrag) — höchstens zwei, nach 3 und weiteren 7 Tagen. */
async function r7(l: Lauf, kontexte: V.VorgangKontext[]): Promise<void> {
  if (!regelWirksam(l.a, "r7").an) return;
  for (const ctx of kontexte) {
    const plan = assistentPlan(ctx, { ...l.u, jetzt: l.jetzt });
    for (const a of alleAktionen(plan).filter((x) => ["erinnern", "hinweise", "pacht-erinnern"].includes(x.id) && !x.gesperrt)) {
      for (const m of a.mails) {
        if (!m.zuletzt) continue; // die erste Mail ist Sache von R3/R4 bzw. der Verwaltung
        // R4/R5 (Hinweise) stehen unter den Rechtsschaltern — Hinweis-Erinnerungen ebenso.
        if (a.id === "hinweise" && !regelWirksam(l.a, "r4").an) continue;
        const zeiten = bisherige(ctx, l, m);
        if (!erinnerungFaellig(zeiten, l.jetzt)) continue;
        await einmal(l, "r7", ctx.key, `${ctx.key}|${m.zweck}|${m.rolle}|${zeiten.length}|${zeiten[0] ?? ""}`, `Erinnerung (${zeiten.length}.) an ${m.wer}: ${m.betreff}`, 1, async () => {
          const zeilen: AusfuehrZeile[] = [];
          if (m.neuerLink && !(await linkErstellen(VON, m, l.u, zeilen))) return zeilen;
          await mailsSenden(VON, ctx.key, l.u, [m], zeilen);
          return zeilen;
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Auslöser

async function ausfuehren(regeln: RegelId[], nur?: Set<string>): Promise<AutomatikEintrag[]> {
  const l = await laufVorbereiten();
  if (!l) return [];
  try {
    if (regeln.includes("r1")) await r1(l, nur);
    if (regeln.includes("r2")) await r2(l, nur);
    if (regeln.includes("r3")) await r3(l, nur);
    // Nach R2/R3 haben sich Paare und Akten geändert — für die Vorgangsregeln frisch laden.
    if (regeln.some((r) => r === "r4" || r === "r5" || r === "r7")) {
      const frisch = (await laufVorbereiten()) ?? l;
      frisch.eintraege = l.eintraege;
      const kontexte = vorgangsKontexte(frisch, nur);
      if (regeln.includes("r4")) await r4(frisch, kontexte);
      if (regeln.includes("r5")) await r5(frisch, kontexte);
      if (regeln.includes("r7")) await r7(frisch, kontexte);
    }
  } catch (err) {
    l.eintraege.push({ am: new Date().toISOString(), regel: "system", ref: "", text: `Automatik abgebrochen: ${err instanceof Error ? err.message : "Fehler"}`, art: "fehler" });
    console.error("[automatik]", err);
  }
  await protokollieren(l.eintraege).catch((err) => console.error("[automatik] Protokoll", err));
  return l.eintraege;
}

/** Nach einer neuen Anfrage (Formular, Rückmeldung, Weg „Vermitteln“): R2 und R3 für diese Anfrage. */
export async function automatikNachAnfrage(id: string): Promise<void> {
  await ausfuehren(["r2", "r3"], new Set([id])).catch((err) => console.error("[automatik] nach Anfrage", err));
}

/** Nach einer Handlung im Kundenbereich. */
export async function automatikNachKunde(id: string, anlass: "angaben" | "unterschrift" | "zustimmung"): Promise<void> {
  const regeln: RegelId[] = anlass === "angaben" ? ["r1"] : anlass === "unterschrift" ? ["r1", "r2", "r3", "r4"] : ["r5"];
  await ausfuehren(regeln, new Set([id])).catch((err) => console.error("[automatik] nach Kunde", err));
}

/** Nach einer Änderung an einem Vorgang (Zustimmung, Vormerken): R4 und R5 für dieses Paar. */
export async function automatikNachPaar(key: string): Promise<void> {
  await ausfuehren(["r4", "r5"], new Set([key])).catch((err) => console.error("[automatik] nach Paar", err));
}

/** Täglicher Lauf: alle Regeln über alles, danach die Zusammenfassung des Vortags. */
export async function automatikTaeglich(opt: { zusammenfassung?: boolean } = {}): Promise<{ eintraege: number; zusammenfassung: boolean }> {
  const eintraege = await ausfuehren(["r1", "r2", "r3", "r4", "r5", "r7"]);
  if (opt.zusammenfassung === false) return { eintraege: eintraege.length, zusammenfassung: false };
  const zusammenfassung = await zusammenfassungSenden().catch((err) => {
    console.error("[automatik] Zusammenfassung", err);
    return false;
  });
  return { eintraege: eintraege.length, zusammenfassung };
}

/** Zusammenfassung des Vortags an die Verwaltung (einmal je Tag, nur wenn es Einträge gibt). */
async function zusammenfassungSenden(): Promise<boolean> {
  const e = await ladeEinstellungen();
  const a = automatikVon(e.automatik);
  if (!a.zusammenfassung) return false;
  const gestern = tagBerlin(new Date(Date.now() - 86_400_000));
  const p = await jsonLesen<Tagesprotokoll>(protokollPfad(gestern));
  if (!p || !p.daten.eintraege.length || p.daten.zusammenfassungAm) return false;
  if (!(await einmalMarker(`automatik/zusammenfassung/${gestern}.json`))) return false;
  const liste = p.daten.eintraege.slice().reverse();
  const zaehl = (art: AutomatikEintrag["art"]) => liste.filter((x) => x.art === art).length;
  await adminInfo(`Automatik: Zusammenfassung vom ${T.datumDe(`${gestern}T12:00:00Z`)}`, [
    `${zaehl("ok")} erledigt · ${zaehl("fehler")} mit Fehler · ${zaehl("probe")} im Probelauf · ${p.daten.mails} automatische Kunden-Mails`,
    a.notAus ? "Hinweis: Der Not-Aus ist an." : a.probelauf ? "Hinweis: Probelauf — es wurde nichts gesendet oder geändert." : "",
    "",
    ...liste.slice(0, 60).map((x) => `${x.am.slice(11, 16)} ${x.regel.toUpperCase()} ${x.art === "fehler" ? "✗" : x.art === "probe" ? "○" : "✓"} ${x.text}`),
    ...(liste.length > 60 ? [`… und ${liste.length - 60} weitere (Dashboard „Automatisch erledigt“).`] : []),
  ].filter((z, i, arr) => z !== "" || (i > 0 && arr[i - 1] !== "")), `${site.url}/admin/dashboard#automatik`);
  await jsonAendern<Tagesprotokoll>(protokollPfad(gestern), () => leeresProtokoll(gestern), (d) => {
    d.zusammenfassungAm = new Date().toISOString();
  });
  return true;
}

/** Stand für die Oberfläche: Einstellungen, Wirksamkeit je Regel. */
export async function automatikStand(): Promise<{ a: AutomatikEinstellungen; regeln: { id: RegelId; titel: string; an: boolean; grund?: string }[] }> {
  const e = await ladeEinstellungen();
  const a = automatikVon(e.automatik);
  return { a, regeln: REGELN.map((r) => ({ id: r.id, titel: r.titel, ...regelWirksam(a, r.id) })) };
}
