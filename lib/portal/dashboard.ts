import "server-only";
import { cache } from "react";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten } from "@/lib/admin/matching";
import type { LeadView } from "@/lib/admin/model";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import { assistentPlan, type AssistentPlan } from "./assistent";
import * as M from "./model";
import { vorgangSchritte, type Schritt } from "./schritte";
import { basisUrl } from "./sitzung";
import * as T from "./texte";
import type { VorgangKontext } from "./vorgang";

// Daten für das Dashboard (/admin/dashboard): jeder Vorgang mit dem Plan des
// Assistenten (lib/portal/assistent.ts), einsortiert nach „Jetzt dran“ (die
// Verwaltung ist am Zug), „Warten auf Kunden“ und „Abgeschlossen“, dazu die
// unbearbeiteten Vorschläge aus dem Matching. Keine eigene Ablauf-Logik — die
// Knöpfe führen die Aktionen des Assistenten aus.

export type Chip = { text: string; art: "ok" | "warn" | "rot" | "grau"; tipp: string };
export type DashSeite = { rolle: M.Rolle; name: string; chips: Chip[] };

export type DashVorgang = {
  key: string;
  art: M.Art;
  anbieter: string;
  suchender: string;
  seiten: DashSeite[];
  schritte: Schritt[];
  aktuell: Schritt | null;
  plan: AssistentPlan;
  /** Neue Kundenereignisse seit dem letzten Besuch. */
  neu: number;
  abschluss: string | null;
  provision: Chip | null;
  /** Zuletzt etwas passiert (zum Sortieren). */
  zuletzt: string;
};

export type DashVorschlag = { key: string; angebot: LeadView; gesuch: LeadView; score: number | null; distanzKm: number | null; gruende: string[]; neu: boolean };

export type Dashboard = {
  jetzt: DashVorgang[];
  warten: DashVorgang[];
  abgeschlossen: DashVorgang[];
  vorschlaege: DashVorschlag[];
  /** Provision netto, noch nicht bezahlt (fällig, aufschiebend, abgerechnet). */
  provisionOffen: number;
  provisionFaellig: number;
  /** Diese Einträge gelten nach dem Anzeigen als gesehen (Pulsieren). */
  gesehen: string[];
  einstellungen: M.Einstellungen;
};

