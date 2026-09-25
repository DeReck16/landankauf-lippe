import "server-only";
import { cache } from "react";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten } from "@/lib/admin/matching";
import { formatGroesse, type LeadView, type Rueckmeldung } from "@/lib/admin/model";
import { boerseLuecken, haText } from "@/lib/boerse";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import type { AnfrageVorschlag, AntwortEntwurf, NachfassKandidat } from "./anfrage-typen";
import { anfrageVorschlagSicher } from "./anfrage-vorschlag";
import { anbieterAbgleich } from "./anbieter-gruppe";
import { antwortEntwurf } from "./antwort";
import { katasterNachholen } from "./kataster";
import { assistentPlan, type AssistentChip, type AssistentPlan } from "./assistent";
import * as M from "./model";
import { nachfassKandidaten, nachfassTage } from "./nachfassen";
import { vorgangSchritte, type Schritt } from "./schritte";
import { basisUrl } from "./sitzung";
import * as T from "./texte";
import type { VorgangKontext } from "./vorgang";

// Daten für das Dashboard (/admin/dashboard): jeder Vorgang mit dem Plan des
// Assistenten (lib/portal/assistent.ts), einsortiert nach „Jetzt dran“ (die
// Verwaltung ist am Zug), „Warten“ und „Abgeschlossen & beendet“, dazu die
// unbearbeiteten Vorschläge aus dem Matching, neue Anfragen ohne Paar und die
// Rückmeldungen auf Nachfass-Mails als Tickets. Keine eigene Ablauf-Logik — die
// Knöpfe führen die Aktionen des Assistenten aus.

export type DashSeite = { rolle: M.Rolle; name: string; chips: AssistentChip[] };
export type DashEreignis = { id: string; am: string; text: string; wer: string; neu: boolean };

export type DashVorgang = {
  key: string;
  art: M.Art;
  anbieter: string;
  suchender: string;
  seiten: DashSeite[];
  schritte: Schritt[];
  aktuell: Schritt | null;
  plan: AssistentPlan;
  /** Die neuesten Ereignisse (neue zuerst markiert) — höchstens drei. */
  ereignisse: DashEreignis[];
  /** Neue Kundenereignisse seit dem letzten Besuch. */
  neu: number;
  /** Gesuch kam über die Flächenbörse (Kennung des Angebots). */
  boerse: string | null;
  /** Zuletzt etwas passiert (zum Sortieren). */
  zuletzt: string;
};

export type DashVorschlag = { key: string; angebot: LeadView; gesuch: LeadView; score: number | null; distanzKm: number | null; gruende: string[]; hinweise: string[]; neu: boolean; boerse: string | null };

/**
 * Neue Anfrage ohne Paar — mit dem einen vorgeschlagenen Schritt (lib/portal/anfrage-vorschlag.ts):
 * Angebote/Gesuche die Einladung, reine Auskünfte das fertige Antwortschreiben (lib/portal/antwort.ts).
 */
export type DashAnfrage = { id: string; name: string; anliegen: string; ort: string; eingang: string; neu: boolean; vorschlag: AnfrageVorschlag; antwort: AntwortEntwurf | null };

/**
 * Rückmeldung auf eine Nachfass-Mail als Ticket: offen, solange die Anfrage auf „Neu“ steht
 * (lib/portal/rueckmeldung.ts). Verkaufen/Verpachten/Suche bekommen den Vorschlag wie eine
 * neue Anfrage (meist „Einladen“), eine Beratung „Antwort schreiben“ + „Als beantwortet markieren“.
 */
export type DashRueckmeldung = {
  id: string;
  name: string;
  anliegen: string;
  ort: string;
  eingang: string;
  r: Rueckmeldung;
  neu: boolean;
  vorschlag: AnfrageVorschlag | null;
  /** Beratung: fertiges Antwortschreiben zum gewählten Thema (lib/portal/antwort.ts). */
  antwort: AntwortEntwurf | null;
  /** Beratung ohne Entwurf: neue E-Mail an den Kunden im eigenen Mailprogramm. */
  antworten: { href: string; an: string } | null;
};

