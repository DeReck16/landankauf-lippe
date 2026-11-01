import "server-only";
import { leadView, type LeadView } from "@/lib/admin/model";
import { drosseln, kurzwert, listLeads, readZustand } from "@/lib/admin/store";
import { anbieterAbgleichFuer } from "@/lib/portal/anbieter-gruppe";
import { alleAktionen, assistentPlan } from "@/lib/portal/assistent";
import type { AssistentAktion } from "@/lib/portal/assistent-typen";
import { aufgabenAus } from "@/lib/portal/aufgaben";
import { linkErstellen, mailsSenden, type AusfuehrZeile } from "@/lib/portal/ausfuehren";
import { automatikVon, type AutomatikEinstellungen } from "@/lib/portal/automatik-regeln";
import { ladeDashboard } from "@/lib/portal/dashboard";
import * as M from "@/lib/portal/model";
import { basisUrl } from "@/lib/portal/sitzung";
import { alleKunden, istPaarKey, ladeEinstellungen } from "@/lib/portal/speicher";
import * as V from "@/lib/portal/vorgang";
import { site } from "@/lib/site";
import { eigeneAngaben, schwaerzen, type AktionErgebnis } from "./board";

// Klick-Assistent per API (Recht board:vorgang): Aufgaben, Vorgänge und Matching-Vorschläge lesen — ohne Namen, Adressen,
// Telefonnummern — und die Knöpfe ausführen, die Dennis freigegeben hat (01.11.2026): Einladen, Erinnern, Hinweise, Freigeben.
// Es gelten dieselben Sperren wie im Dashboard (`gesperrt`, Signatur des gesehenen Stands) und zusätzlich die Schalter der Automatik:
// Not-Aus stoppt alles, Hinweise und Freigabe brauchen die Bestätigungen „§ 34c-Erlaubnis“ und „Vorlagen anwaltlich geprüft“,
// Kauf bleibt in der Verwaltung. Nie per API: Zustimmungen/Einwilligungen erfassen, Verträge, Provision, Löschen, Einstellungen.

/** Knöpfe, die die API drücken darf. */
export const API_KNOEPFE = ["einladen", "erinnern", "hinweise", "freigeben", "freigabe-mitteilen", "pacht-erinnern"] as const;
export type ApiKnopf = (typeof API_KNOEPFE)[number];

/** Diese Knöpfe lösen den „Nachweis“ aus (Hinweis auf eine Fläche bzw. Freigabe der Kontakte): nur mit den Rechts-Bestätigungen. */
const RECHTSSCHALTER: readonly ApiKnopf[] = ["hinweise", "freigeben", "freigabe-mitteilen"];

/** Mehr Knopf-Aktionen je Zugang und Tag gibt es nicht (jede kann Mails an Kunden auslösen). */
export const KNOEPFE_PRO_TAG = 20;

function istErlaubterKnopf(id: string): id is ApiKnopf {
  return (API_KNOEPFE as readonly string[]).includes(id);
}

/** Warum die API diesen Knopf jetzt nicht drücken darf (null = darf, vorbehaltlich der Sperren des Systems). */
export function knopfGrund(id: string, art: M.Art, automatik: AutomatikEinstellungen): string | null {
  if (!istErlaubterKnopf(id)) return `„${id}“ gibt es per API nicht (erlaubt: ${API_KNOEPFE.join(", ")}).`;
  if (automatik.notAus) return "Not-Aus der Automatik ist an — nur die Verwaltung.";
  if (art !== "pacht") return "Kauf läuft nur in der Verwaltung (wie bei der Automatik).";
  if (RECHTSSCHALTER.includes(id) && !(automatik.recht34c && automatik.vorlagenGeprueft)) {
    return "Gesperrt, bis in den Einstellungen „§ 34c-Erlaubnis liegt vor“ und „Vorlagen anwaltlich geprüft“ bestätigt sind (dieselbe Sperre wie bei der Automatik).";
  }
  return null;
}

type Ansichten = Map<string, LeadView>;

async function ansichten(): Promise<Ansichten> {
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  return new Map(leads.map((l) => [l.id, leadView(l, zustand.anfragen[l.id])]));
}