function tag(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

/** Status-Chips einer Seite mit Zeitstempel: Einladung → geöffnet → unterschrieben → Zustimmung → Vertrag. */
function chipsFuer(ctx: VorgangKontext, rolle: M.Rolle, jetzt: Date): Chip[] {
  const k = rolle === "anbieter" ? ctx.anbieter : ctx.suchender;
  const out: Chip[] = [];
  if (!k) return [{ text: "nicht eingeladen", art: "grau", tipp: "Noch keine Kundenakte — der Assistent lädt ein" }];
  if (k.widerruf) out.push({ text: `widerrufen ${tag(k.widerruf.am)}`, art: "rot", tipp: "Vertrag widerrufen — keine Freigabe, keine Weitergabe von Daten" });
  if (k.kuendigung) out.push({ text: `gekündigt ${tag(k.kuendigung.am)}`, art: "rot", tipp: "Vertrag gekündigt — keine neuen Vorstellungen" });
  if (k.gesperrt) out.push({ text: "Zugang gesperrt", art: "rot", tipp: "Zugang zum Kundenbereich gesperrt — in der Anfrage entsperren" });

  if (k.vertrag) {
    out.push({ text: `unterschrieben ${tag(k.vertrag.signatur.am)}`, art: "ok", tipp: `„${k.vertrag.titel}“ online unterschrieben von „${k.vertrag.signatur.name}“` });
  } else {
    const e = k.einladung;
    const erinnert = k.mails.find((m) => m.zweck === "erinnerung" && m.ok)?.am;
    if (!e) {
      out.push({ text: k.stammdaten ? "kein gültiger Link" : "nicht eingeladen", art: k.stammdaten ? "warn" : "grau", tipp: "Kein gültiger Einladungslink — der Assistent erstellt beim Einladen bzw. Erinnern einen neuen" });
    } else {
      const gesendet = e.gesendetAm ?? k.mails.find((m) => (m.zweck === "einladung" || m.zweck === "erinnerung") && m.ok)?.am;
      out.push(
        gesendet
          ? { text: `Einladung gesendet ${tag(gesendet)}`, art: "ok", tipp: "Einladungs-Mail mit dem persönlichen Link ist raus" }
          : { text: "Link erstellt, nicht gesendet", art: "warn", tipp: "Der Einladungslink besteht, die Einladungs-Mail ist aber noch nicht raus" },
      );
      if (Date.parse(e.bis) < jetzt.getTime()) out.push({ text: `Link abgelaufen ${tag(e.bis)}`, art: "rot", tipp: "Der Einladungslink ist abgelaufen — „Erinnerung senden“ erstellt automatisch einen neuen" });
      if (erinnert) out.push({ text: `erinnert ${tag(erinnert)}`, art: "grau", tipp: "Letzte Erinnerungs-Mail" });
      if (e.angenommenAm) out.push({ text: `Link geöffnet ${tag(e.angenommenAm)}`, art: "ok", tipp: "Der Kunde hat den Kundenbereich über den Link betreten" });
    }
    if (k.stammdaten) out.push({ text: "Angaben gemacht", art: "ok", tipp: "Name und Anschrift sind erfasst — die Unterschrift fehlt noch" });
  }

  // Widerrufsfrist (nur Suchende als Verbraucher) — bis zur Freigabe.
  if (k.vertrag && !k.widerruf && M.hatWiderrufsrecht(k) && !M.aktiveFreigabe(ctx.vorgang) && !ctx.vorgang?.abschluss) {
    if (k.vertrag.beginnwunschAm) {
      out.push({ text: "Beginnwunsch ✓", art: "ok", tipp: "Der Kunde möchte schon vor Ablauf der Widerrufsfrist Kontakte erhalten (§ 356 Abs. 4 BGB)" });
    } else if (!k.vertrag.bestaetigungGesendetAm) {
      out.push({ text: "Bestätigung fehlt", art: "rot", tipp: "Die Vertragsbestätigung mit PDF ist nicht versandt — Voraussetzung der Freigabe (Kundenakte → „Bestätigung erneut senden“)" });
    } else {
      const ab = (k.vertrag.widerrufsfristEnde ? Date.parse(k.vertrag.widerrufsfristEnde) : 0) + M.WIDERRUF_PUFFER_TAGE * 86_400_000;
      if (ab > jetzt.getTime()) out.push({ text: `Freigabe ab ${tag(new Date(ab).toISOString())}`, art: "warn", tipp: "Widerrufsfrist + 4 Tage Puffer — oder früher, wenn der Kunde im Kundenbereich den Beginnwunsch erklärt" });
    }
  }

  // Zustimmung zum Kontakt (nur sinnvoll, sobald beide unterschrieben haben bzw. angefragt ist).
  const meta = ctx.meta;
  const zust = rolle === "anbieter" ? meta?.zustimmungAnbieter : meta?.zustimmungSuchender;
  const hinweis = ctx.vorgang?.hinweise?.[rolle];
  if (zust) out.push({ text: `Zustimmung ✓ ${tag(zust)}`, art: "ok", tipp: meta?.zustimmungQuelle?.[rolle] === "kunde" ? "Selbst im Kundenbereich zugestimmt" : `Zustimmung erfasst von ${meta?.zustimmungQuelle?.[rolle] ?? "der Verwaltung"}` });
  else if (meta?.ablehnung?.rolle === rolle) out.push({ text: `kein Interesse ${tag(meta.ablehnung.am)}`, art: "rot", tipp: meta.ablehnung.grund ? `Begründung: ${meta.ablehnung.grund}` : "Im Kundenbereich „kein Interesse“ gemeldet" });
  else if (hinweis) out.push({ text: `anonym angefragt ${tag(hinweis)}`, art: "warn", tipp: "Anonymer Hinweis gesendet — die Zustimmung fehlt noch" });

  // Pacht- bzw. Kaufvertrag in der Unterschrift / Bestätigung.
  const pv = ctx.vorgang?.pachtvertrag;
  if (pv?.status === "zur_unterschrift") {
    const s = pv.unterschriften[rolle === "anbieter" ? "verpaechter" : "paechter"];
    out.push(s ? { text: `Pachtvertrag ✓ ${tag(s.am)}`, art: "ok", tipp: "Pachtvertrag online unterschrieben" } : { text: "Pachtvertrag offen", art: "warn", tipp: "Die Unterschrift unter dem Pachtvertrag fehlt noch" });
  }
  const kauf = ctx.vorgang?.kauf;
  if (kauf?.status === "zur_bestaetigung") {
    const s = kauf.bestaetigungen[rolle === "anbieter" ? "verkaeufer" : "kaeufer"];
    out.push(s ? { text: `Eckdaten ✓ ${tag(s.am)}`, art: "ok", tipp: "Eckdaten für den Notar bestätigt" } : { text: "Eckdaten offen", art: "warn", tipp: "Die Bestätigung der Eckdaten fehlt noch" });
  }
  return out;
}

function provisionChip(v: M.VorgangRecord | null): Chip | null {
  const p = v?.provisionen.find((x) => x.status !== "storniert" && x.status !== "bezahlt") ?? v?.provisionen.find((x) => x.status !== "storniert");
  if (!p) return null;
  const netto = M.provisionNachGutschein(p).netto;
  return {
    text: `Provision ${M.PROVISION_STATUS[p.status].label}: ${M.euro(netto)} netto`,
    art: p.status === "bezahlt" ? "ok" : p.status === "aufschiebend" ? "grau" : "warn",
    tipp: M.PROVISION_STATUS[p.status].tipp,
  };
}

/** Das Dashboard einmal pro Seitenaufruf laden (Layout und Seite teilen sich das Ergebnis). */
export const ladeDashboard = cache(async (email: string): Promise<Dashboard> => {
  const [{ leads, zustand }, portal, neu, basis] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email), basisUrl()]);
  const jetzt = new Date();
  const byId = new Map(leads.map((l) => [l.id, l]));
  const u = { einstellungen: portal.einstellungen, basis, bewertungsUrl: M.bewertungsUrl(portal.einstellungen, process.env.GOOGLE_REVIEW_URL), jetzt };

  const jetztDran: DashVorgang[] = [];
  const warten: DashVorgang[] = [];
  const abgeschlossen: DashVorgang[] = [];
  const gesehen: string[] = [];

  for (const [key, meta] of Object.entries(zustand.paare)) {
    if (meta.status === "vorschlag" || meta.status === "verworfen") continue;
    const [aId, gId] = key.split("~");
    const angebot = byId.get(aId);
    const gesuch = byId.get(gId);
    if (!angebot || !gesuch) continue;
    const vorgang = portal.vorgaenge.get(key) ?? null;
    const anbieter = portal.kunden.get(aId) ?? null;
    const suchender = portal.kunden.get(gId) ?? null;
    const art: M.Art = vorgang?.art ?? (angebot.art === "kauf" ? "kauf" : "pacht");
    const ctx: VorgangKontext = { key, art, meta, vorgang, angebot, gesuch, anbieter, suchender, zustand };
    let plan: AssistentPlan;
    try {
      plan = assistentPlan(ctx, u);
    } catch (err) {
      // Ein kaputter Datensatz darf das Dashboard nicht lahmlegen.
      console.error("[dashboard] Plan nicht berechenbar", key, err);
      continue;
    }
    const sch = vorgangSchritte({ art, meta, vorgang, anbieter, suchender }, jetzt);
    const x: DashVorgang = {
      key,
      art,
      anbieter: anbieter?.stammdaten?.name || T.wert(angebot.name) || aId,
      suchender: suchender?.stammdaten?.name || T.wert(gesuch.name) || gId,
      seiten: [
        { rolle: "anbieter", name: anbieter?.stammdaten?.name || T.wert(angebot.name) || aId, chips: chipsFuer(ctx, "anbieter", jetzt) },
        { rolle: "suchender", name: suchender?.stammdaten?.name || T.wert(gesuch.name) || gId, chips: chipsFuer(ctx, "suchender", jetzt) },
      ],
      schritte: sch.schritte,
      aktuell: sch.aktuell,
      plan,
      neu: neu.vorgang(vorgang).length + neu.kunde(anbieter).length + neu.kunde(suchender).length,
      abschluss: vorgang?.abschluss?.am ?? null,
      provision: provisionChip(vorgang),
      zuletzt: [vorgang?.ereignisse[0]?.am, anbieter?.ereignisse[0]?.am, suchender?.ereignisse[0]?.am, meta.geaendert?.am].filter(Boolean).sort().at(-1) ?? "",
    };
    // Einsortieren: Ist die Verwaltung am Zug, steht der Vorgang unter „Jetzt dran“ —
    // auch nach dem Abschluss (z. B. fällige Provision abrechnen).
    if (plan.amZug !== "admin" && (x.abschluss || plan.fertig)) {
      abgeschlossen.push(x);
      continue;
    }
    (plan.amZug === "admin" ? jetztDran : warten).push(x);
    // Sichtbare Karten gelten nach dem Anzeigen als gesehen (die aktuelle Ansicht pulsiert weiter).
    if (vorgang) gesehen.push(`vorgang:${key}`);
    if (anbieter) gesehen.push(`kunde:${aId}`);
    if (suchender) gesehen.push(`kunde:${gId}`);
  }
  const neueste = (a: DashVorgang, b: DashVorgang) => b.zuletzt.localeCompare(a.zuletzt);
  jetztDran.sort(neueste);
  warten.sort(neueste);
  abgeschlossen.sort(neueste);

  const vorschlaege: DashVorschlag[] = findeKandidaten(leads, zustand)
    .kandidaten.filter((k) => !k.meta || k.meta.status === "vorschlag")
    .map((k) => ({ key: k.key, angebot: k.angebot, gesuch: k.gesuch, score: k.score, distanzKm: k.distanzKm, gruende: k.gruende, neu: neu.vorschlag(k.key) }));
  for (const v of vorschlaege) gesehen.push(`paar:${v.key}`);

  let provisionOffen = 0;
  let provisionFaellig = 0;
  for (const v of portal.vorgaenge.values()) {
    for (const p of v.provisionen) {
      if (p.status === "storniert" || p.status === "bezahlt") continue;
      provisionOffen += M.provisionNachGutschein(p).netto ?? 0;
      if (p.status === "faellig") provisionFaellig++;
    }
  }

  return { jetzt: jetztDran, warten, abgeschlossen, vorschlaege, provisionOffen: M.runde2(provisionOffen), provisionFaellig, gesehen, einstellungen: portal.einstellungen };
});
