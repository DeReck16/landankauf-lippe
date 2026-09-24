import "server-only";
import { createHash } from "node:crypto";
import { testModus } from "@/lib/admin/config";
import type { LeadView } from "@/lib/admin/model";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";
import { einladungsLink } from "./ablauf";
import type {
  AssistentAktion,
  AssistentChip,
  AssistentFeld,
  AssistentHinweis,
  AssistentLink,
  AssistentMail,
  AssistentMeldung,
  AssistentPlan,
  AssistentWarten,
} from "./assistent-typen";
import { entwuerfeKunde, entwuerfePaar, type Entwurf, type MailZweck } from "./entwuerfe";
import * as M from "./model";
import { SPERRE_FREIGABE, vertragGueltig, vorgangSchritte } from "./schritte";
import * as T from "./texte";
import { einladungBis } from "./token";
import { bewertungFaellig, freigabePruefung, kaufVorschlag, pachtLuecken, pachtVorschlag, type VorgangKontext } from "./vorgang";

export * from "./assistent-typen";

// Klick-Assistent je Vorgang: Aus dem Stand der sieben Schritte (schritte.ts),
// den Meldungen der Kunden und den Nacharbeiten (Provision, Pachtanzeige) ergibt
// sich genau EIN Hauptknopf — mit allem, was dabei passiert, und den Mails
// (Empfänger, Betreff, Volltext aus entwuerfe.ts), die dabei rausgehen. Dazu
// ruhige Zusatzknöpfe und „Weitere Aktionen“ gegen Sackgassen. Ausgeführt wird in
// app/admin/assistent-actions.ts: Der Plan wird dort frisch berechnet und nur
// ausgeführt, wenn er noch dem bestätigten Stand entspricht (Signatur). Jede
// Teilaktion ruft die bestehenden Funktionen mit ihren Sperren auf. Ohne Klick
// passiert nichts — es gibt keinen automatischen Versand.

export type AssistentUmgebung = {
  einstellungen: M.Einstellungen;
  /** Basis-URL für die Links in den Mails. */
  basis: string;
  bewertungsUrl: string | null;
  jetzt?: Date;
};

type Seite = {
  rolle: M.Rolle;
  k: M.KundeRecord | null;
  l: LeadView;
  /** „Anbieter“ bzw. „Suchender“ */
  wer: string;
  /** Für Knöpfe: „Anbieter“ bzw. „Suchenden“ (… einladen) */
  akk: string;
  artikel: (typeof M.ROLLE_ARTIKEL)[M.Rolle];
  name: string;
  an: string;
};

type Bau = { ctx: VorgangKontext; u: AssistentUmgebung; jetzt: Date; seiten: Seite[] };

type Aktion = Omit<AssistentAktion, "signatur">;
type MeldungRoh = Omit<AssistentMeldung, "aktionen"> & { aktionen: Aktion[] };

/** Teilergebnis; `extra` fließt nur in die Signatur ein. */
type Teil = {
  stand: string;
  warten?: AssistentWarten[];
  hinweise?: AssistentHinweis[];
  aktion?: Aktion | null;
  neben?: (Aktion | null)[];
  chips?: AssistentChip[];
  /** Es wird auf Kunden, Notar, Behörde oder Zahlung gewartet (sonst ist die Verwaltung am Zug). */
  wartet?: boolean;
  /** Nach dem Abschluss ist noch etwas offen (Provision, Pachtanzeige). */
  nachOffen?: boolean;
  extra?: unknown;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUER_LINK = "[persönlicher Link — wird beim Klick neu erstellt]";
/** Erinnerungen frühestens so viele Tage nach dem letzten Versand. */
export const ERINNERUNG_TAGE = 2;
const TAG_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Hilfen

function seitenVon(ctx: VorgangKontext): Seite[] {
  const roh: [M.Rolle, M.KundeRecord | null, LeadView][] = [
    ["anbieter", ctx.anbieter, ctx.angebot],
    ["suchender", ctx.suchender, ctx.gesuch],
  ];
  return roh.map(([rolle, k, l]) => ({
    rolle,
    k,
    l,
    wer: M.ROLLE_NAME[rolle],
    akk: M.ROLLE_ARTIKEL[rolle].akk.replace(/^den /, ""),
    artikel: M.ROLLE_ARTIKEL[rolle],
    name: k?.stammdaten?.name || T.wert(l.name) || l.id,
    an: (k?.email || T.wert(l.email)).toLowerCase(),
  }));
}

function seite(b: Bau, rolle: M.Rolle): Seite {
  return b.seiten.find((s) => s.rolle === rolle)!;
}

function datum(iso: string | null | undefined): string {
  return T.datumDe(iso);
}

function zeitKurz(ms: number): string {
  return new Date(ms).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

function zahlText(n: number): string {
  return String(n).replace(".", ",");
}

/** Heute als YYYY-MM-DD (deutsche Zeit). */
function heute(jetzt: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
}

/** Der Tag nach einem Datum (YYYY-MM-DD) — „überfällig seit …“. */
function tagDanach(ymd: string | null): string | null {
  const m = ymd?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10) : null;
}

function einenMonatSpaeter(iso: string): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return heute(d);
}

function flaechenKurz(f: M.Flaeche[]): string {
  const ha = M.summeHa(f);
  return `${f.length} ${f.length === 1 ? "Fläche" : "Flächen"}${ha != null ? ` mit ${T.haText(ha)}` : ""}`;
}

function mailAus(e: Entwurf, s: Seite, extra: Partial<AssistentMail> = {}): AssistentMail {
  return {
    zweck: e.zweck,
    rolle: s.rolle,
    kundeId: s.l.id,
    wer: `${s.wer} (${s.name})`,
    werAkk: `${s.artikel.akk} (${s.name})`,
    an: e.an,
    betreff: e.betreff,
    text: e.text,
    zuletzt: e.gesendetAm,
    ...extra,
  };
}

function paarEntwuerfe(b: Bau, vorgang: M.VorgangRecord | null = b.ctx.vorgang): Entwurf[] {
  const { ctx, u } = b;
  return entwuerfePaar({
    key: ctx.key,
    angebot: ctx.angebot,
    gesuch: ctx.gesuch,
    anbieter: ctx.anbieter,
    suchender: ctx.suchender,
    vorgang,
    meta: ctx.meta,
    zustand: ctx.zustand,
    einstellungen: u.einstellungen,
    basis: u.basis,
    bewertungsUrl: u.bewertungsUrl,
  });
}

/** Der echte, aktuelle Entwurf für eine Seite — zum Senden (mit gültigen Links). */
export function assistentEntwurf(ctx: VorgangKontext, u: AssistentUmgebung, zweck: MailZweck, rolle: M.Rolle): Entwurf | null {
  if (zweck === "einladung" || zweck === "erinnerung") {
    const lead = rolle === "anbieter" ? ctx.angebot : ctx.gesuch;
    const kunde = rolle === "anbieter" ? ctx.anbieter : ctx.suchender;
    return entwuerfeKunde({ lead, kunde, einstellungen: u.einstellungen, basis: u.basis }).find((e) => e.zweck === zweck) ?? null;
  }
  const b: Bau = { ctx, u, jetzt: u.jetzt ?? new Date(), seiten: seitenVon(ctx) };
  return paarEntwuerfe(b).find((e) => e.zweck === zweck && e.rolle === rolle) ?? null;
}

/** Vertrag nicht (mehr) möglich: Widerruf, Kündigung, Sperre. */
function sperrGrund(s: Seite): string | null {
  const k = s.k;
  if (!k) return null;
  if (k.widerruf) return `${s.wer} hat den Vertrag mit Lippe Forst am ${datum(k.widerruf.am)} widerrufen — mit diesem Paar geht es über die Plattform nicht weiter („Paar beenden“ unter „Weitere Aktionen“).`;
  if (k.kuendigung) return `${s.wer} hat den Vertrag mit Lippe Forst am ${datum(k.kuendigung.am)} gekündigt — keine neuen Vorstellungen mehr („Paar beenden“ unter „Weitere Aktionen“).`;
  if (k.gesperrt) return `${s.wer}: Der Zugang zum Kundenbereich ist gesperrt — in der Anfrage entsperren, sonst kann ${s.artikel.nom} nicht unterschreiben.`;
  return null;
}

/** Erinnern erst zwei Tage nach dem letzten Versand: gibt den frühesten Zeitpunkt zurück, falls noch gesperrt. */
function erinnerungGesperrtBis(zuletzt: string | undefined, jetzt: Date): number | null {
  if (!zuletzt) return null;
  const ab = Date.parse(zuletzt) + ERINNERUNG_TAGE * TAG_MS;
  return jetzt.getTime() < ab ? ab : null;
}

function vorgangsLink(b: Bau, anker: string, vorschau = false): string {
  return `/admin/vorgang/${b.ctx.key}${vorschau ? "?vorschau=1" : ""}#${anker}`;
}

// ---------------------------------------------------------------------------
// Aktionen, die an mehreren Stellen vorkommen

/** Paar beenden: vor der Freigabe verwerfen; nach der Freigabe nur aus den Listen nehmen (Nachweis bleibt). */
function paarBeenden(b: Bau, platz: Aktion["platz"] = "weitere", dran = false): Aktion | null {
  const status = b.ctx.meta?.status ?? "vorschlag";
  const v = b.ctx.vorgang;
  if (status === "verworfen" || status === "abschluss" || v?.abschluss) return null;
  if (status === "kontakt" || M.aktiveFreigabe(v)) {
    if (v?.beendet) return null;
    return {
      id: "paar-beenden",
      platz,
      dran,
      knopf: "Vorgang beenden (ohne Abschluss)",
      tipp: "Nimmt den Vorgang aus „Jetzt dran“ und „Warten“, z. B. wenn sich die Parteien nicht einig werden. Freigabe und Nachweis bleiben bestehen; es geht keine E-Mail raus.",
      frage: "Vorgang ohne Abschluss beenden?",
      passiert: [
        "Der Vorgang steht danach unter „Abgeschlossen & beendet“ und lässt sich dort jederzeit wieder aufnehmen.",
        "Die Freigabe bleibt bestehen: Beide sehen die Kontaktdaten weiter. Kommt später doch ein Vertrag zustande, bleibt der Provisionsanspruch (dann „Außerhalb geschlossen erfassen“).",
      ],
      mails: [],
      felder: [{ name: "grund", typ: "text", label: "Grund (für den Verlauf)", platzhalter: "z. B. keine Einigung über den Pachtzins", tipp: "Warum der Vorgang endet — erscheint im Verlauf des Vorgangs" }],
    };
  }
  return {
    id: "paar-beenden",
    platz,
    dran,
    knopf: status === "vorschlag" ? "Passt nicht — Paar verwerfen" : "Paar beenden",
    tipp: "Verwirft das Paar — es wird nicht mehr vorgeschlagen (im Matching unter „Verworfen“ zurückholbar). Es geht keine E-Mail raus.",
    frage: "Paar beenden (verwerfen)?",
    passiert: [
      "Das Paar wird verworfen und verschwindet aus dem Dashboard; im Matching steht es unter „Verworfen“ und lässt sich dort zurückholen.",
      ...(status === "angefragt" ? ["Beide sehen den Vorschlag danach nicht mehr in ihrem Kundenbereich."] : []),
    ],
    mails: [],
  };
}

type ExternVorbelegung = { art?: M.Art; datum?: string; flaeche?: string; betrag?: string; quelle?: string };