/** Angebot für die Flächenbörse (Kauf oder Pacht, aktiv). */
export type DashBoerse = {
  id: string;
  name: string;
  eckdaten: string;
  code: string | null;
  online: boolean;
  seit: string | null;
  einwilligung: { am: string; quelle: string } | null;
  /** Was einer Veröffentlichung im Weg steht (leer = ein Klick genügt). */
  luecken: string[];
};

/** Zahlen für die Übersichtskacheln (Stand aller Kunden, Paare und der Börse). */
export type DashUebersicht = {
  eingeladen: number;
  eingeladenGeoeffnet: number;
  unterschrieben: number;
  unterschriebenAnbieter: number;
  unterschriebenSuchende: number;
  matchingOffen: number;
  zustimmungOffen: number;
  freigegeben: number;
  vertraegeOffen: number;
  abschluesse: number;
  boerseOnline: number;
  boerseBereit: number;
  boerseAngabenFehlen: number;
  boerseOhneEinwilligung: number;
  neueAnfragen: number;
};

export type Dashboard = {
  uebersicht: DashUebersicht;
  boerse: DashBoerse[];
  jetzt: DashVorgang[];
  warten: DashVorgang[];
  abgeschlossen: DashVorgang[];
  vorschlaege: DashVorschlag[];
  anfragen: DashAnfrage[];
  /** Offene Tickets aus Rückmeldungen auf Nachfass-Mails, neueste zuerst. */
  rueckmeldungen: DashRueckmeldung[];
  /** „Kein Interesse“ der letzten 30 Tage — automatisch erledigt, nur zur Info. */
  keinInteresse: DashRueckmeldung[];
  /** Alte Anfragen ohne Rückmeldung, bei denen Nachfassen möglich ist (lib/portal/nachfassen.ts). */
  nachfassen: NachfassKandidat[];
  /** Nachfassen ab so vielen Tagen nach Eingang und letztem Kontakt. */
  nachfassTage: number;
  /** Provision netto, noch nicht bezahlt: fällig + abgerechnet. */
  provisionOffen: number;
  /** Davon aufschiebend (noch nicht fällig, z. B. Genehmigung ausstehend). */
  provisionAufschiebend: number;
  /** Fällige oder überfällige Provisionen (Handlungsbedarf). */
  provisionDran: number;
  /** Diese Einträge gelten nach dem Anzeigen als gesehen (Pulsieren). */
  gesehen: string[];
  einstellungen: M.Einstellungen;
  am: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEIN_INTERESSE_TAGE = 30;

/** Antwortentwurf — ein kaputter Datensatz legt das Dashboard nicht lahm (dann ohne Entwurf). */
function antwortSicher(l: LeadView, k: M.KundeRecord | null, basis: string, r?: Rueckmeldung): AntwortEntwurf | null {
  try {
    return antwortEntwurf({ lead: l, kunde: k, basis, rueckmeldung: r });
  } catch (err) {
    console.error("[dashboard] Antwortentwurf nicht berechenbar", l.id, err);
    return null;
  }
}

function tag(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

function wer(von: string): string {
  if (von === "kunde" || von.startsWith("kunde:")) return "Kunde";
  if (von === "system") return "System";
  if (von === "cron") return "Automatik";
  return von.split("@")[0];
}

/** Status-Chips einer Seite mit Datum: Einladung → Link geöffnet → Vertrag mit Lippe Forst → Zustimmung → Pachtvertrag. */
function chipsFuer(ctx: VorgangKontext, rolle: M.Rolle, jetzt: Date): AssistentChip[] {
  const k = rolle === "anbieter" ? ctx.anbieter : ctx.suchender;
  const out: AssistentChip[] = [];
  if (!k) return [{ text: "nicht eingeladen", art: "grau", tipp: "Noch keine Kundenakte — der Assistent lädt ein" }];
  if (k.widerruf) out.push({ text: `Vertrag widerrufen am ${tag(k.widerruf.am)}`, art: "rot", tipp: "Vertrag mit Lippe Forst widerrufen — keine Freigabe, keine Weitergabe von Daten" });
  if (k.kuendigung) out.push({ text: `Vertrag gekündigt am ${tag(k.kuendigung.am)}`, art: "rot", tipp: "Vertrag mit Lippe Forst gekündigt — keine neuen Vorstellungen" });
  if (k.gesperrt) out.push({ text: "Zugang gesperrt", art: "rot", tipp: "Zugang zum Kundenbereich gesperrt — in der Anfrage entsperren" });

  if (k.vertrag) {
    out.push({
      text: `Vertrag mit Lippe Forst unterschrieben am ${tag(k.vertrag.signatur.am)}${k.vertrag.uebernommenVon ? ` (über ${k.vertrag.uebernommenVon})` : ""}`,
      art: "ok",
      tipp: `„${k.vertrag.titel}“ online unterschrieben von „${k.vertrag.signatur.name}“${k.vertrag.uebernommenVon ? ` — über Anfrage ${k.vertrag.uebernommenVon}, gilt für alle Flächen dieses Anbieters` : ""}`,
    });
  } else {
    const e = k.einladung;
    const erinnert = k.mails.find((m) => m.zweck === "erinnerung" && m.ok)?.am;
    if (!e) {
      out.push({ text: k.stammdaten ? "kein gültiger Einladungslink" : "nicht eingeladen", art: k.stammdaten ? "warn" : "grau", tipp: "Kein gültiger Einladungslink — der Assistent erstellt beim Einladen bzw. Erinnern einen neuen" });
    } else {
      const gesendet = e.gesendetAm ?? k.mails.find((m) => (m.zweck === "einladung" || m.zweck === "erinnerung") && m.ok)?.am;
      out.push(
        e.ueber
          ? { text: `eingeladen über ${e.ueber}`, art: "ok", tipp: `Gleicher Anbieter: Die Einladung läuft über Anfrage ${e.ueber} — eine Vereinbarung gilt für alle seine Flächen, keine zweite Mail` }
          : gesendet
            ? { text: `Einladung gesendet am ${tag(gesendet)}`, art: "ok", tipp: "Einladungs-Mail mit dem persönlichen Link ist raus" }
            : { text: "Link erstellt, nicht gesendet", art: "warn", tipp: "Der Einladungslink besteht, die Einladungs-Mail ist aber noch nicht raus" },
      );
      if (Date.parse(e.bis) < jetzt.getTime()) out.push({ text: `Link abgelaufen am ${tag(e.bis)}`, art: "rot", tipp: "Der Einladungslink ist abgelaufen — „Erinnerung senden“ erstellt automatisch einen neuen" });
      if (erinnert) out.push({ text: `erinnert am ${tag(erinnert)}`, art: "grau", tipp: "Letzte Erinnerungs-Mail" });
      if (e.angenommenAm) out.push({ text: `Link geöffnet am ${tag(e.angenommenAm)}`, art: "ok", tipp: "Der Kunde hat den Kundenbereich über den Link betreten" });
    }
    if (k.stammdaten) out.push({ text: "Angaben gemacht", art: "ok", tipp: "Name und Anschrift sind erfasst — die Unterschrift unter dem Vertrag mit Lippe Forst fehlt noch" });
  }

  // Widerrufsfrist (nur Suchende als Verbraucher) — bis zur Freigabe.
  if (k.vertrag && !k.widerruf && M.hatWiderrufsrecht(k) && !M.aktiveFreigabe(ctx.vorgang) && !ctx.vorgang?.abschluss) {
    if (k.vertrag.beginnwunschAm) {
      out.push({ text: `Beginnwunsch am ${tag(k.vertrag.beginnwunschAm)}`, art: "ok", tipp: "Der Kunde möchte schon vor Ablauf der Widerrufsfrist Kontakte erhalten (§ 356 Abs. 4 BGB)" });
    } else if (!k.vertrag.bestaetigungGesendetAm) {
      out.push({ text: "Vertragsbestätigung fehlt", art: "rot", tipp: "Die Vertragsbestätigung mit PDF ist nicht versandt — Voraussetzung der Freigabe (Kundenakte → „Bestätigung erneut senden“)" });
    } else {
      const ab = (k.vertrag.widerrufsfristEnde ? Date.parse(k.vertrag.widerrufsfristEnde) : 0) + M.WIDERRUF_PUFFER_TAGE * 86_400_000;
      if (ab > jetzt.getTime()) out.push({ text: `Freigabe ab ${tag(new Date(ab).toISOString())}`, art: "warn", tipp: "Widerrufsfrist + 4 Tage Puffer — oder früher, wenn der Kunde im Kundenbereich den Beginnwunsch erklärt" });
    }
  }

  // Zustimmung zum Kontakt.
  const meta = ctx.meta;
  const zust = rolle === "anbieter" ? meta?.zustimmungAnbieter : meta?.zustimmungSuchender;
  const hinweis = ctx.vorgang?.hinweise?.[rolle];
  if (zust) {
    const q = meta?.zustimmungQuelle?.[rolle];
    out.push({ text: `Zustimmung ✓ am ${tag(zust)}`, art: "ok", tipp: q === "kunde" ? "Selbst im Kundenbereich zugestimmt" : `Zustimmung erfasst von ${q ?? "der Verwaltung"} (Telefon/E-Mail)` });
  } else if (meta?.ablehnung?.rolle === rolle) {
    out.push({ text: `kein Interesse am ${tag(meta.ablehnung.am)}`, art: "rot", tipp: meta.ablehnung.grund ? `Begründung: ${meta.ablehnung.grund}` : "Im Kundenbereich „kein Interesse“ gemeldet" });
  } else if (hinweis) {
    out.push({ text: `anonym angefragt am ${tag(hinweis)}`, art: "warn", tipp: "Anonymer Hinweis mit Zustimmungslink gesendet — die Zustimmung fehlt noch" });
  }

  // Pacht- bzw. Kaufvertrag in der Unterschrift / Bestätigung.
  const pv = ctx.vorgang?.pachtvertrag;
  if (pv?.status === "zur_unterschrift") {
    const s = pv.unterschriften[rolle === "anbieter" ? "verpaechter" : "paechter"];
    out.push(s ? { text: `Pachtvertrag unterschrieben am ${tag(s.am)}`, art: "ok", tipp: "Den Landpachtvertrag online unterschrieben" } : { text: "Pachtvertrag: Unterschrift fehlt", art: "warn", tipp: "Die Unterschrift unter dem Landpachtvertrag fehlt noch" });
  }
  const kauf = ctx.vorgang?.kauf;
  if (kauf?.status === "zur_bestaetigung") {
    const s = kauf.bestaetigungen[rolle === "anbieter" ? "verkaeufer" : "kaeufer"];
    out.push(s ? { text: `Eckdaten bestätigt am ${tag(s.am)}`, art: "ok", tipp: "Eckdaten für den Notar bestätigt" } : { text: "Eckdaten: Bestätigung fehlt", art: "warn", tipp: "Die Bestätigung der Eckdaten fehlt noch" });
  }
  return out;
}

/** Die neuesten Ereignisse des Vorgangs und beider Kundenakten: neue (ungesehene) zuerst, sonst das letzte. */
function ereignisseFuer(v: M.VorgangRecord | null, a: M.KundeRecord | null, s: M.KundeRecord | null, neuIds: Set<string>): DashEreignis[] {
  const alle = [...(v?.ereignisse ?? []), ...(a?.ereignisse ?? []), ...(s?.ereignisse ?? [])]
    .filter((e) => e.art !== "mail")
    .sort((x, y) => y.am.localeCompare(x.am));
  const neue = alle.filter((e) => neuIds.has(e.id)).slice(0, 3);
  const liste = neue.length ? neue : alle.slice(0, 1);
  return liste.map((e) => ({ id: e.id, am: e.am, text: e.text, wer: wer(e.von), neu: neuIds.has(e.id) }));
}

/** Das Dashboard einmal pro Seitenaufruf laden (Layout und Seite teilen sich das Ergebnis). */
export const ladeDashboard = cache(async (email: string): Promise<Dashboard> => {
  const [{ leads, zustand }, portal, neu, basis] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email), basisUrl()]);
  const jetzt = new Date();
  const byId = new Map(leads.map((l) => [l.id, l]));
  const u = { einstellungen: portal.einstellungen, basis, bewertungsUrl: M.bewertungsUrl(portal.einstellungen, process.env.GOOGLE_REVIEW_URL), jetzt, kunden: portal.kunden };

  const jetztDran: DashVorgang[] = [];
  const warten: DashVorgang[] = [];
  const abgeschlossen: DashVorgang[] = [];
  const gesehen: string[] = [];

  // Anbieter mit mehreren Flächen: eine Einladung, eine Unterschrift — Vereinbarung übertragen bzw.
  // laufende Einladung vermerken, bevor die Vorgänge berechnet werden (lib/portal/anbieter-gruppe.ts).
  try {
    await anbieterAbgleich({ leads, kunden: portal.kunden, zustand, von: email });
  } catch (err) {
    console.error("[dashboard] Anbieter-Abgleich fehlgeschlagen", err);
  }

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
    const neuIds = new Set([...neu.vorgang(vorgang), ...neu.kunde(anbieter), ...neu.kunde(suchender)].map((e) => e.id));
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
      ereignisse: ereignisseFuer(vorgang, anbieter, suchender, neuIds),
      neu: neuIds.size,
      boerse: gesuch.boerse && gesuch.boerse !== "—" ? gesuch.boerse : null,
      zuletzt: [vorgang?.ereignisse[0]?.am, anbieter?.ereignisse[0]?.am, suchender?.ereignisse[0]?.am, meta.geaendert?.am].filter(Boolean).sort().at(-1) ?? "",
    };
    if (plan.amZug === "admin") jetztDran.push(x);
    else if (plan.amZug === "kunde") warten.push(x);
    else {
      abgeschlossen.push(x);
      continue;
    }
    // Sichtbare Karten gelten nach dem Anzeigen als gesehen (die aktuelle Ansicht pulsiert weiter).
    if (vorgang) gesehen.push(`vorgang:${key}`);
    if (anbieter) gesehen.push(`kunde:${aId}`);
    if (suchender) gesehen.push(`kunde:${gId}`);
  }
  const neueste = (a: DashVorgang, b: DashVorgang) => b.zuletzt.localeCompare(a.zuletzt);
  jetztDran.sort(neueste);
  // Beim Warten zuerst, was am längsten wartet.
  warten.sort((a, b) => (a.plan.wartetSeit ?? "9").localeCompare(b.plan.wartetSeit ?? "9"));
  abgeschlossen.sort(neueste);

  const { kandidaten } = findeKandidaten(leads, zustand);
  const vorschlaege: DashVorschlag[] = kandidaten
    .filter((k) => !k.meta || k.meta.status === "vorschlag")
    .map((k) => ({
      key: k.key,
      angebot: k.angebot,
      gesuch: k.gesuch,
      score: k.score,
      distanzKm: k.distanzKm,
      gruende: k.gruende,
      hinweise: k.hinweise,
      neu: neu.vorschlag(k.key),
      boerse: k.gesuch.boerse && k.gesuch.boerse !== "—" ? k.gesuch.boerse : null,
    }));
  for (const v of vorschlaege) gesehen.push(`paar:${v.key}`);

  // Amtliche Kataster-Daten (Flurstück, Bodenrichtwert) für die Antwortentwürfe einmalig nachholen —
  // z. B. für Anfragen von vor der Einführung; danach stehen sie im Verwaltungszustand (LeadMeta.kataster).
  const fuerEntwurf = leads.filter((l) => l.status === "neu" && (l.meta.rueckmeldung?.art === "beratung" || !T.rolleVonLead(l)));
  const neuKataster = await katasterNachholen(fuerEntwurf, 14_000);
  for (const l of leads) if (neuKataster[l.id]) l.meta = { ...l.meta, kataster: neuKataster[l.id] };

  // Rückmeldungen auf Nachfass-Mails: offen, solange die Anfrage auf „Neu“ steht (jede Bearbeitung ändert den Status).
  const offeneTickets = new Set<string>();
  const rueckmeldungen: DashRueckmeldung[] = [];
  const keinInteresse: DashRueckmeldung[] = [];
  for (const l of leads) {
    const r = l.meta.rueckmeldung;
    if (!r || l.status === "archiv") continue;
    const k = portal.kunden.get(l.id) ?? null;
    const name = k?.stammdaten?.name || T.wert(l.name) || l.id;
    const eintrag = {
      id: l.id,
      name,
      anliegen: T.wert(l.intent) || "—",
      ort: l.ortText || T.wert(l.ort) || "Ort offen",
      eingang: l.receivedAt,
      r,
      // Selbst erfasste Antworten pulsieren für die erfassende Person nicht (wie überall: Neues von anderen).
      neu: r.von !== email && (neu.gesehen[`rueckmeldung:${l.id}`] ?? "") < r.am,
    };
    if (r.art === "kein-interesse") {
      if (l.status === "erledigt" && jetzt.getTime() - Date.parse(r.am) < KEIN_INTERESSE_TAGE * 86_400_000) keinInteresse.push({ ...eintrag, vorschlag: null, antwort: null, antworten: null });
      continue;
    }
    if (l.status !== "neu") continue;
    offeneTickets.add(l.id);
    const an = (k?.email || T.wert(l.email)).toLowerCase();
    const beratung = r.art === "beratung";
    // Im laufenden Vorgang keine Einladung vorschlagen — dort wird entschieden (Link zum Vorgang in der Zeile).
    const imVorgang = Boolean(r.vorgaenge?.length);
    const antwort = beratung ? antwortSicher(l, k, basis, r) : null;
    const thema = r.thema && r.thema !== "Etwas anderes" ? ` zum Thema „${r.thema}“` : "";
    const anrede = `Guten Tag ${name},\n\nvielen Dank für Ihre Rückmeldung. Gern beraten wir Sie${thema}.\n\n`;
    rueckmeldungen.push({
      ...eintrag,
      vorschlag: beratung || imVorgang ? null : anfrageVorschlagSicher(l, k, u),
      antwort,
      antworten:
        beratung && !antwort && EMAIL.test(an)
          ? { href: `mailto:${an}?subject=${encodeURIComponent("Ihre Beratungsanfrage bei Lippe Forst")}&body=${encodeURIComponent(anrede)}`, an }
          : null,
    });
  }
  rueckmeldungen.sort((a, b) => b.r.am.localeCompare(a.r.am));
  keinInteresse.sort((a, b) => b.r.am.localeCompare(a.r.am));
  for (const x of [...rueckmeldungen, ...keinInteresse]) gesehen.push(`rueckmeldung:${x.id}`);

  // Neue Anfragen, die in keinem Paar und keinem Vorschlag vorkommen (offene Tickets stehen unter „Rückmeldungen“).
  const imPaar = new Set<string>();
  for (const key of Object.keys(zustand.paare)) for (const id of key.split("~")) imPaar.add(id);
  for (const k of kandidaten) {
    imPaar.add(k.angebot.id);
    imPaar.add(k.gesuch.id);
  }
  const anfragen: DashAnfrage[] = leads
    .filter((l) => l.status === "neu" && !imPaar.has(l.id) && !offeneTickets.has(l.id))
    .map((l) => ({
      id: l.id,
      name: T.wert(l.name) || l.id,
      anliegen: T.wert(l.intent) || "—",
      ort: l.ortText || T.wert(l.ort) || "Ort offen",
      eingang: l.receivedAt,
      neu: neu.anfrage(l),
      vorschlag: anfrageVorschlagSicher(l, portal.kunden.get(l.id) ?? null, u),
      // Reine Auskünfte (weder Angebot noch Gesuch): fertiges Antwortschreiben zur Freigabe.
      antwort: T.rolleVonLead(l) ? null : antwortSicher(l, portal.kunden.get(l.id) ?? null, basis),
    }));
  for (const a of anfragen) gesehen.push(`anfrage:${a.id}`);

  // Nachfassen: alte Anfragen ohne Rückmeldung — neu (pulsierend), bis die Liste sie einmal gezeigt hat.
  const nachfassTageWert = nachfassTage();
  const nachfassen = nachfassKandidaten({ leads, zustand, kunden: portal.kunden, vorgaenge: portal.vorgaenge, jetzt, basis, tage: nachfassTageWert }).map((c) => ({
    ...c,
    neu: (neu.gesehen[`nachfassen:${c.id}`] ?? "") < c.seit,
  }));
  for (const c of nachfassen) gesehen.push(`nachfassen:${c.id}`);

  let provisionOffen = 0;
  let provisionAufschiebend = 0;
  let provisionDran = 0;
  const heuteStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
  for (const v of portal.vorgaenge.values()) {
    for (const p of v.provisionen) {
      const netto = M.provisionNachGutschein(p).netto ?? 0;
      if (p.status === "faellig" || p.status === "abgerechnet") provisionOffen += netto;
      if (p.status === "aufschiebend") provisionAufschiebend += netto;
      if (p.status === "faellig" || (p.status === "abgerechnet" && (M.provisionZahlungBis(p) ?? "9999-12-31") < heuteStr)) provisionDran++;
    }
  }

  // Übersicht: Kunden nach Stufe, Paare nach Stand, Flächenbörse.
  const ue: DashUebersicht = {
    eingeladen: 0, eingeladenGeoeffnet: 0, unterschrieben: 0, unterschriebenAnbieter: 0, unterschriebenSuchende: 0,
    matchingOffen: 0, zustimmungOffen: 0, freigegeben: 0, vertraegeOffen: 0, abschluesse: 0,
    boerseOnline: 0, boerseBereit: 0, boerseAngabenFehlen: 0, boerseOhneEinwilligung: 0,
    neueAnfragen: leads.filter((l) => l.status === "neu").length,
  };
  for (const k of portal.kunden.values()) {
    const st = M.stufe(k);
    if (st === "eingeladen" || st === "geoeffnet" || st === "angaben") {
      ue.eingeladen++;
      if (st !== "eingeladen") ue.eingeladenGeoeffnet++;
    } else if (st === "unterschrieben") {
      ue.unterschrieben++;
      if (k.rolle === "anbieter") ue.unterschriebenAnbieter++;
      else ue.unterschriebenSuchende++;
    }
  }
  for (const [key, meta] of Object.entries(zustand.paare)) {
    if (meta.status === "vorschlag" || meta.status === "verworfen") continue;
    const v = portal.vorgaenge.get(key) ?? null;
    if (v?.abschluss) {
      ue.abschluesse++;
      continue;
    }
    if (M.aktiveFreigabe(v)) {
      ue.freigegeben++;
      if (v?.pachtvertrag?.status === "zur_unterschrift" || v?.kauf?.status === "zur_bestaetigung") ue.vertraegeOffen++;
      continue;
    }
    ue.matchingOffen++;
    const angefragt = meta.status === "angefragt" || Boolean(v?.hinweise?.anbieter || v?.hinweise?.suchender);
    if (angefragt && !(meta.zustimmungAnbieter && meta.zustimmungSuchender)) ue.zustimmungOffen++;
  }
  const boerse: DashBoerse[] = [];
  for (const l of leads) {
    if (l.rolle !== "angebot" || (l.art !== "kauf" && l.art !== "pacht") || l.status === "archiv" || l.status === "erledigt") continue;
    const b = l.meta.boerse;
    const luecken = b ? boerseLuecken(b, l) : ["Einwilligung des Eigentümers fehlt"];
    const eintrag: DashBoerse = {
      id: l.id,
      name: T.wert(l.name) || l.id,
      eckdaten: `${l.art === "pacht" ? "Pacht" : "Kauf"} · ` + (b ? `${b.typ || l.typ}, ${haText(b.groesseHa)}, ${b.lage || "Lage offen"}` : `${l.typ}, ${formatGroesse(l.groesseWert)}, ${l.ortText || "Ort offen"}`),
      code: b?.code ?? null,
      online: Boolean(b?.online),
      seit: b?.seit ?? null,
      einwilligung: b?.einwilligung ? { am: b.einwilligung.am, quelle: b.einwilligung.quelle } : null,
      luecken,
    };
    boerse.push(eintrag);
    if (eintrag.online) ue.boerseOnline++;
    else if (!eintrag.einwilligung) ue.boerseOhneEinwilligung++;
    else if (luecken.length) ue.boerseAngabenFehlen++;
    else ue.boerseBereit++;
  }
  // Reihenfolge: bereit zum Veröffentlichen, Angaben fehlen, ohne Einwilligung, online.
  const rang = (x: DashBoerse) => (x.online ? 3 : !x.einwilligung ? 2 : x.luecken.length ? 1 : 0);
  boerse.sort((a, b) => rang(a) - rang(b));

  return {
    uebersicht: ue,
    boerse,
    jetzt: jetztDran,
    warten,
    abgeschlossen,
    vorschlaege,
    anfragen,
    rueckmeldungen,
    keinInteresse,
    nachfassen,
    nachfassTage: nachfassTageWert,
    provisionOffen: M.runde2(provisionOffen),
    provisionAufschiebend: M.runde2(provisionAufschiebend),
    provisionDran,
    gesehen,
    einstellungen: portal.einstellungen,
    am: jetzt.toISOString(),
  };
});