const STRASSE = /\b[\p{L}.-]+(?:stra(?:ß|ss)e|str\.|weg|allee|platz|gasse|ring|damm|ufer|pfad)\s*\d+\s*[a-z]?\b/giu;

/** Text ohne Anschriften, Nummern und ohne Name/Mail/Telefon der genannten Anfragen. */
function rein(text: string, ids: Iterable<string>, a: Ansichten, max = 300): string {
  let t = String(text ?? "").replace(/\s+/g, " ").trim();
  for (const id of new Set(ids)) {
    const v = a.get(id);
    if (v) t = schwaerzen(t, eigeneAngaben(v));
  }
  t = schwaerzen(t, null).replace(STRASSE, "[Adresse]");
  return t.length > max ? `${t.slice(0, max - 2).trimEnd()} …` : t;
}

const idsIn = (...texte: string[]): string[] => texte.flatMap((t) => t.match(/LL-[A-Z0-9]+/g) ?? []);

function aktionAnsicht(a: AssistentAktion, art: M.Art, automatik: AutomatikEinstellungen, ids: string[], an: Ansichten) {
  const grund = knopfGrund(a.id, art, automatik);
  return {
    id: a.id,
    ziel: a.ziel ?? null,
    knopf: rein(a.knopf, ids, an, 80),
    dran: a.dran,
    gesperrt: a.gesperrt ? rein(a.gesperrt, ids, an) : null,
    signatur: a.signatur,
    mails: a.mails.map((m) => ({ zweck: m.zweck, rolle: m.rolle })),
    api: grund === null && !a.gesperrt,
    apiGrund: grund,
  };
}

/** Aufgaben („Jetzt zu tun“), Vorgänge mit ihren Knöpfen und die offenen Matching-Vorschläge — alles ohne personenbezogene Angaben. */
export async function vorgaengeLesen() {
  const [dash, an, einstellungen] = await Promise.all([ladeDashboard("api@lippeforst.de", site.url), ansichten(), ladeEinstellungen()]);
  const automatik = automatikVon(einstellungen.automatik);
  const vorgaenge = [...dash.jetzt, ...dash.warten].map((x) => {
    const ids = x.key.split("~");
    return {
      key: x.key,
      art: x.art,
      schritt: x.plan.nr,
      von: x.plan.gesamt,
      titel: rein(x.plan.titel, ids, an, 160),
      stand: rein(x.plan.stand, ids, an),
      wartetSeit: x.plan.wartetSeit,
      boerse: x.boerse,
      aktionen: alleAktionen(x.plan).map((a) => aktionAnsicht(a, x.art, automatik, ids, an)),
    };
  });
  const aufgaben = aufgabenAus(dash).map((a) => {
    const ids = idsIn(a.id, a.href);
    return { id: a.id, prio: a.prio, typ: a.quelle.typ, titel: rein(a.titel, ids, an, 160), grund: rein(a.grund, ids, an), seit: a.seit, ueberfaellig: a.ueberfaellig, neu: a.neu };
  });
  const vorschlaege = dash.vorschlaege.map((v) => {
    const ids = v.key.split("~");
    return { key: v.key, score: v.score, distanzKm: v.distanzKm, gruende: v.gruende.map((g) => rein(g, ids, an, 160)), hinweise: v.hinweise.map((h) => rein(h, ids, an, 160)), boerse: v.boerse, neu: v.neu };
  });
  return {
    stand: new Date().toISOString(),
    automatik: { notAus: automatik.notAus, rechtsschalter: automatik.recht34c && automatik.vorlagenGeprueft },
    anzahl: { aufgaben: aufgaben.length, vorgaenge: vorgaenge.length, vorschlaege: vorschlaege.length },
    aufgaben,
    vorgaenge,
    vorschlaege,
  };
}

export type KnopfEingabe = { key: string; id: string; ziel: string; signatur: string };

async function umgebung() {
  const [einstellungen, kunden] = await Promise.all([ladeEinstellungen(), alleKunden()]);
  return { einstellungen, basis: await basisUrl(), bewertungsUrl: M.bewertungsUrl(einstellungen, process.env.GOOGLE_REVIEW_URL), kunden: new Map(kunden.map((k) => [k.id, k])) };
}