/** Außerhalb geschlossenen Vertrag erfassen — erst nach der Freigabe (Nachweis), solange noch kein Abschluss erfasst ist. */
function externAktion(b: Bau, opts: { platz: Aktion["platz"]; dran: boolean; ziel?: string; vorbelegung?: ExternVorbelegung }): Aktion | null {
  const v = b.ctx.vorgang;
  if (!v?.freigabe || v.abschluss) return null;
  const vb = opts.vorbelegung ?? {};
  const k = b.ctx.suchender?.vertrag?.konditionen ?? null;
  const art = vb.art ?? b.ctx.art;
  const widerrufen = Boolean(b.ctx.suchender?.widerruf);
  const g = b.u.einstellungen.gutschein;
  const s = seite(b, "suchender");
  return {
    id: "extern",
    ziel: opts.ziel,
    platz: opts.platz,
    dran: opts.dran,
    knopf: "Außerhalb geschlossen erfassen",
    tipp: "Die Parteien haben den Vertrag ohne die Plattform geschlossen (z. B. auf Papier) — erfassen, damit die Provision entsteht",
    frage: "Außerhalb geschlossenen Vertrag erfassen?",
    passiert: [
      "Den Vertrag mit Datum und Jahrespacht bzw. Kaufpreis erfassen — der Vorgang gilt damit als abgeschlossen.",
      widerrufen
        ? "Der Suchende hat seinen Vertrag mit Lippe Forst widerrufen: Die Provision wird nur vorgemerkt (bitte prüfen); es geht keine E-Mail raus."
        : `Provision anlegen (fällig): ${k ? `${M.konditionenText(art, k)} (Konditionen Nr. ${k.version})` : "kein unterschriebener Nachweisvertrag gefunden — Anspruch prüfen"}.`,
      "Den Vertrag als Scan bei Bedarf im Vorgang unter „Dokumente“ hochladen.",
      ...(opts.ziel ? ["Die Meldung des Kunden gilt damit als erledigt."] : []),
    ],
    mails: [],
    folgeMails:
      !widerrufen && g?.aktiv && g.betrag > 0 && b.ctx.suchender
        ? [`Treue-Gutschein über ${M.euro(g.betrag)} an den Suchenden ${s.name} (${s.an}) — Mail mit Code und Bedingungen; der Text steht danach im Verlauf.`]
        : undefined,
    felder: [
      {
        name: "art",
        typ: "auswahl",
        label: "Art",
        wert: art,
        optionen: [
          { wert: "pacht", label: "Pachtvertrag" },
          { wert: "kauf", label: "Kaufvertrag" },
        ],
        tipp: "Pacht- oder Kaufvertrag",
      },
      { name: "datum", typ: "datum", label: "Vertrag vom", pflicht: true, wert: vb.datum ?? "", tipp: "Datum des Vertragsschlusses" },
      { name: "betrag", typ: "zahl", label: "Jahrespacht (€, netto) bzw. Kaufpreis (€)", pflicht: true, wert: vb.betrag ?? "", platzhalter: "z. B. 1.800", tipp: "Volle Jahrespacht (netto) bzw. Kaufpreis — Grundlage der Provision" },
      { name: "flaeche", typ: "zahl", label: "Fläche (ha)", wert: vb.flaeche ?? "", tipp: "Vertragsfläche in Hektar (freiwillig)" },
      { name: "quelle", typ: "text", label: "Quelle", wert: vb.quelle ?? "", platzhalter: "z. B. Anruf des Pächters", tipp: "Woher die Information stammt (Mitteilung, Kopie des Vertrags, Gespräch …)" },
    ],
  };
}

function zustimmungAktion(b: Bau, s: Seite, abgelehnt: boolean): Aktion {
  return {
    id: "zustimmung",
    ziel: s.rolle,
    platz: "zusatz",
    dran: false,
    knopf: `${s.wer}: Zustimmung erhalten (Telefon/E-Mail)`,
    tipp: `Erfasst die Zustimmung ${s.artikel.gen} zu genau diesem Kontakt, die Sie am Telefon oder per E-Mail bekommen haben — mit Ihrem Namen und Zeitpunkt im Verlauf`,
    frage: `Hat ${s.artikel.nom} (${s.name}) diesem Kontakt ausdrücklich zugestimmt (z. B. am Telefon oder per E-Mail)?`,
    passiert: [
      "Die Zustimmung wird mit Ihrem Namen und dem Zeitpunkt vermerkt.",
      ...(abgelehnt ? ["Die Meldung „kein Interesse“ ist damit aufgehoben."] : []),
      "Stimmen beide zu, ist als Nächstes die Freigabe dran.",
    ],
    mails: [],
  };
}

// ---------------------------------------------------------------------------
// Meldungen aus dem Kundenbereich (Rückfrage, Vertragsschluss, kein Interesse)

function abschlussAngaben(text: string): ExternVorbelegung {
  const betrag = text.match(/^Jahrespacht bzw\. Kaufpreis: ([\d.,\s]+?)\s*€/m)?.[1]?.trim();
  const flaeche = text.match(/^Fläche: ([\d.,]+) ha/m)?.[1];
  return {
    art: /^Art: Kaufvertrag/m.test(text) ? "kauf" : /^Art: Pachtvertrag/m.test(text) ? "pacht" : undefined,
    // Kundenmeldung schreibt „Datum: 20.09.2026“ (ältere Meldungen noch „2026-09-20“) — fürs Formular als JJJJ-MM-TT.
    datum: ((d) => (d && /^\d{2}\.\d{2}\.\d{4}$/.test(d) ? d.split(".").reverse().join("-") : d))(text.match(/^Datum: (\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/m)?.[1]),
    flaeche,
    betrag,
  };
}

function meldungErledigtAktion(m: M.KundenMeldung, platz: Aktion["platz"], knopf: string): Aktion {
  return {
    id: "meldung-erledigt",
    ziel: m.id,
    platz,
    dran: platz === "haupt",
    knopf,
    tipp: "Markiert die Meldung als bearbeitet — sie bleibt im Verlauf, der Vorgang verlässt „Jetzt dran“ (sofern sonst nichts ansteht)",
    frage: "Meldung als erledigt markieren?",
    passiert: ["Die Meldung gilt als bearbeitet; sie bleibt im Verlauf des Vorgangs."],
    mails: [],
  };
}

function meldungenVon(b: Bau): MeldungRoh[] {
  const v = b.ctx.vorgang;
  const meta = b.ctx.meta;
  const out: MeldungRoh[] = [];
  // Älteste zuerst — in der Reihenfolge, in der sie eingegangen sind.
  for (const m of (v?.meldungen ?? []).filter((x) => !x.erledigt).slice().reverse()) {
    const s = seite(b, m.rolle);
    const wer = `${s.wer} (${s.name})`;
    if (m.art === "rueckfrage") {
      const body = `Guten Tag ${s.name},\n\nvielen Dank für Ihre Nachricht vom ${datum(m.am)}:\n\n> ${m.text.replace(/\n/g, "\n> ")}\n\n`;
      out.push({
        id: m.id,
        art: "rueckfrage",
        am: m.am,
        wer,
        titel: `Rückfrage ${s.artikel.gen} ${s.name}`,
        text: m.text,
        antworten: EMAIL.test(s.an)
          ? {
              href: `mailto:${s.an}?subject=${encodeURIComponent("Ihre Rückfrage bei Lippe Forst")}&body=${encodeURIComponent(body)}`,
              text: "Per E-Mail antworten",
              tipp: `Öffnet Ihr Mailprogramm mit einer Antwort an ${s.an} — diese Antwort wird nicht im Verlauf gespeichert. Danach „Erledigt“ klicken.`,
            }
          : undefined,
        aktionen: [meldungErledigtAktion(m, "haupt", "Erledigt (beantwortet)")],
      });
      continue;
    }
    const vb = abschlussAngaben(m.text);
    const ext = externAktion(b, { platz: "haupt", dran: true, ziel: m.id, vorbelegung: { ...vb, quelle: `Meldung im Kundenbereich vom ${datum(m.am)} (${s.wer})` } });
    out.push({
      id: m.id,
      art: "abschluss",
      am: m.am,
      wer,
      titel: `${s.wer} ${s.name} meldet einen Vertragsschluss`,
      text: m.text,
      aktionen: ext
        ? [ext, meldungErledigtAktion(m, "zusatz", "Erledigt, ohne zu erfassen")]
        : [meldungErledigtAktion(m, "haupt", v?.abschluss ? "Erledigt (Vertrag ist schon erfasst)" : "Erledigt")],
    });
  }
  const abl = meta?.ablehnung;
  if (abl && meta?.status !== "verworfen" && v?.ablehnungErledigt?.fuer !== abl.am) {
    const s = seite(b, abl.rolle);
    const beenden = paarBeenden(b, "haupt", true);
    out.push({
      id: "ablehnung",
      art: "ablehnung",
      am: abl.am,
      wer: `${s.wer} (${s.name})`,
      titel: `${s.wer} ${s.name} hat „kein Interesse“ gemeldet`,
      text: abl.grund ? `Begründung: ${abl.grund}` : "Ohne Begründung.",
      aktionen: [
        ...(beenden ? [beenden] : []),
        {
          id: "ablehnung-erledigt",
          ziel: abl.am,
          platz: "zusatz",
          dran: false,
          knopf: "Zur Kenntnis — Paar ruhen lassen",
          tipp: "Das Paar bleibt bestehen, steht aber unter „Warten“ — ohne Erinnerungen an die Gegenseite",
          frage: "„Kein Interesse“ zur Kenntnis nehmen und das Paar ruhen lassen?",
          passiert: [
            "Das Paar steht danach unter „Warten“ — es gehen keine Erinnerungen an die Gegenseite raus.",
            `Meldet sich ${s.artikel.nom} doch noch, lässt sich das mit „${s.wer}: Zustimmung erhalten (Telefon/E-Mail)“ erfassen.`,
          ],
          mails: [],
        },
      ],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Einladung (Schritte 2 und 3)

type EinladungsStand = {
  /** Irgendeine Einladungs- oder Erinnerungs-Mail ist erfolgreich rausgegangen. */
  geschickt: boolean;
  /** Letzte Einladungs- oder Erinnerungs-Mail. */
  letzte?: string;
  /** Die Einladung hat den Kunden erreicht (Mail, geöffnet, Angaben, Vertrag). */
  erreicht: boolean;
  abgelaufen: boolean;
  /** Vor dem Senden ist ein neuer Link nötig (keiner da oder abgelaufen). */
  neuerLink: boolean;
  /** Kurzbeschreibung für „Worauf gewartet wird“. */
  text: string;
};

function einladungsStand(s: Seite, jetzt: Date): EinladungsStand {
  const k = s.k;
  const e = k?.einladung;
  const abgelaufen = Boolean(e && Date.parse(e.bis) < jetzt.getTime());
  const letzte = k?.mails.find((m) => (m.zweck === "einladung" || m.zweck === "erinnerung") && m.ok);
  const geschickt = Boolean(letzte);
  const erreicht = geschickt || Boolean(e?.angenommenAm || k?.stammdaten || k?.vertrag);
  const teile = [
    !e ? "kein gültiger Einladungslink (zurückgezogen)" : geschickt ? `zuletzt angeschrieben am ${datum(letzte?.am)}` : "Einladungslink erstellt, aber noch nicht per E-Mail gesendet",
    e?.angenommenAm ? `Link geöffnet am ${datum(e.angenommenAm)}` : "",
    abgelaufen && e ? `Link abgelaufen am ${datum(e.bis)}` : "",
  ];
  return { geschickt, letzte: letzte?.am, erreicht, abgelaufen, neuerLink: !e || abgelaufen, text: teile.filter(Boolean).join(" · ") };
}

/** Warum eine Seite (jetzt) nicht eingeladen werden kann — oder null. */
function einladungsProblem(b: Bau, s: Seite): { text: string; vorlage?: boolean } | null {
  const rr = T.rolleVonLead(s.l);
  if (!rr) return { text: `${s.wer}: Die Anfrage ist nicht als Angebot bzw. Gesuch mit Kauf oder Pacht eingeordnet — in der Anfrage unter „Angaben fürs Matching“ korrigieren.` };
  if (!EMAIL.test(s.an)) return { text: `${s.wer}: In der Anfrage steht keine gültige E-Mail-Adresse — ohne Adresse ist keine Online-Einladung möglich (bitte telefonisch klären).` };
  const vorlage = kundenVorlage(rr.rolle, rr.art);
  if (!istFreigegeben(b.u.einstellungen, vorlage)) {
    return { text: `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — ohne Freigabe kann niemand unterschreiben.`, vorlage: true };
  }
  return null;
}

const VORLAGEN_LINK: AssistentLink = { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Alle freigeben“" };

/**
 * Einladungs- bzw. Erinnerungs-Mail für die Anzeige. Entsteht der Link erst beim
 * Klick, wird der Text mit einem Probe-Link erzeugt und dieser durch einen
 * Platzhalter ersetzt — gesendet wird später der echte Entwurf.
 */
function einladungVorschau(b: Bau, s: Seite, zweck: "einladung" | "erinnerung", neuerLink: boolean): AssistentMail | null {
  let kunde = s.k;
  let probeLink: string | null = null;
  if (neuerLink) {
    const rr = T.rolleVonLead(s.l);
    const basis = s.k ?? M.neuerKunde(s.l.id, rr?.rolle ?? s.rolle, rr?.art ?? b.ctx.art, s.an, "vorschau");
    kunde = {
      ...basis,
      einladung: { nonce: "vorschau-nur-zur-anzeige", bis: einladungBis().toISOString(), erstelltAm: b.jetzt.toISOString(), von: "vorschau", gesendetAm: s.k?.einladung?.gesendetAm },
    };
    probeLink = einladungsLink(kunde, b.u.basis);
  }
  const e = entwuerfeKunde({ lead: s.l, kunde, einstellungen: b.u.einstellungen, basis: b.u.basis }).find((x) => x.zweck === zweck);
  if (!e) return null;
  return mailAus(e, s, {
    text: probeLink ? e.text.split(probeLink).join(NEUER_LINK) : e.text,
    neuerLink,
    hinweis: neuerLink
      ? `Der persönliche Link (30 Tage gültig) wird beim Klick neu erstellt und in den Text eingesetzt${s.k?.einladung ? "; der bisherige Link wird damit ungültig" : ""}.`
      : undefined,
  });
}

function schrittPaar(b: Bau): Teil {
  return {
    stand: "Vorschlag aus dem Matching — Angebot und Gesuch passen zusammen.",
    aktion: {
      id: "vormerken",
      platz: "haupt",
      knopf: "Paar vormerken",
      tipp: "Merkt dieses Paar vor. Danach lädt der Assistent beide Seiten zum Kundenbereich ein. Es geht noch keine E-Mail raus.",
      frage: "Dieses Paar vormerken?",
      passiert: [
        "Das Paar wird vorgemerkt und erscheint unter „Jetzt dran“ und in den Vorgängen.",
        "Als Nächstes lädt der Assistent beide Seiten zum Kundenbereich ein (eigener Klick mit Rückfrage).",
      ],
      mails: [],
      dran: true,
    },
    neben: [paarBeenden(b)],
  };
}

function schrittEinladung(b: Bau): Teil {
  const hinweise: AssistentHinweis[] = [];
  const probleme: { text: string; vorlage?: boolean }[] = [];
  const passiert: string[] = [];
  const uebersprungen: string[] = [];
  const mails: AssistentMail[] = [];
  for (const s of b.seiten) {
    const sperre = sperrGrund(s);
    if (sperre) {
      hinweise.push({ text: sperre, warn: true });
      continue;
    }
    if (s.k?.vertrag) {
      uebersprungen.push(`${s.wer} hat den Vertrag mit Lippe Forst bereits unterschrieben — wird übersprungen.`);
      continue;
    }
    const neu = M.stufe(s.k) === "neu";
    const es = einladungsStand(s, b.jetzt);
    if (!neu && es.erreicht) {
      uebersprungen.push(`${s.wer} ist schon eingeladen (${es.text}) — wird übersprungen.`);
      continue;
    }
    const problem = einladungsProblem(b, s);
    if (problem) {
      probleme.push(problem);
      continue;
    }
    const neuerLink = neu || es.neuerLink;
    const m = einladungVorschau(b, s, "einladung", neuerLink);
    if (!m) {
      probleme.push({ text: `${s.wer}: Für diese Anfrage ist keine Einladung möglich.` });
      continue;
    }
    if (neuerLink) passiert.push(`Persönlichen Einladungslink für ${s.artikel.akk} erstellen (30 Tage gültig)${s.k ? "" : " und die Kundenakte anlegen"}.`);
    mails.push(m);
  }
  const vorlagenLink = probleme.some((p) => p.vorlage) ? VORLAGEN_LINK : undefined;
  const stand = b.seiten.map((s) => `${s.wer}: ${M.STUFE_INFO[M.stufe(s.k)].label}`).join(" · ");
  if (mails.length === 0) {
    // Ist der Knopf gesperrt, stehen die Gründe dort („Warum gesperrt“) — nicht doppelt als Hinweis.
    return {
      stand,
      hinweise,
      aktion: probleme.length
        ? { id: "einladen", platz: "haupt", knopf: "Beide einladen", tipp: probleme.map((p) => p.text).join(" "), frage: "", passiert: [], mails: [], gesperrt: probleme.map((p) => p.text).join(" "), link: vorlagenLink, dran: false }
        : null,
      neben: [paarBeenden(b)],
    };
  }
  const beide = mails.length === 2;
  const erste = seite(b, mails[0].rolle);
  return {
    stand,
    hinweise: [...hinweise, ...probleme.map((p) => ({ text: p.text, warn: true }))],
    aktion: {
      id: "einladen",
      platz: "haupt",
      knopf: beide ? "Beide einladen" : `${erste.akk} einladen`,
      tipp: beide
        ? "Erstellt die persönlichen Einladungslinks und sendet beiden die Einladungs-Mail (vorher wird nachgefragt)"
        : `Erstellt ggf. den persönlichen Einladungslink und sendet ${erste.artikel.dat} die Einladungs-Mail (vorher wird nachgefragt)`,
      frage: beide ? "Beide Seiten jetzt einladen?" : `${erste.akk} jetzt einladen?`,
      passiert: [
        ...passiert,
        `${beide ? "Beide Einladungs-Mails senden" : `Einladungs-Mail an ${erste.artikel.akk} senden`}: persönlicher Link in den Kundenbereich — Angaben machen, Vertrag mit Lippe Forst lesen und online unterschreiben.`,
        ...uebersprungen,
        "Danach wartet der Vorgang auf die Unterschriften; der Assistent zeigt, wer noch fehlt.",
      ],
      mails,
      link: vorlagenLink,
      dran: true,
    },
    neben: [paarBeenden(b)],
  };
}

function schrittUnterschrift(b: Bau): Teil {
  const hinweise: AssistentHinweis[] = [];
  const probleme: { text: string; vorlage?: boolean }[] = [];
  const warten: AssistentWarten[] = [];
  const erledigt: string[] = [];
  const passiert: string[] = [];
  const zuFrueh: { text: string; ab: number }[] = [];
  const mails: AssistentMail[] = [];
  for (const s of b.seiten) {
    if (vertragGueltig(s.k)) {
      erledigt.push(`${s.wer} hat den Vertrag mit Lippe Forst am ${datum(s.k?.vertrag?.signatur.am)} unterschrieben`);
      continue;
    }
    const sperre = sperrGrund(s);
    if (sperre) {
      hinweise.push({ text: sperre, warn: true });
      continue;
    }
    const es = einladungsStand(s, b.jetzt);
    warten.push({ text: `Unterschrift ${s.artikel.gen} ${s.name} (Vertrag mit Lippe Forst) — ${M.STUFE_INFO[M.stufe(s.k)].label}; ${es.text}`, seit: es.letzte ?? s.k?.einladung?.erstelltAm });
    const problem = einladungsProblem(b, s);
    if (problem) {
      probleme.push(problem);
      continue;
    }
    const zweck = es.geschickt ? "erinnerung" : "einladung";
    // Erinnern erst zwei Tage nach der letzten Mail (ein neuer Link wegen Ablauf geht immer).
    const bis = zweck === "erinnerung" && !es.neuerLink ? erinnerungGesperrtBis(es.letzte, b.jetzt) : null;
    if (bis) {
      zuFrueh.push({ text: `${s.wer}: zuletzt am ${datum(es.letzte)} angeschrieben — Erinnerung frühestens ab ${zeitKurz(bis)}`, ab: bis });
      continue;
    }
    const m = einladungVorschau(b, s, zweck, es.neuerLink);
    if (!m) {
      probleme.push({ text: `${s.wer}: Für diese Anfrage ist keine Einladung möglich.` });
      continue;
    }
    if (es.neuerLink) {
      passiert.push(`Neuen Einladungslink für ${s.artikel.akk} erstellen (${s.k?.einladung ? `der bisherige ist am ${datum(s.k.einladung.bis)} abgelaufen` : "der bisherige wurde zurückgezogen"}).`);
    }
    mails.push(m);
  }
  const stand = erledigt.length ? `Warten auf die Unterschrift — ${erledigt.join(" · ")}.` : "Beide sind eingeladen — jetzt warten auf die Unterschriften unter dem Vertrag mit Lippe Forst.";
  const vorlagenLink = probleme.some((p) => p.vorlage) ? VORLAGEN_LINK : undefined;
  if (mails.length === 0) {
    const gruende = [...probleme.map((p) => p.text), ...zuFrueh.map((z) => z.text)];
    return {
      stand,
      warten,
      hinweise,
      wartet: probleme.length === 0,
      aktion: gruende.length
        ? { id: "erinnern", platz: "haupt", knopf: "Erinnerung senden", tipp: `Gesperrt: ${gruende.join(" · ")}`, frage: "", passiert: [], mails: [], gesperrt: gruende.join(" · "), link: vorlagenLink, dran: false }
        : null,
      neben: [paarBeenden(b)],
    };
  }
  const nurErinnerung = mails.every((m) => m.zweck === "erinnerung");
  const nurEinladung = mails.every((m) => m.zweck === "einladung");
  const knopf = nurErinnerung ? "Erinnerung senden" : nurEinladung ? "Einladung senden" : "Einladung bzw. Erinnerung senden";
  return {
    stand,
    warten,
    hinweise: [...hinweise, ...probleme.map((p) => ({ text: p.text, warn: true }))],
    // Ist jede Einladung schon raus, liegt der Ball bei den Kunden (Erinnern ist nur ein Angebot).
    wartet: !mails.some((m) => m.zweck === "einladung") && probleme.length === 0,
    aktion: {
      id: "erinnern",
      platz: "haupt",
      knopf,
      tipp: `${nurErinnerung ? "Schickt eine freundliche Erinnerung" : "Schickt die Einladung"} mit dem persönlichen Link an ${mails.length === 2 ? "beide" : seite(b, mails[0].rolle).artikel.akk} (vorher wird nachgefragt). Unterschreiben kann nur der Kunde selbst.`,
      frage: `${knopf}?`,
      passiert: [
        ...passiert,
        ...mails.map((m) => `${m.zweck === "erinnerung" ? "Erinnerung" : "Einladungs-Mail"} an ${m.werAkk} senden — mit dem persönlichen Link in den Kundenbereich.`),
        ...zuFrueh.map((z) => `Nicht erneut: ${z.text}.`),
        "Unterschreiben kann nur der Kunde selbst, online im Kundenbereich mit seinem Namen.",
      ],
      mails,
      link: vorlagenLink,
      // Eine noch nie gesendete Einladung ist fällig — eine bloße Erinnerung nicht.
      dran: mails.some((m) => m.zweck === "einladung"),
    },
    neben: [paarBeenden(b)],
  };
}

// ---------------------------------------------------------------------------
// Anonym vorstellen, Zustimmung (Schritt 4), Freigabe (Schritt 5)

function schrittZustimmung(b: Bau): Teil {
  const { meta, vorgang: v } = b.ctx;
  const entw = paarEntwuerfe(b);
  const warten: AssistentWarten[] = [];
  const hinweise: AssistentHinweis[] = [];
  const erledigt: string[] = [];
  const neu: AssistentMail[] = [];
  const nochmal: AssistentMail[] = [];
  const zuFrueh: string[] = [];
  const zustimmungen: Aktion[] = [];
  const abl = meta?.ablehnung ?? null;
  for (const s of b.seiten) {
    const am = s.rolle === "anbieter" ? meta?.zustimmungAnbieter : meta?.zustimmungSuchender;
    if (am) {
      const q = meta?.zustimmungQuelle?.[s.rolle];
      erledigt.push(`${s.wer} stimmt zu (${datum(am)}${q === "kunde" ? ", selbst im Kundenbereich" : q ? `, erfasst von ${q}` : ""})`);
      continue;
    }
    zustimmungen.push(zustimmungAktion(b, s, abl?.rolle === s.rolle));
    // Hat eine Seite „kein Interesse“ gemeldet, geht an niemanden ein Hinweis oder eine Erinnerung.
    if (abl) continue;
    const e = entw.find((x) => x.zweck === "hinweis" && x.rolle === s.rolle);
    if (!e) {
      hinweise.push({ warn: true, text: `${s.wer}: Kein Hinweis per E-Mail möglich (keine Adresse) — telefonisch anfragen und die Zustimmung erfassen.` });
      continue;
    }
    const gesendet = v?.hinweise?.[s.rolle];
    if (!gesendet) {
      neu.push(mailAus(e, s));
      continue;
    }
    warten.push({ text: `Zustimmung ${s.artikel.gen} ${s.name} — anonymer Hinweis mit Zustimmungslink gesendet am ${datum(gesendet)}`, seit: gesendet });
    const bis = erinnerungGesperrtBis(gesendet, b.jetzt);
    if (bis) zuFrueh.push(`${s.wer}: Hinweis am ${datum(gesendet)} gesendet — Erinnerung frühestens ab ${zeitKurz(bis)}`);
    else nochmal.push(mailAus(e, s));
  }
  if (abl) {
    const s = seite(b, abl.rolle);
    const ruht = b.ctx.vorgang?.ablehnungErledigt?.fuer === abl.am;
    return {
      stand: `${s.wer} ${s.name} hat am ${datum(abl.am)} „kein Interesse“ gemeldet — an die Gegenseite gehen keine Erinnerungen.`,
      warten: ruht ? [{ text: `Das Paar ruht — ${s.artikel.nom} hat kein Interesse gemeldet`, seit: abl.am }] : [],
      hinweise,
      wartet: ruht,
      aktion: ruht ? paarBeenden(b, "haupt", false) : null,
      neben: zustimmungen,
      extra: [abl.am, ruht],
    };
  }
  const angefragt = Boolean(v?.hinweise?.anbieter || v?.hinweise?.suchender);
  const stand = erledigt.length
    ? `${erledigt.join(" · ")}.`
    : angefragt
      ? "Anonym angefragt — die Zustimmungen fehlen noch."
      : "Beide haben den Vertrag mit Lippe Forst unterschrieben — jetzt stellt der Assistent das Paar beiden anonym vor.";
  let aktion: Aktion | null = null;
  if (neu.length) {
    const beide = neu.length === 2;
    const erste = seite(b, neu[0].rolle);
    aktion = {
      id: "hinweise",
      platz: "haupt",
      knopf: beide ? "Beide anonym anfragen" : `${erste.akk} anonym anfragen`,
      tipp: "Sendet den anonymen Hinweis (nur Gemeinde, Flächentyp, Größe, Art — kein Name) mit Link zum Zustimmen (vorher wird nachgefragt)",
      frage: beide ? "Beide jetzt anonym anfragen?" : `${erste.akk} jetzt anonym anfragen?`,
      passiert: [
        "Anonymer Hinweis: nur Gemeinde, Flächentyp, Größe und Art — kein Name, keine Kontaktdaten, keine Flurstücke.",
        "Mit Link in den Kundenbereich — dort stimmt die Seite dem Kontakt zu oder meldet „kein Interesse“.",
        "Sind beide Hinweise gesendet, steht das Paar auf „Angefragt“ und beide sehen den Vorschlag im Kundenbereich.",
      ],
      mails: neu,
      dran: true,
    };
  } else if (nochmal.length || zuFrueh.length) {
    aktion = {
      id: "hinweise",
      platz: "haupt",
      knopf: "Erinnerung senden",
      tipp: nochmal.length
        ? `Sendet den anonymen Hinweis noch einmal an ${nochmal.length === 2 ? "beide" : seite(b, nochmal[0].rolle).artikel.akk} (Betreff „Erinnerung: …“) — vorher wird nachgefragt`
        : `Gesperrt: ${zuFrueh.join(" · ")}`,
      frage: "Anonymen Hinweis noch einmal senden?",
      passiert: [
        "Den anonymen Hinweis erneut senden (Betreff „Erinnerung: …“) — mit frischem Link in den Kundenbereich zum Zustimmen.",
        ...zuFrueh.map((z) => `Nicht erneut: ${z}.`),
      ],
      mails: nochmal,
      gesperrt: nochmal.length ? undefined : zuFrueh.join(" · "),
      dran: false,
    };
  }
  return { stand, warten, hinweise, aktion, neben: [...zustimmungen, paarBeenden(b)], wartet: neu.length === 0 && (nochmal.length > 0 || zuFrueh.length > 0) };
}

function schrittFreigabe(b: Bau): Teil {
  const { ctx } = b;
  const pr = freigabePruefung(ctx, b.jetzt);
  const fehlt = pr.punkte.filter((p) => !p.ok).map((p) => p.text);
  const hinweise: AssistentHinweis[] = [];
  const zurueck = ctx.vorgang?.freigabe?.zurueckgezogen;
  if (zurueck) hinweise.push({ text: `Die Freigabe wurde am ${datum(zurueck.am)} zurückgezogen${zurueck.grund ? ` (${zurueck.grund})` : ""}. Eine erneute Freigabe informiert beide wieder.` });
  if (fehlt.some((t) => t.includes("Widerrufsfrist"))) {
    hinweise.push({ text: "Der Suchende kann in seinem Kundenbereich ausdrücklich verlangen, dass schon vor Ablauf der Widerrufsfrist begonnen wird („Kontakte schon vor Ablauf der Widerrufsfrist erhalten?“) — dann ist die Freigabe sofort möglich." });
  }
  // Die Freigabe-Mitteilungen entstehen erst mit der Freigabe — für die Anzeige mit einer angenommenen Freigabe erzeugen.
  const sim: M.VorgangRecord = { ...(ctx.vorgang ?? M.neuerVorgang(ctx.key, ctx.art)), freigabe: { am: b.jetzt.toISOString(), von: "vorschau" } };
  const mails = paarEntwuerfe(b, sim)
    .filter((e) => e.zweck === "freigabe")
    .map((e) => mailAus(e, seite(b, e.rolle!), { zuletzt: undefined }));
  const bestaetigungFehlt = fehlt.some((t) => t.includes("Vertragsbestätigung"));
  // Widerrufsfrist: warten. Fehlende Bestätigung, Widerruf, Kündigung, Sperre: die Verwaltung muss handeln.
  const verwaltung = bestaetigungFehlt || fehlt.some((t) => /: (widerrufen|gekündigt|zugang gesperrt)/i.test(t));
  const zA = ctx.meta?.zustimmungAnbieter;
  const zS = ctx.meta?.zustimmungSuchender;
  const seit = zA && zS ? (zA > zS ? zA : zS) : undefined;
  return {
    stand: pr.bereit ? "Beide haben unterschrieben und zugestimmt — die Kontaktdaten können freigegeben werden." : "Beide stimmen dem Kontakt zu — die Freigabe ist aber noch nicht möglich.",
    warten: pr.bereit ? [] : fehlt.map((t) => ({ text: t, seit })),
    hinweise,
    wartet: !pr.bereit && !verwaltung,
    aktion: {
      id: "freigeben",
      platz: "haupt",
      knopf: "Kontakt freigeben & beide informieren",
      tipp: pr.bereit ? "Gibt die Kontaktdaten beider Seiten im Kundenbereich frei und sendet beiden die Freigabe-Mitteilung (vorher wird nachgefragt)" : "Gesperrt, bis die Punkte unter „Worauf gewartet wird“ erfüllt sind",
      frage: "Kontakt jetzt freigeben und beide informieren?",
      passiert: [
        `${seite(b, "anbieter").name} und ${seite(b, "suchender").name} sehen im Kundenbereich Namen, Anschrift, Telefon, E-Mail und Flurstücke des Gegenübers — das ist der Nachweis (Grundlage der Provision).`,
        "Beide erhalten eine Freigabe-Mitteilung mit Direktlink in den Kundenbereich (die Kontaktdaten selbst stehen nicht in der Mail).",
        "Rückgängig nur über „Freigabe zurückziehen“ — bereits gesehene Daten bleiben bekannt.",
      ],
      mails,
      // Die Gründe stehen schon unter „Worauf gewartet wird“ — hier nur der Verweis.
      gesperrt: pr.bereit ? undefined : "erst möglich, wenn die Punkte unter „Worauf gewartet wird“ erfüllt sind.",
      link: bestaetigungFehlt
        ? { href: `/admin/anfrage/${ctx.gesuch.id}#kundenbereich`, text: "Zur Kundenakte des Suchenden", tipp: "Dort „Bestätigung erneut senden“ — die Vertragsbestätigung mit PDF ist Voraussetzung der Freigabe" }
        : undefined,
      dran: pr.bereit,
    },
    neben: [paarBeenden(b)],
    extra: [ctx.vorgang?.freigabe?.am ?? "", zurueck?.am ?? ""],
  };
}

// ---------------------------------------------------------------------------
// Vertrag (Schritt 6)

function freigabeChip(v: M.VorgangRecord): AssistentChip[] {
  return M.aktiveFreigabe(v) ? [{ text: `Freigegeben am ${datum(v.freigabe?.am)}`, art: "ok", tipp: "Seit diesem Tag sehen beide Seiten im Kundenbereich Namen und Kontaktdaten des Gegenübers (= Nachweis)" }] : [];
}

function schrittVertrag(b: Bau): Teil {
  const { ctx } = b;
  const v = ctx.vorgang;
  if (!v) return { stand: "Vorgangsakte fehlt.", aktion: null };
  // Nach einem Widerruf wird über die Plattform nichts mehr vorgelegt (die Funktionen sperren das auch).
  const widerrufen = b.seiten.find((s) => s.k?.widerruf);
  if (widerrufen) {
    return {
      stand: `${widerrufen.wer} hat den Vertrag mit Lippe Forst am ${datum(widerrufen.k?.widerruf?.am)} widerrufen — über die Plattform wird nichts mehr vorgelegt.`,
      hinweise: [{ warn: true, text: "Der Kundenbereich zeigt die Kontaktdaten schon nicht mehr an. Bitte die Freigabe zurückziehen und, falls nötig, die Gegenseite informieren." }],
      aktion: {
        id: "freigabe-zurueckziehen",
        platz: "haupt",
        dran: true,
        knopf: "Freigabe zurückziehen",
        tipp: "Verbirgt die Kontaktdaten im Kundenbereich wieder (der Nachweis bleibt bestehen)",
        frage: "Freigabe zurückziehen?",
        passiert: ["Die Kontaktdaten werden im Kundenbereich wieder verborgen — bereits gesehene Daten bleiben bekannt.", "Der Grund wird im Verlauf festgehalten."],
        mails: [],
        felder: [{ name: "grund", typ: "text", label: "Grund", pflicht: true, wert: `Widerruf ${widerrufen.artikel.gen}`, tipp: "Warum die Freigabe zurückgezogen wird (wird protokolliert)" }],
      },
      chips: freigabeChip(v),
    };
  }
  const chips = freigabeChip(v);
  // Freigabe-Mitteilungen nachholen, solange am Vertrag noch nichts begonnen hat.
  const offen = paarEntwuerfe(b).filter((e) => e.zweck === "freigabe" && !e.gesendetAm && !e.gesperrt);
  const begonnen = ctx.art === "pacht" ? Boolean(v.pachtvertrag && v.pachtvertrag.status !== "verworfen") : Boolean(v.kauf && v.kauf.status !== "abgebrochen");
  if (offen.length && !begonnen) {
    const beide = offen.length === 2;
    const erste = seite(b, offen[0].rolle!);
    return {
      stand: `Die Kontaktdaten sind seit dem ${datum(v.freigabe?.am)} freigegeben — die Freigabe-Mitteilung ist aber noch nicht gesendet.`,
      aktion: {
        id: "freigabe-mitteilen",
        platz: "haupt",
        knopf: beide ? "Beide informieren" : `${erste.akk} informieren`,
        tipp: "Sendet die Freigabe-Mitteilung mit Direktlink in den Kundenbereich (vorher wird nachgefragt)",
        frage: beide ? "Beide jetzt über die Freigabe informieren?" : `${erste.akk} jetzt über die Freigabe informieren?`,
        passiert: ["Freigabe-Mitteilung senden: Die Kontaktdaten stehen im Kundenbereich (sie selbst stehen nicht in der Mail)."],
        mails: offen.map((e) => mailAus(e, seite(b, e.rolle!))),
        dran: true,
      },
      neben: [externAktion(b, { platz: "weitere", dran: false }), paarBeenden(b)],
      chips,
      extra: [v.freigabe?.am ?? ""],
    };
  }
  const hinweise: AssistentHinweis[] = [];
  if (offen.length) {
    hinweise.push({ text: `Die Freigabe-Mitteilung an ${offen.map((e) => M.ROLLE_ARTIKEL[e.rolle!].akk).join(" und ")} ist noch nicht gesendet — im Vorgang unter „Einzelne E-Mails“.` });
  }
  const teil = ctx.art === "pacht" ? schrittPacht(b, v, hinweise) : schrittKauf(b, v, hinweise);
  return { ...teil, chips: [...chips, ...(teil.chips ?? [])] };
}

function schrittPacht(b: Bau, v: M.VorgangRecord, hinweise: AssistentHinweis[]): Teil {
  const { ctx, u } = b;
  const pv = v.pachtvertrag;
  const vorlageFrei = istFreigegeben(u.einstellungen, "pachtvertrag");
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  if (ctx.anbieter?.stammdaten?.eigenschaft === "unternehmer" && ctx.suchender?.stammdaten?.eigenschaft === "verbraucher") {
    hinweise.push({ warn: true, text: "Achtung: Verpächter handelt als Unternehmer, Pächter als Verbraucher — der Pächter kann einen online geschlossenen Pachtvertrag ggf. widerrufen (Fernabsatz). Vor der Unterschrift klären oder den Vertrag außerhalb der Plattform schließen." });
  }
  const zinsFelder = (d?: M.PachtDaten): AssistentFeld[] => [
    {
      name: "zins",
      typ: "zahl",
      label: "Pachtzins (€, netto)",
      pflicht: true,
      wert: d?.pachtzinsJahr ? zahlText(d.pachtzinsJahr) : d?.pachtzinsJeHa ? zahlText(d.pachtzinsJeHa) : "",
      platzhalter: "z. B. 450",
      tipp: "Pachtzins netto — je Hektar und Pachtjahr oder als fester Betrag je Pachtjahr (daneben wählen)",
    },
    {
      name: "einheit",
      typ: "auswahl",
      label: "bezogen auf",
      wert: d?.pachtzinsJahr ? "jahr" : "ha",
      optionen: [
        { wert: "ha", label: "je Hektar und Pachtjahr" },
        { wert: "jahr", label: "je Pachtjahr (fester Betrag)" },
      ],
      tipp: "Worauf sich der Betrag bezieht: je Hektar (die Jahrespacht wird mit der Fläche berechnet) oder fester Betrag für ein ganzes Pachtjahr",
    },
  ];
  const vorlageHinweis: AssistentHinweis | null = !vorlageFrei
    ? { warn: true, text: "Die Vorlage „Landpachtvertrag“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — vorbereiten geht, zur Unterschrift erst nach der Freigabe." }
    : null;
  const formularLink: AssistentLink = { href: vorgangsLink(b, "pachtvertrag"), text: "Im Formular bearbeiten", tipp: "Öffnet das ausführliche Formular „Landpachtvertrag“ im Vorgang — dort lassen sich alle Angaben ändern; danach „Entwurf speichern“" };
  const textLink: AssistentLink = { href: vorgangsLink(b, "pachtvertrag", true), text: "Vertragstext ansehen", tipp: "Öffnet den vollständigen Vertragstext mit den aktuellen Angaben — genau so sehen ihn die Parteien" };
  const g = u.einstellungen.gutschein;
  const weitere = (extra: (Aktion | null)[] = []) => [...extra, externAktion(b, { platz: "weitere", dran: false }), paarBeenden(b)];

  if (!pv || pv.status === "verworfen") {
    const d = pachtVorschlag(ctx);
    const rest = pachtLuecken({ ...d, pachtzinsJeHa: 1 });
    return {
      stand: `Die Kontaktdaten sind seit dem ${datum(v.freigabe?.am)} freigegeben — jetzt sprechen die Parteien direkt miteinander. Sind sie sich einig, bereitet der Assistent den Pachtvertrag vor (im Kern fehlt nur der Pachtzins).`,
      warten: [{ text: "Einigung der Parteien über Pachtzins, Beginn und Laufzeit — melden sich Verpächter oder Pächter im Kundenbereich, steht der Vorgang wieder unter „Jetzt dran“", seit: v.freigabe?.am }],
      hinweise: [...hinweise, ...(vorlageHinweis ? [vorlageHinweis] : [])],
      wartet: true,
      aktion: {
        id: "pacht-vorbereiten",
        platz: "haupt",
        knopf: "Pachtvertrag vorbereiten",
        tipp: "Erst, wenn sich die Parteien einig sind: legt den Pachtvertrag-Entwurf aus den Angaben beider Seiten an — Sie tragen nur den Pachtzins ein. Es geht noch nichts raus.",
        frage: "Pachtvertrag mit diesem Pachtzins vorbereiten?",
        passiert: [
          `Entwurf aus den Angaben beider Seiten: Verpächter ${d.verpaechter.name || "—"}, Pächter ${d.paechter.name || "—"}, ${flaechenKurz(d.flaechen)}, Beginn ${T.tagDe(d.pachtBeginn)}, ${d.laufzeitJahre ? `${d.laufzeitJahre} Pachtjahre` : "unbestimmte Zeit"} — alles im Formular „Landpachtvertrag“ änderbar.`,
          "Den eingegebenen Pachtzins eintragen.",
          ...(rest.length ? [`Danach im Formular noch zu ergänzen: ${rest.join(", ")}.`] : []),
          "Die Parteien sehen den Vertrag erst nach „Zur Unterschrift geben“.",
        ],
        mails: [],
        felder: zinsFelder(),
        flaecheHa: M.summeHa(d.flaechen),
        dran: false,
      },
      neben: weitere(),
      extra: [pv?.status ?? "", pv?.geaendertAm ?? ""],
    };
  }

  if (pv.status === "entwurf") {
    const luecken = pachtLuecken(pv.daten);
    const rest = luecken.filter((l) => !l.startsWith("Pachtzins"));
    if (M.jahrespacht(pv.daten) == null) {
      return {
        stand: "Der Pachtvertrag ist im Entwurf — es fehlt noch der Pachtzins.",
        hinweise: [...hinweise, ...(vorlageHinweis ? [vorlageHinweis] : [])],
        aktion: {
          id: "pacht-vorbereiten",
          platz: "haupt",
          knopf: "Pachtzins eintragen",
          tipp: "Trägt den Pachtzins in den vorhandenen Entwurf ein. Es geht noch nichts raus.",
          frage: "Diesen Pachtzins in den Entwurf eintragen?",
          passiert: ["Den eingegebenen Pachtzins in den Entwurf eintragen — die übrigen Angaben bleiben, wie sie sind.", ...(rest.length ? [`Danach im Formular noch zu ergänzen: ${rest.join(", ")}.`] : [])],
          mails: [],
          felder: zinsFelder(pv.daten),
          flaecheHa: M.summeHa(pv.daten.flaechen),
          link: formularLink,
          dran: true,
        },
        neben: weitere(),
        extra: [pv.status, pv.geaendertAm],
      };
    }
    const jp = M.jahrespacht(pv.daten);
    const mp = M.massgeblicheJahrespacht(pv.daten);
    const prov = M.provisionBerechnen("pacht", mp, konditionen ?? M.aktuelleKonditionen(u.einstellungen));
    // Die Mitteilungen entstehen erst mit „zur Unterschrift“ — für die Anzeige mit diesem Stand erzeugen.
    const sim: M.VorgangRecord = { ...v, pachtvertrag: { ...pv, status: "zur_unterschrift", unterschriften: {} } };
    const mails = paarEntwuerfe(b, sim)
      .filter((e) => e.zweck === "pachtvertrag")
      .map((e) => mailAus(e, seite(b, e.rolle!)));
    const gesperrt = rest.length
      ? `Im Entwurf fehlt noch: ${rest.join(", ")} — bitte im Formular „Landpachtvertrag“ ergänzen und „Entwurf speichern“.`
      : !vorlageFrei
        ? "Die Vorlage „Landpachtvertrag“ ist noch nicht freigegeben (Verwaltung → Vorlagen)."
        : undefined;
    const s = seite(b, "suchender");
    return {
      stand: `Pachtvertrag im Entwurf: Jahrespacht ${M.euro(jp)} (netto)${mp !== jp ? `, maßgeblich für die Provision ${M.euro(mp)}` : ""} · Provision ${M.euro(prov.netto)} netto / ${M.euro(prov.brutto)} brutto${konditionen ? ` (Konditionen Nr. ${konditionen.version})` : ""}.`,
      hinweise,
      aktion: {
        id: "pacht-unterschrift",
        platz: "haupt",
        knopf: "Zur Unterschrift geben & beide informieren",
        tipp: gesperrt ?? "Schreibt den Vertragstext fest, zeigt ihn beiden im Kundenbereich zur Online-Unterschrift und sendet beiden die Mitteilung (vorher wird nachgefragt)",
        frage: "Pachtvertrag jetzt beiden zur Unterschrift geben und beide informieren?",
        passiert: [
          `Vertragstext festschreiben (Jahrespacht ${M.euro(jp)} netto, ${flaechenKurz(pv.daten.flaechen)}, Beginn ${T.tagDe(pv.daten.pachtBeginn)}) — ändern danach nur über „Zurück zum Entwurf“; geleistete Unterschriften verfallen dann.`,
          "Verpächter und Pächter sehen den Vertrag im Kundenbereich und unterschreiben online (Textform, § 585a BGB).",
          "Mit der zweiten Unterschrift ist der Vertrag geschlossen und die Provision fällig.",
        ],
        mails,
        folgeMails: [
          `Nach der zweiten Unterschrift automatisch: der Landpachtvertrag als PDF an beide${g?.aktiv && g.betrag > 0 ? `; der Pächter ${s.name} erhält darin zusätzlich einen Treue-Gutschein über ${M.euro(g.betrag)}` : ""}. Die Texte stehen danach im Verlauf.`,
        ],
        vorschau: textLink,
        gesperrt,
        link: rest.length ? formularLink : !vorlageFrei ? { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Landpachtvertrag“ freigeben" } : formularLink,
        dran: !gesperrt,
      },
      neben: weitere(),
      extra: [pv.status, pv.geaendertAm],
    };
  }

  if (pv.status === "zur_unterschrift") {
    const felder = [
      { rolle: "anbieter" as const, feld: "verpaechter" as const, gen: "des Verpächters", wer: "Verpächter" },
      { rolle: "suchender" as const, feld: "paechter" as const, gen: "des Pächters", wer: "Pächter" },
    ];
    const entw = paarEntwuerfe(b).filter((e) => e.zweck === "pachtvertrag");
    const unterschrieben = felder.filter((f) => pv.unterschriften[f.feld]).map((f) => `${f.wer} hat den Pachtvertrag am ${datum(pv.unterschriften[f.feld]!.am)} unterschrieben`);
    const warten = felder
      .filter((f) => !pv.unterschriften[f.feld])
      .map((f) => {
        const e = entw.find((x) => x.rolle === f.rolle);
        return { text: `Unterschrift ${f.gen} ${seite(b, f.rolle).name} unter dem Pachtvertrag — ${e?.gesendetAm ? `Mitteilung gesendet am ${datum(e.gesendetAm)}` : "Mitteilung noch nicht gesendet"}`, seit: e?.gesendetAm ?? pv.geaendertAm };
      });
    const zuFrueh: string[] = [];
    const mails: AssistentMail[] = [];
    for (const e of entw.filter((x) => !x.gesperrt)) {
      const bis = erinnerungGesperrtBis(e.gesendetAm, b.jetzt);
      if (bis) zuFrueh.push(`${M.ROLLE_NAME[e.rolle!]}: zuletzt am ${datum(e.gesendetAm)} angeschrieben — Erinnerung frühestens ab ${zeitKurz(bis)}`);
      else mails.push(mailAus(e, seite(b, e.rolle!)));
    }
    const neu = mails.filter((m) => !m.zuletzt);
    const alleNeu = mails.length > 0 && neu.length === mails.length;
    return {
      stand: `Der Pachtvertrag liegt beiden zur Unterschrift vor${unterschrieben.length ? ` — ${unterschrieben.join(" · ")}` : ""}.`,
      warten,
      hinweise,
      wartet: neu.length === 0,
      aktion:
        mails.length || zuFrueh.length
          ? {
              id: "pacht-erinnern",
              platz: "haupt",
              knopf: alleNeu ? (mails.length === 2 ? "Beide informieren" : `${seite(b, mails[0].rolle).akk} informieren`) : "Erinnerung senden",
              tipp: mails.length ? "Sendet die Mitteilung „Pachtvertrag zur Unterschrift“ mit Direktlink an alle, die noch nicht unterschrieben haben (vorher wird nachgefragt)" : `Gesperrt: ${zuFrueh.join(" · ")}`,
              frage: alleNeu ? "Mitteilung „Pachtvertrag zur Unterschrift“ jetzt senden?" : "Erinnerung an die Unterschrift senden?",
              passiert: ["Mitteilung mit Direktlink in den Kundenbereich an alle, die noch nicht unterschrieben haben.", ...zuFrueh.map((z) => `Nicht erneut: ${z}.`), "Unterschreiben können nur Verpächter und Pächter selbst, online im Kundenbereich."],
              mails,
              gesperrt: mails.length ? undefined : zuFrueh.join(" · "),
              link: textLink,
              dran: neu.length > 0,
            }
          : null,
      neben: weitere([
        {
          id: "pacht-zurueck",
          platz: "weitere",
          dran: false,
          knopf: "Zurück zum Entwurf",
          tipp: "Macht den Pachtvertrag wieder bearbeitbar (z. B. für einen Änderungswunsch) — bereits geleistete Unterschriften verfallen",
          frage: "Pachtvertrag zurück zum Entwurf?",
          passiert: [
            "Der Pachtvertrag wird wieder bearbeitbar; beide sehen ihn nicht mehr zur Unterschrift.",
            ...(unterschrieben.length ? ["Die bereits geleistete Unterschrift verfällt und muss neu erfolgen."] : []),
            "Danach im Formular ändern und erneut „Zur Unterschrift geben & beide informieren“.",
          ],
          mails: [],
        },
      ]),
      extra: [pv.status, pv.geaendertAm, Object.keys(pv.unterschriften)],
    };
  }
  return { stand: "Der Pachtvertrag ist geschlossen.", hinweise, aktion: null };
}

function schrittKauf(b: Bau, v: M.VorgangRecord, hinweise: AssistentHinweis[]): Teil {
  const { ctx, u } = b;
  const k = v.kauf;
  const vorlageFrei = istFreigegeben(u.einstellungen, "kaufabsicht");
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  const preisFeld = (wert?: number | null): AssistentFeld => ({
    name: "kaufpreis",
    typ: "zahl",
    label: "Kaufpreis (Vorstellung, €)",
    pflicht: true,
    wert: wert != null ? zahlText(wert) : "",
    platzhalter: "z. B. 120.000",
    tipp: "Angestrebter Kaufpreis — verbindlich wird er erst beim Notar",
  });
  const vorlageHinweis: AssistentHinweis | null = !vorlageFrei ? { warn: true, text: "Die Vorlage „Kaufabsicht“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — vorbereiten geht, zur Bestätigung erst nach der Freigabe." } : null;
  const formularLink: AssistentLink = { href: vorgangsLink(b, "kauf"), text: "Im Formular bearbeiten", tipp: "Öffnet das ausführliche Formular für die Eckdaten (Übergabe, bestehende Pacht, Notar)" };
  const textLink: AssistentLink = { href: vorgangsLink(b, "kauf", true), text: "Eckdaten ansehen", tipp: "Öffnet die Kaufabsicht mit den aktuellen Angaben — genau so sehen sie die Parteien" };
  const zurueck: Aktion = {
    id: "kauf-zurueck",
    platz: "weitere",
    dran: false,
    knopf: "Zurück zum Entwurf",
    tipp: "Macht die Eckdaten wieder bearbeitbar — bereits abgegebene Bestätigungen verfallen",
    frage: "Eckdaten zurück zum Entwurf?",
    passiert: ["Die Eckdaten werden wieder bearbeitbar; abgegebene Bestätigungen verfallen.", "Danach im Formular ändern und erneut „Zur Bestätigung geben & beide informieren“."],
    mails: [],
  };

  if (!k || k.status === "abgebrochen" || (k.status === "entwurf" && k.daten.kaufpreis == null)) {
    const d = k && k.status === "entwurf" ? k.daten : kaufVorschlag(ctx);
    const vorhanden = Boolean(k && k.status === "entwurf");
    return {
      stand: vorhanden
        ? "Die Eckdaten für den Notar sind im Entwurf — es fehlt noch der Kaufpreis."
        : `Die Kontaktdaten sind seit dem ${datum(v.freigabe?.am)} freigegeben — jetzt sprechen die Parteien direkt miteinander. Sind sie sich einig, bereitet der Assistent die Eckdaten für den Notar vor (im Kern fehlt nur der Kaufpreis).`,
      warten: vorhanden ? [] : [{ text: "Einigung der Parteien über den Kaufpreis — melden sich Verkäufer oder Käufer im Kundenbereich, steht der Vorgang wieder unter „Jetzt dran“", seit: v.freigabe?.am }],
      hinweise: [...hinweise, ...(vorlageHinweis ? [vorlageHinweis] : [])],
      wartet: !vorhanden,
      aktion: {
        id: "kauf-vorbereiten",
        platz: "haupt",
        knopf: vorhanden ? "Kaufpreis eintragen" : "Eckdaten vorbereiten",
        tipp: "Erst, wenn sich die Parteien einig sind: legt die Eckdaten aus den Angaben beider Seiten an — Sie tragen nur den Kaufpreis ein. Es geht noch nichts raus.",
        frage: vorhanden ? "Diesen Kaufpreis eintragen?" : "Eckdaten mit diesem Kaufpreis vorbereiten?",
        passiert: [
          `Eckdaten aus den Angaben beider Seiten: Verkäufer ${d.verkaeufer.name || "—"}, Käufer ${d.kaeufer.name || "—"}, ${flaechenKurz(d.flaechen)} — alles im Bereich „Kauf“ änderbar.`,
          "Den eingegebenen Kaufpreis eintragen — verbindlich wird er erst beim Notar.",
        ],
        mails: [],
        felder: [preisFeld(d.kaufpreis)],
        link: vorhanden ? formularLink : undefined,
        dran: vorhanden,
      },
      neben: [externAktion(b, { platz: "weitere", dran: false }), paarBeenden(b)],
      extra: [k?.status ?? "", k?.geaendertAm ?? ""],
    };
  }

  if (k.status === "entwurf") {
    const sim: M.VorgangRecord = { ...v, kauf: { ...k, status: "zur_bestaetigung", bestaetigungen: {} } };
    const mails = paarEntwuerfe(b, sim)
      .filter((e) => e.zweck === "kaufabsicht")
      .map((e) => mailAus(e, seite(b, e.rolle!)));
    const gesperrt = !vorlageFrei ? "Die Vorlage „Kaufabsicht“ ist noch nicht freigegeben (Verwaltung → Vorlagen)." : undefined;
    return {
      stand: `Eckdaten im Entwurf: Kaufpreis-Vorstellung ${M.euro(k.daten.kaufpreis)}, ${flaechenKurz(k.daten.flaechen)}.`,
      hinweise,
      aktion: {
        id: "kauf-bestaetigung",
        platz: "haupt",
        knopf: "Zur Bestätigung geben & beide informieren",
        tipp: gesperrt ?? "Schreibt die Eckdaten fest, zeigt sie beiden im Kundenbereich zur unverbindlichen Bestätigung und sendet beiden die Mitteilung (vorher wird nachgefragt)",
        frage: "Eckdaten jetzt beiden zur (unverbindlichen) Bestätigung geben und beide informieren?",
        passiert: [
          `Eckdaten festschreiben (Kaufpreis-Vorstellung ${M.euro(k.daten.kaufpreis)}) — ändern danach nur über „Zurück zum Entwurf“.`,
          "Verkäufer und Käufer sehen die Eckdaten im Kundenbereich und bestätigen sie unverbindlich — der Kaufvertrag entsteht erst beim Notar.",
          "Haben beide bestätigt, liegt das PDF für den Notar in den Dokumenten.",
        ],
        mails,
        vorschau: textLink,
        gesperrt,
        link: gesperrt ? { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Kaufabsicht“ freigeben" } : formularLink,
        dran: !gesperrt,
      },
      neben: [externAktion(b, { platz: "weitere", dran: false }), paarBeenden(b)],
      extra: [k.status, k.geaendertAm],
    };
  }

  if (k.status === "zur_bestaetigung") {
    const felder = [
      { rolle: "anbieter" as const, feld: "verkaeufer" as const, gen: "des Verkäufers", wer: "Verkäufer" },
      { rolle: "suchender" as const, feld: "kaeufer" as const, gen: "des Käufers", wer: "Käufer" },
    ];
    const entw = paarEntwuerfe(b).filter((e) => e.zweck === "kaufabsicht");
    const bestaetigt = felder.filter((f) => k.bestaetigungen[f.feld]).map((f) => `${f.wer} hat am ${datum(k.bestaetigungen[f.feld]!.am)} bestätigt`);
    const warten = felder
      .filter((f) => !k.bestaetigungen[f.feld])
      .map((f) => {
        const e = entw.find((x) => x.rolle === f.rolle);
        return { text: `Bestätigung ${f.gen} ${seite(b, f.rolle).name} — ${e?.gesendetAm ? `Mitteilung gesendet am ${datum(e.gesendetAm)}` : "Mitteilung noch nicht gesendet"}`, seit: e?.gesendetAm ?? k.geaendertAm };
      });
    const zuFrueh: string[] = [];
    const mails: AssistentMail[] = [];
    for (const e of entw.filter((x) => !x.gesperrt)) {
      const bis = erinnerungGesperrtBis(e.gesendetAm, b.jetzt);
      if (bis) zuFrueh.push(`${M.ROLLE_NAME[e.rolle!]}: zuletzt am ${datum(e.gesendetAm)} angeschrieben — Erinnerung frühestens ab ${zeitKurz(bis)}`);
      else mails.push(mailAus(e, seite(b, e.rolle!)));
    }
    const neu = mails.filter((m) => !m.zuletzt);
    const alleNeu = mails.length > 0 && neu.length === mails.length;
    return {
      stand: `Die Eckdaten liegen beiden zur Bestätigung vor${bestaetigt.length ? ` — ${bestaetigt.join(" · ")}` : ""}.`,
      warten,
      hinweise,
      wartet: neu.length === 0,
      aktion:
        mails.length || zuFrueh.length
          ? {
              id: "kauf-erinnern",
              platz: "haupt",
              knopf: alleNeu ? (mails.length === 2 ? "Beide informieren" : `${seite(b, mails[0].rolle).akk} informieren`) : "Erinnerung senden",
              tipp: mails.length ? "Sendet die Bitte um Bestätigung der Eckdaten mit Direktlink an alle, die noch nicht bestätigt haben (vorher wird nachgefragt)" : `Gesperrt: ${zuFrueh.join(" · ")}`,
              frage: alleNeu ? "Bitte um Bestätigung jetzt senden?" : "Erinnerung an die Bestätigung senden?",
              passiert: ["Bitte um Bestätigung der Eckdaten mit Direktlink in den Kundenbereich an alle, die noch nicht bestätigt haben.", ...zuFrueh.map((z) => `Nicht erneut: ${z}.`)],
              mails,
              gesperrt: mails.length ? undefined : zuFrueh.join(" · "),
              link: textLink,
              dran: neu.length > 0,
            }
          : null,
      neben: [zurueck, paarBeenden(b)],
      extra: [k.status, k.geaendertAm, Object.keys(k.bestaetigungen)],
    };
  }

  if (k.status === "bestaetigt") {
    const g = u.einstellungen.gutschein;
    const kaeufer = seite(b, "suchender");
    return {
      stand: "Beide haben die Eckdaten bestätigt — das PDF für den Notar liegt in den Dokumenten.",
      warten: [{ text: `Notarielle Beurkundung${k.notar.name ? ` bei ${k.notar.name}` : ""}${k.notar.termin ? ` am ${T.tagDe(k.notar.termin)}` : " (noch kein Termin eingetragen)"} — danach hier erfassen`, seit: k.geaendertAm }],
      hinweise,
      wartet: true,
      aktion: {
        id: "kauf-beurkundet",
        platz: "haupt",
        knopf: "Beurkundung erfassen",
        tipp: v.freigabe ? "Nach dem Notartermin: erfasst die Beurkundung und legt die Provision an (vorher wird nachgefragt)" : SPERRE_FREIGABE,
        frage: "Beurkundung erfassen?",
        passiert: [
          "Beurkundung mit Datum und Kaufpreis laut Urkunde erfassen — der Vorgang gilt damit als abgeschlossen.",
          `Provision anlegen: ${konditionen ? `${M.konditionenText("kauf", konditionen)} (Konditionen Nr. ${konditionen.version})` : "kein unterschriebener Nachweisvertrag des Käufers gefunden — Anspruch prüfen"}; fällig erst mit Wirksamkeit (Genehmigung nach GrdstVG), bei „nicht nötig“ oder „bereits erteilt“ sofort.`,
        ],
        mails: [],
        folgeMails:
          g?.aktiv && g.betrag > 0 && ctx.suchender
            ? [`Treue-Gutschein über ${M.euro(g.betrag)} an den Käufer ${kaeufer.name} (${kaeufer.an}) — Mail mit Code und Bedingungen; der Text steht danach im Verlauf.`]
            : undefined,
        felder: [
          { name: "datum", typ: "datum", label: "Beurkundet am", pflicht: true, wert: k.notar.termin ?? "", tipp: "Datum der notariellen Beurkundung" },
          { name: "kaufpreis", typ: "zahl", label: "Kaufpreis laut Urkunde (€)", pflicht: true, wert: k.daten.kaufpreis != null ? zahlText(k.daten.kaufpreis) : "", tipp: "Beurkundeter Kaufpreis — Grundlage der Provision" },
          {
            name: "genehmigung",
            typ: "auswahl",
            label: "Genehmigung (GrdstVG)",
            wert: "beantragt",
            optionen: [
              { wert: "beantragt", label: "beantragt / ausstehend" },
              { wert: "nicht_noetig", label: "nicht nötig (bis 1 ha)" },
              { wert: "erteilt", label: "bereits erteilt" },
            ],
            tipp: "Ohne erforderliche Genehmigung ist der Kaufvertrag schwebend unwirksam — die Provision wird erst mit der Genehmigung fällig",
          },
        ],
        link: formularLink,
        gesperrt: v.freigabe ? undefined : SPERRE_FREIGABE,
        // Die Beurkundung macht der Notar — erfasst wird sie, wenn sie stattgefunden hat.
        dran: false,
      },
      neben: [zurueck, paarBeenden(b)],
      extra: [k.status, k.geaendertAm],
    };
  }
  return { stand: `Kauf: ${k.status}.`, hinweise, aktion: null };
}

// ---------------------------------------------------------------------------
// Nach dem Abschluss: Provision (Schritt 7), Pachtanzeige, Bewertungsbitte

/**
 * Bitte um eine Google-Bewertung, sobald fällig (Einstellung „nach … Tagen“) — nur an Seiten mit
 * Einwilligung, nicht bei eingeschaltetem Automatikversand (dann schickt der Cron) und nicht, wenn
 * die Verwaltung darauf verzichtet hat.
 */
function bewertungAktion(b: Bau): Aktion | null {
  const v = b.ctx.vorgang;
  if (!v?.abschluss || !b.u.bewertungsUrl || v.bewertungVerzicht || b.u.einstellungen.bewertung?.autoVersand) return null;
  const rollen = bewertungFaellig(v, b.u.einstellungen, b.jetzt).filter((r) => M.bewertungsmailErlaubt(seite(b, r).k));
  const entwuerfe = paarEntwuerfe(b);
  const mails = rollen.flatMap((r) => {
    const e = entwuerfe.find((x) => x.zweck === "bewertung" && x.rolle === r);
    return e && !e.gesperrt ? [mailAus(e, seite(b, r))] : [];
  });
  if (mails.length === 0) return null;
  return {
    id: "bewertung-bitten",
    platz: "zusatz",
    dran: false,
    knopf: "Um Google-Bewertung bitten",
    tipp: "Freiwillige Bitte um eine ehrliche Bewertung — nur an Kunden mit Einwilligung, ohne Gegenleistung (vorher wird nachgefragt)",
    frage: "Um eine Google-Bewertung bitten?",
    passiert: [
      "Freundliche Bitte um eine ehrliche Bewertung — ohne Gegenleistung, ohne Vorgaben zu Sternen oder Inhalt.",
      "Nur an Kunden, die beim Vertragsschluss eingewilligt haben. Die Bitte wird im Vorgang vermerkt und nicht erneut vorgeschlagen.",
    ],
    mails,
  };
}

const BEWERTUNG_VERZICHT: Aktion = {
  id: "bewertung-verzicht",
  platz: "weitere",
  dran: false,
  knopf: "Keine Bewertungsbitte senden",
  tipp: "Den Vorgang ohne Bitte um eine Bewertung abschließen (z. B. wenn der Kunde unzufrieden war)",
  frage: "Auf die Bitte um eine Bewertung verzichten?",
  passiert: ["Vermerkt, dass bei diesem Vorgang nicht um eine Bewertung gebeten wird — der Knopf erscheint nicht mehr."],
  mails: [],
};

function provisionChip(p: M.Provision | undefined, heuteStr: string): AssistentChip[] {
  if (!p) return [];
  const betrag = `${M.euro(M.provisionNachGutschein(p).netto)} netto`;
  if (p.status === "abgerechnet") {
    const bis = M.provisionZahlungBis(p);
    const ueber = bis != null && bis < heuteStr;
    return [{ text: ueber ? `Zahlung überfällig seit ${T.tagDe(tagDanach(bis))}: ${betrag}` : `Zahlung offen bis ${T.tagDe(bis)}: ${betrag}`, art: ueber ? "rot" : "warn", tipp: `Provision abgerechnet${p.rechnung ? ` (Rechnung vom ${T.tagDe(p.rechnung.datum)})` : ""} — Zahlung steht aus` }];
  }
  return [{ text: `Provision ${M.PROVISION_STATUS[p.status].label}: ${betrag}`, art: p.status === "bezahlt" ? "ok" : p.status === "aufschiebend" ? "grau" : "warn", tipp: M.PROVISION_STATUS[p.status].tipp }];
}

function nacharbeit(b: Bau): Teil {
  const { ctx } = b;
  const v = ctx.vorgang!;
  const heuteStr = heute(b.jetzt);
  const hinweise: AssistentHinweis[] = [];
  const bewertung = bewertungAktion(b);
  const chips: AssistentChip[] = [];
  const pv = v.pachtvertrag;
  if (pv?.status === "abgeschlossen") {
    const dok = v.dokumente.find((d) => d.id === pv.dokumentId);
    chips.push({ text: dok ? "Pachtvertrag geschlossen (PDF)" : `Pachtvertrag geschlossen am ${datum(pv.abgeschlossenAm)}`, art: "ok", tipp: dok ? `Geschlossen am ${datum(pv.abgeschlossenAm)} — öffnet das PDF mit beiden Unterschriftsprotokollen` : "Das PDF fehlt noch (im Vorgang „PDF und Provision nachholen“)", href: dok ? `/admin/dokument/${dok.id}?v=${encodeURIComponent(ctx.key)}` : undefined });
  } else if (v.kauf?.notar.beurkundetAm) {
    chips.push({ text: `Kaufvertrag beurkundet am ${T.tagDe(v.kauf.notar.beurkundetAm)}`, art: "ok", tipp: `Kaufpreis laut Urkunde ${M.euro(v.kauf.notar.kaufpreis)}` });
  } else if (v.abschluss?.grundlage === "extern") {
    chips.push({ text: `Außerhalb geschlossen (erfasst ${datum(v.abschluss.am)})`, art: "ok", tipp: "Vertrag ohne die Plattform geschlossen und in der Verwaltung erfasst" });
  }

  // Pachtanzeige (§ 2 LPachtVG): Pflicht des Verpächters binnen eines Monats — sichtbar, bis sie vermerkt ist.
  const anzeigeOffen = pv?.status === "abgeschlossen" && !pv.anzeigeErledigtAm;
  const anzeigeFrist = anzeigeOffen && pv?.abgeschlossenAm ? einenMonatSpaeter(pv.abgeschlossenAm) : null;
  const anzeigeUeberfaellig = Boolean(anzeigeFrist && heuteStr > anzeigeFrist);
  const anzeigeAktionen: Aktion[] = [];
  const anzeigeWarten: AssistentWarten[] = [];
  if (anzeigeOffen) {
    const anbieter = seite(b, "anbieter");
    anzeigeWarten.push({ text: `Pachtanzeige durch den Verpächter ${anbieter.name} bei der Landwirtschaftskammer bis ${T.tagDe(anzeigeFrist)}${anzeigeUeberfaellig ? " — Frist abgelaufen" : ""}`, seit: pv?.abgeschlossenAm });
    anzeigeAktionen.push({
      id: "anzeige-vermerken",
      platz: "zusatz",
      dran: anzeigeUeberfaellig,
      knopf: "Pachtanzeige erledigt",
      tipp: "Vermerkt, dass der Verpächter den Vertrag bei der Landwirtschaftskammer angezeigt hat (§ 2 LPachtVG)",
      frage: "Pachtanzeige als erledigt vermerken?",
      passiert: ["Die Anzeige nach § 2 LPachtVG wird als erledigt vermerkt — die Erinnerung verschwindet."],
      mails: [],
    });
    const e = paarEntwuerfe(b).find((x) => x.zweck === "anzeige");
    if (e) {
      // Die Abschluss-Mail mit dem PDF enthält den Hinweis schon — frühestens 2 Tage danach erinnern.
      const abschlussAm = pv?.abgeschlossenAm;
      const zuletzt = [e.gesendetAm, abschlussAm].filter((x): x is string => Boolean(x)).sort().pop();
      const bis = erinnerungGesperrtBis(zuletzt, b.jetzt);
      const sperre = !bis
        ? undefined
        : zuletzt === e.gesendetAm
          ? `zuletzt am ${datum(e.gesendetAm)} erinnert — frühestens ab ${zeitKurz(bis)}`
          : `der Hinweis stand schon in der Abschluss-Mail vom ${datum(abschlussAm)} — erinnern frühestens ab ${zeitKurz(bis)}`;
      anzeigeAktionen.push({
        id: "anzeige-erinnern",
        platz: "zusatz",
        dran: false,
        knopf: "An die Pachtanzeige erinnern",
        tipp: sperre ? `Gesperrt: ${sperre}` : "Erinnert den Verpächter per E-Mail an die Anzeigepflicht (vorher wird nachgefragt)",
        frage: "Den Verpächter an die Pachtanzeige erinnern?",
        passiert: ["Erinnerungs-Mail an den Verpächter: Anzeige des Pachtvertrags binnen eines Monats bei der Landwirtschaftskammer (§ 2 LPachtVG)."],
        mails: sperre ? [] : [mailAus(e, anbieter)],
        gesperrt: sperre,
      });
    }
  }

  const provs = v.provisionen.filter((p) => p.status !== "storniert");
  const faellig = provs.find((p) => p.status === "faellig");
  const abgerechnet = provs.filter((p) => p.status === "abgerechnet");
  const ueberfaellig = abgerechnet.find((p) => (M.provisionZahlungBis(p) ?? "9999-12-31") < heuteStr);
  const offen = abgerechnet[0];
  const aufschiebend = provs.find((p) => p.status === "aufschiebend");
  const suchender = seite(b, "suchender");
  const betrag = (p: M.Provision) => {
    const n = M.provisionNachGutschein(p);
    return `${M.euro(n.netto)} netto / ${M.euro(n.brutto)} brutto`;
  };
  const extra = provs.map((p) => [p.id, p.status, p.rechnung?.faelligAm ?? ""]);

  if (provs.length === 0) {
    const reparatur = pv?.status === "abgeschlossen" && !v.dokumente.some((d) => d.id === pv.dokumentId);
    return {
      stand: "Der Vertrag ist geschlossen, aber es ist keine Provision erfasst.",
      hinweise: [...hinweise, { warn: true, text: reparatur ? "Beim Abschluss fehlen PDF bzw. Provision — im Vorgang im Bereich „Landpachtvertrag“ „PDF und Provision nachholen“ klicken." : "Bitte im Vorgang unter „Provision“ prüfen." }],
      warten: anzeigeWarten,
      aktion: null,
      neben: [...anzeigeAktionen, bewertung],
      chips,
      nachOffen: true,
      extra,
    };
  }
  const zeigeProv = faellig ?? ueberfaellig ?? offen ?? aufschiebend ?? provs[0];
  chips.push(...provisionChip(zeigeProv, heuteStr));

  if (faellig) {
    return {
      stand: `Provision ${betrag(faellig)} ist fällig — die Rechnung stellt die Buchhaltung (hier wird keine Rechnungsnummer vergeben). Schuldner: Suchender ${suchender.name}.`,
      warten: anzeigeWarten,
      hinweise,
      aktion: {
        id: "provision-abgerechnet",
        ziel: faellig.id,
        platz: "haupt",
        dran: true,
        knopf: "Als abgerechnet markieren",
        tipp: "Sobald die Buchhaltung die Rechnung gestellt hat: Rechnungsdatum und Zahlungsziel vermerken (vorher wird nachgefragt)",
        frage: "Provision als abgerechnet markieren?",
        passiert: [
          `Die Provision (${betrag(faellig)}) wird als „Abgerechnet“ vermerkt — mit Rechnungsdatum, Zahlungsziel und Ihrer Notiz im Verlauf.`,
          "Bis zum Zahlungsziel steht der Vorgang unter „Warten“ („Zahlung offen“), danach wieder unter „Jetzt dran“ („überfällig“).",
        ],
        mails: [],
        felder: [
          { name: "rechnungsdatum", typ: "datum", label: "Rechnung vom", pflicht: true, wert: heuteStr, tipp: "Datum der Rechnung der Buchhaltung" },
          { name: "zahlungsziel", typ: "zahl", label: "Zahlungsziel (Tage)", pflicht: true, wert: String(M.ZAHLUNGSZIEL_TAGE), tipp: "Wie viele Tage der Suchende für die Zahlung hat — Standard 14" },
          { name: "notiz", typ: "text", label: "Notiz (freiwillig)", platzhalter: "z. B. Rechnung per Post", tipp: "Erscheint im Verlauf der Provision" },
        ],
      },
      neben: [...anzeigeAktionen, bewertung],
      chips,
      nachOffen: true,
      extra,
    };
  }
  const bezahltAktion = (p: M.Provision, dran: boolean): Aktion => ({
    id: "provision-bezahlt",
    ziel: p.id,
    platz: "haupt",
    dran,
    knopf: "Als bezahlt markieren",
    tipp: "Vermerkt den Zahlungseingang (vorher wird nachgefragt)",
    frage: "Provision als bezahlt markieren?",
    passiert: [`Die Provision (${betrag(p)}) wird als „Bezahlt“ vermerkt — mit Ihrer Notiz im Verlauf der Provision.`],
    mails: [],
    felder: [{ name: "notiz", typ: "text", label: "Notiz (freiwillig)", platzhalter: "z. B. Zahlungseingang am 15.10.2026", tipp: "z. B. Datum des Zahlungseingangs — erscheint im Verlauf der Provision" }],
  });
  if (ueberfaellig) {
    const bis = M.provisionZahlungBis(ueberfaellig);
    return {
      stand: `Die Zahlung der Provision (${betrag(ueberfaellig)}) ist überfällig seit ${T.tagDe(tagDanach(bis))} — zahlbar war sie bis ${T.tagDe(bis)}${ueberfaellig.rechnung ? ` (Rechnung vom ${T.tagDe(ueberfaellig.rechnung.datum)})` : ""}.`,
      warten: anzeigeWarten,
      hinweise: [...hinweise, { warn: true, text: `Bei der Buchhaltung bzw. beim Suchenden ${suchender.name} nachhaken; bei Zahlungseingang „Als bezahlt markieren“.` }],
      aktion: bezahltAktion(ueberfaellig, true),
      neben: [...anzeigeAktionen, bewertung],
      chips,
      nachOffen: true,
      extra,
    };
  }
  if (offen) {
    const bis = M.provisionZahlungBis(offen);
    return {
      stand: `Provision abgerechnet${offen.rechnung ? ` (Rechnung vom ${T.tagDe(offen.rechnung.datum)})` : ""} — die Zahlung ist offen bis ${T.tagDe(bis)}.`,
      warten: [{ text: `Zahlung der Provision (${betrag(offen)}) durch den Suchenden ${suchender.name} bis ${T.tagDe(bis)}`, seit: offen.rechnung?.datum ?? offen.verlauf[0]?.am }, ...anzeigeWarten],
      hinweise,
      wartet: true,
      aktion: bezahltAktion(offen, false),
      neben: [...anzeigeAktionen, bewertung],
      chips,
      nachOffen: true,
      extra,
    };
  }
  if (aufschiebend) {
    if (v.kauf?.status === "beurkundet") {
      return {
        stand: `Provision ${betrag(aufschiebend)} ist entstanden, aber erst mit Wirksamkeit des Kaufvertrags fällig.`,
        warten: [{ text: "Genehmigung nach dem Grundstückverkehrsgesetz (Landwirtschaftskammer) — erst dann ist der Kaufvertrag wirksam und die Provision fällig", seit: v.kauf.notar.beurkundetAm }],
        hinweise,
        wartet: true,
        aktion: {
          id: "kauf-wirksam",
          ziel: aufschiebend.id,
          platz: "haupt",
          dran: false,
          knopf: "Kauf ist wirksam",
          tipp: "Sobald die Genehmigung erteilt ist: vermerken — die Provision wird fällig (vorher wird nachgefragt)",
          frage: "Kaufvertrag als wirksam erfassen?",
          passiert: ["Die Genehmigung ist erteilt: Kaufvertrag als wirksam vermerken.", `Die Provision (${betrag(aufschiebend)}) wird fällig — die Rechnung stellt die Buchhaltung.`],
          mails: [],
          felder: [{ name: "datum", typ: "datum", label: "Wirksam seit (Genehmigung erteilt am)", pflicht: true, wert: heuteStr, tipp: "Datum, an dem die Genehmigung erteilt wurde" }],
        },
        neben: [...anzeigeAktionen, bewertung],
        chips,
        nachOffen: true,
        extra,
      };
    }
    return {
      stand: `Die Provision (${betrag(aufschiebend)}) ist nur vorgemerkt${aufschiebend.notiz ? `: ${aufschiebend.notiz}` : ""}.`,
      warten: anzeigeWarten,
      hinweise: [...hinweise, { warn: true, text: "Bitte im Vorgang unter „Provision“ prüfen und den Status setzen." }],
      aktion: null,
      neben: [...anzeigeAktionen, bewertung],
      chips,
      nachOffen: true,
      extra,
    };
  }
  // Provision bezahlt — offen bleibt ggf. nur die Pachtanzeige.
  if (anzeigeOffen) {
    const [vermerken, ...rest] = anzeigeAktionen;
    return {
      stand: `Provision bezahlt. Offen ist nur noch die Pachtanzeige des Verpächters (Frist bis ${T.tagDe(anzeigeFrist)}).`,
      warten: anzeigeWarten,
      hinweise,
      wartet: !anzeigeUeberfaellig,
      aktion: { ...vermerken, platz: "haupt" },
      neben: [...rest, bewertung],
      chips,
      nachOffen: true,
      extra,
    };
  }
  if (bewertung) {
    return {
      stand: "Vertrag geschlossen und Provision bezahlt. Offen ist nur noch die freiwillige Bitte um eine Google-Bewertung.",
      hinweise,
      aktion: { ...bewertung, platz: "haupt", dran: true },
      neben: [BEWERTUNG_VERZICHT],
      chips,
      nachOffen: true,
      extra,
    };
  }
  return { stand: "Alles erledigt — Vertrag geschlossen und Provision bezahlt.", hinweise, aktion: null, chips, extra };
}

// ---------------------------------------------------------------------------

function wiederAktion(b: Bau, verworfen: boolean): Aktion {
  return verworfen
    ? {
        id: "wieder-aufnehmen",
        platz: "haupt",
        dran: false,
        knopf: "Wieder vorschlagen",
        tipp: "Macht das Verwerfen rückgängig — das Paar erscheint wieder als Vorschlag",
        frage: "Paar wieder vorschlagen?",
        passiert: ["Das Paar steht danach wieder unter „Neue Vorschläge“ (Notiz und Zustimmungen werden zurückgesetzt)."],
        mails: [],
      }
    : {
        id: "wieder-aufnehmen",
        platz: "haupt",
        dran: false,
        knopf: "Wieder aufnehmen",
        tipp: "Holt den beendeten Vorgang zurück in „Jetzt dran“ bzw. „Warten“",
        frage: "Vorgang wieder aufnehmen?",
        passiert: ["Der Vorgang erscheint wieder in den Listen — mit dem Stand, an dem er beendet wurde."],
        mails: [],
      };
}

function signatur(basis: unknown, a: Aktion): string {
  const kanon = JSON.stringify({
    b: basis,
    a: a.id,
    z: a.ziel ?? "",
    g: a.gesperrt ?? "",
    m: a.mails.map((m) => [m.zweck, m.rolle, m.an, m.zuletzt ?? "", m.neuerLink ? 1 : 0]),
  });
  return createHash("sha256").update(kanon).digest("hex").slice(0, 24);
}

/** Der Plan des Assistenten für einen Vorgang: Stand, Wartepunkte, Meldungen und genau ein Hauptknopf. */
export function assistentPlan(ctx: VorgangKontext, u: AssistentUmgebung): AssistentPlan {
  const jetzt = u.jetzt ?? new Date();
  const sch = vorgangSchritte({ art: ctx.art, meta: ctx.meta, vorgang: ctx.vorgang, anbieter: ctx.anbieter, suchender: ctx.suchender }, jetzt);
  const b: Bau = { ctx, u, jetzt, seiten: seitenVon(ctx) };
  const v = ctx.vorgang;
  const beendet = Boolean(v?.beendet && !v.abschluss && !sch.verworfen);
  const meldungen = sch.verworfen ? [] : meldungenVon(b);
  let titel = sch.aktuell?.titel ?? "";
  let teil: Teil;
  if (sch.verworfen) {
    titel = "Paar verworfen";
    teil = { stand: "Dieses Paar ist verworfen — der Assistent ruht.", aktion: wiederAktion(b, true) };
  } else if (beendet) {
    titel = "Vorgang beendet";
    teil = {
      stand: `Ohne Abschluss beendet am ${datum(v!.beendet!.am)}${v!.beendet!.grund ? ` (${v!.beendet!.grund})` : ""}. Freigabe und Nachweis bestehen weiter.`,
      aktion: wiederAktion(b, false),
      neben: [externAktion(b, { platz: "weitere", dran: false })],
      chips: [{ text: `Beendet am ${datum(v!.beendet!.am)}`, art: "grau", tipp: v!.beendet!.grund || "Ohne Abschluss beendet" }, ...freigabeChip(v!)],
    };
  } else if (v?.abschluss) {
    teil = nacharbeit(b);
    if (!sch.aktuell) titel = teil.nachOffen ? "Nacharbeiten" : "Alles erledigt";
  } else {
    switch (sch.aktuell!.id) {
      case "paar":
        teil = schrittPaar(b);
        break;
      case "einladung":
        teil = schrittEinladung(b);
        break;
      case "unterschrift":
        teil = schrittUnterschrift(b);
        break;
      case "zustimmung":
        teil = schrittZustimmung(b);
        break;
      case "freigabe":
        teil = schrittFreigabe(b);
        break;
      default:
        teil = schrittVertrag(b);
    }
  }
  const nr = sch.aktuell?.nr ?? null;
  const warten = teil.warten ?? [];
  const basis = {
    k: ctx.key,
    n: nr,
    s: teil.stand,
    w: warten,
    m: meldungen.map((m) => [m.id, m.am]),
    x: teil.extra ?? null,
    e: beendet,
  };
  const mitSignatur = (a: Aktion): AssistentAktion => ({ ...a, signatur: signatur(basis, a) });

  // Offene Meldungen haben Vorrang: dann pulsiert nur deren Knopf, der Schritt-Knopf wird ruhig.
  const hauptRoh = teil.aktion ?? null;
  const aktion = hauptRoh ? mitSignatur(meldungen.length ? { ...hauptRoh, dran: false } : hauptRoh) : null;
  const inMeldung = new Set(meldungen.flatMap((m) => m.aktionen.map((a) => `${a.id}|${a.ziel ?? ""}`)));
  const neben = (teil.neben ?? [])
    .filter((a): a is Aktion => Boolean(a))
    .filter((a) => !inMeldung.has(`${a.id}|${a.ziel ?? ""}`))
    // Liegt eine Vertragsschluss-Meldung vor, steht „Außerhalb geschlossen erfassen“ dort — nicht doppelt.
    .filter((a) => !(a.id === "extern" && meldungen.some((m) => m.art === "abschluss")))
    .map(mitSignatur);
  const fertig = !sch.verworfen && !beendet && !sch.aktuell && !teil.nachOffen && meldungen.length === 0;
  const seitWerte = warten.map((w) => w.seit).filter((s): s is string => Boolean(s)).sort();
  return {
    key: ctx.key,
    art: ctx.art,
    am: jetzt.toISOString(),
    nr,
    gesamt: sch.schritte.length,
    titel,
    stand: teil.stand,
    warten,
    wartetSeit: seitWerte[0] ?? null,
    hinweise: teil.hinweise ?? [],
    meldungen: meldungen.map((m) => ({ ...m, aktionen: m.aktionen.map(mitSignatur) })),
    aktion,
    neben,
    chips: teil.chips ?? [],
    amZug: sch.verworfen || fertig ? null : meldungen.length ? "admin" : beendet ? null : teil.wartet ? "kunde" : "admin",
    fertig,
    verworfen: sch.verworfen,
    beendet,
    test: testModus(),
  };
}