/** Einen Knopf des Klick-Assistenten drücken (nur der gesehene Stand: die Signatur muss noch gelten). */
export async function knopfAusfuehren(e: KnopfEingabe, von: string, zugangId: string): Promise<AktionErgebnis> {
  if (!istPaarKey(e.key)) return { ok: false, status: 400, fehler: "key: LL-…~LL-… erwartet." };
  const einstellungen = await ladeEinstellungen();
  const automatik = automatikVon(einstellungen.automatik);
  const ctx = await V.ladeVorgangKontext(e.key);
  if (!ctx) return { ok: false, status: 404, fehler: "Vorgang nicht gefunden." };
  const grund = knopfGrund(e.id, ctx.art, automatik);
  if (grund) return { ok: false, status: 403, fehler: grund };
  // Anbieter mit mehreren Flächen: vorher abgleichen, damit keine zweite Einladung entsteht (wie im Dashboard).
  await anbieterAbgleichFuer(e.key.split("~")[0], von);
  const frisch = (await V.ladeVorgangKontext(e.key)) ?? ctx;
  const u = await umgebung();
  const a = alleAktionen(assistentPlan(frisch, u)).find((x) => x.id === e.id && (x.ziel ?? "") === e.ziel);
  if (!a || a.signatur !== e.signatur) {
    return { ok: false, status: 409, fehler: "Nichts ausgeführt — der Stand hat sich geändert. Vorgänge neu lesen und mit der neuen Signatur wiederholen." };
  }
  if (a.gesperrt) return { ok: false, status: 409, fehler: `Nicht möglich: ${a.gesperrt}` };

  // Erst jetzt zählen: Abgelehntes (veralteter Stand, gesperrt) verbraucht nichts. Derselbe Knopf höchstens einmal je Minute (kein Doppelversand).
  if (!(await drosseln("api-knopf-einmal", kurzwert(`${e.key}|${e.id}|${e.ziel}`, "knopf"), [{ sekunden: 60, max: 1 }]))) {
    return { ok: false, status: 429, fehler: "Dieser Knopf wurde gerade erst gedrückt — bitte kurz warten und den Stand neu lesen." };
  }
  if (!(await drosseln("api-knopf", kurzwert(zugangId, "knopf"), [{ sekunden: 86_400, max: KNOEPFE_PRO_TAG }]))) {
    return { ok: false, status: 429, fehler: `Zu viele Knopf-Aktionen für heute (höchstens ${KNOEPFE_PRO_TAG} je Zugang und Tag).` };
  }

  const zeilen: AusfuehrZeile[] = [];
  switch (a.id) {
    case "einladen":
    case "erinnern":
      for (const m of a.mails) {
        if (m.neuerLink && !(await linkErstellen(von, m, u, zeilen))) continue;
        await mailsSenden(von, e.key, u, [m], zeilen);
      }
      break;
    case "hinweise":
    case "freigabe-mitteilen":
    case "pacht-erinnern":
      await mailsSenden(von, e.key, u, a.mails, zeilen);
      break;
    case "freigeben": {
      const r = await V.freigeben(e.key, von);
      if (!r.ok) return { ok: false, status: 409, fehler: `Freigabe nicht möglich: ${r.fehler ?? "unbekannt"}` };
      zeilen.push({ art: "ok", text: "Kontakt freigegeben — beide sehen die Kontaktdaten jetzt im Kundenbereich" });
      await mailsSenden(von, e.key, u, a.mails, zeilen);
      break;
    }
    default:
      return { ok: false, status: 403, fehler: `„${a.id}“ gibt es per API nicht.` };
  }

  const an = await ansichten();
  const text = zeilen.map((z) => `${z.art === "fehler" ? "FEHLER" : z.art === "ok" ? "ok" : "Hinweis"}: ${rein(z.text, e.key.split("~"), an, 240)}`).join(" · ");
  if (zeilen.some((z) => z.art === "fehler") && !zeilen.some((z) => z.art === "ok")) return { ok: false, status: 409, fehler: text || "Nicht ausgeführt." };
  return { ok: true, text: text || "Ausgeführt." };
}
