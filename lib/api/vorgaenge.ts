import "server-only";
import { createHmac } from "node:crypto";
import { sessionSecret } from "@/lib/admin/config";
import { leadView, type LeadMeta, type LeadView } from "@/lib/admin/model";
import { drosseln, kurzwert, listLeads, mutateZustand, readZustand } from "@/lib/admin/store";
import { anbieterAbgleichFuer } from "@/lib/portal/anbieter-gruppe";
import { alleAktionen, assistentPlan } from "@/lib/portal/assistent";
import type { AssistentAktion } from "@/lib/portal/assistent-typen";
import { aufgabenAus, type AufgabeQuelle } from "@/lib/portal/aufgaben";
import { linkErstellen, mailsSenden, type AusfuehrZeile } from "@/lib/portal/ausfuehren";
import { automatikVon, type AutomatikEinstellungen } from "@/lib/portal/automatik-regeln";
import { ladeDashboard } from "@/lib/portal/dashboard";
import * as M from "@/lib/portal/model";
import { basisUrl } from "@/lib/portal/sitzung";
import { alleKunden, istPaarKey, ladeEinstellungen } from "@/lib/portal/speicher";
import * as V from "@/lib/portal/vorgang";
import { WEG_NAME } from "@/lib/portal/weg";
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

/** Bei Kauf nur diese beiden, und nur mit ausdrücklichem `kauf: true` im Aufruf (Dennis, 01.11.2026: „Dashboard 5 du machen“). Die Routine setzt es nie. */
export const KAUF_KNOEPFE: readonly ApiKnopf[] = ["einladen", "hinweise"];

export type VorgangArt = "pacht" | "kauf" | "unklar";

/** Diese Knöpfe lösen den „Nachweis“ aus (Hinweis auf eine Fläche bzw. Freigabe der Kontakte): nur mit den Rechts-Bestätigungen. */
const RECHTSSCHALTER: readonly ApiKnopf[] = ["hinweise", "freigeben", "freigabe-mitteilen"];

/** Mehr Knopf-Aktionen je Zugang und Tag gibt es nicht (jede kann Mails an Kunden auslösen). */
export const KNOEPFE_PRO_TAG = 20;

function istErlaubterKnopf(id: string): id is ApiKnopf {
  return (API_KNOEPFE as readonly string[]).includes(id);
}

/** Warum die API diesen Knopf jetzt nicht drücken darf (null = darf, vorbehaltlich der Sperren des Systems). */
export function knopfGrund(id: string, art: VorgangArt, vermittlung: boolean, automatik: AutomatikEinstellungen, kauf = false): string | null {
  if (!istErlaubterKnopf(id)) return `„${id}“ gibt es per API nicht (erlaubt: ${API_KNOEPFE.join(", ")}).`;
  if (automatik.notAus) return "Not-Aus der Automatik ist an — nur die Verwaltung.";
  if (art === "unklar") return "Die Art (Pacht oder Kauf) ist nicht eindeutig — nur die Verwaltung.";
  if (art === "kauf") {
    if (!KAUF_KNOEPFE.includes(id as ApiKnopf)) return `Bei Kauf nur ${KAUF_KNOEPFE.join(" und ")} (die Automatik nimmt Kauf aus, bis der GwG-Ablauf steht) — der Rest bleibt in der Verwaltung.`;
    if (!kauf) return "Kauf läuft per API nur mit dem Recht board:vorgang-kauf und ausdrücklichem kauf:true (nur auf Anweisung von Dennis, nie in der Routine).";
  }
  if (RECHTSSCHALTER.includes(id) && !(automatik.recht34c && automatik.vorlagenGeprueft)) {
    return "Gesperrt, bis in den Einstellungen „§ 34c-Erlaubnis liegt vor“ und „Vorlagen anwaltlich geprüft“ bestätigt sind (dieselbe Sperre wie bei der Automatik).";
  }
  // Ob TR selbst kauft („Selbst kaufen“) oder Lippe Forst vermittelt, entscheidet die Verwaltung — die Automatik wartet darauf ebenso.
  if (RECHTSSCHALTER.includes(id) && !vermittlung) return "Der Weg des Angebots ist nicht „Vermitteln“ (offen oder Direktankauf) — das entscheidet die Verwaltung.";
  return null;
}

/** Anfragen und Kundenakten: beide nennen Namen, Adressen und Nummern der Beteiligten. */
export type Ansichten = { leads: Map<string, LeadView>; kunden: Map<string, M.KundeRecord> };

async function ansichten(): Promise<Ansichten> {
  const [leads, { zustand }, kunden] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
  return { leads: new Map(leads.map((l) => [l.id, leadView(l, zustand.anfragen[l.id])])), kunden: new Map(kunden.map((k) => [k.id, k])) };
}

/** Alles, was eine Person der Anfrage verrät: Angaben der Anfrage und der Kundenakte (Stammdaten, Unterschrift). */
function personen(id: string, a: Ansichten): { name: string; email: string; phone: string }[] {
  const l = a.leads.get(id);
  const k = a.kunden.get(id);
  const liste = l ? [{ name: l.name, email: l.email, phone: l.phone }] : [];
  if (k) {
    const sd = k.stammdaten;
    liste.push({ name: k.name ?? "", email: k.email, phone: "" });
    if (sd) liste.push({ name: sd.name, email: "", phone: sd.telefon }, { name: sd.betrieb, email: "", phone: "" }, { name: sd.strasse, email: "", phone: "" });
    if (k.vertrag) liste.push({ name: k.vertrag.signatur.name, email: k.vertrag.signatur.email, phone: "" });
  }
  return liste;
}

const STRASSE = /\b[\p{L}.-]+(?:stra(?:ß|ss)e|str\.|weg|allee|platz|gasse|ring|damm|ufer|pfad)\s*\d+\s*[a-z]?\b/giu;

/** Text ohne Anschriften, Nummern und ohne Name/Mail/Telefon der genannten Anfragen und ihrer Kundenakten. */
export function rein(text: string, ids: Iterable<string>, a: Ansichten, max = 300): string {
  let t = String(text ?? "").replace(/\s+/g, " ").trim();
  for (const id of new Set(ids)) {
    for (const p of personen(id, a)) t = schwaerzen(t, eigeneAngaben(p));
  }
  t = schwaerzen(t, null).replace(STRASSE, "[Adresse]");
  return t.length > max ? `${t.slice(0, max - 2).trimEnd()} …` : t;
}

/** Anfragen, um die es in einer Aufgabe geht (für die Schwärzung der Namen aus Anfrage und Kundenakte). */
function quellIds(q: AufgabeQuelle): string[] {
  switch (q.typ) {
    case "vorgang": return q.x.key.split("~");
    case "anfrage": return [q.a.id];
    case "rueckmeldung": return [q.r.id];
    case "boerse": return [q.b.id];
    case "erklaerung": return [q.e.id];
    case "loeschwunsch": return [q.l.id];
    case "ankauf": return [q.k.id];
    default: return [];
  }
}

const idsIn = (...texte: string[]): string[] => texte.flatMap((t) => t.match(/LL-[A-Z0-9]+/g) ?? []);

/** Pacht bzw. Kauf nur, wenn der Vorgang UND beide Anfragen ausdrücklich diese Art haben — alles andere ist „unklar“ und bleibt gesperrt. */
function artVon(art: M.Art, ids: string[], an: Ansichten): VorgangArt {
  const beide = (x: string) => ids.length === 2 && ids.every((id) => an.leads.get(id)?.art === x);
  if (art === "pacht" && beide("pacht")) return "pacht";
  if (art === "kauf" && beide("kauf")) return "kauf";
  return "unklar";
}

/**
 * Signatur für die API: gebunden an den Zugang und mit dem Geheimnis des Servers gesichert. Die Rohsignatur des Dashboards enthält
 * einen Hash über Empfängeradressen und Stand und gehört nicht nach draußen (sonst ließen sich Adressen gegen sie probieren).
 */
export function apiSignatur(zugangId: string, key: string, id: string, ziel: string, art: VorgangArt, roh: string): string {
  // Die Art gehört dazu: Wird ein Paar von Pacht auf Kauf umgestellt, gilt eine alte Signatur nicht mehr.
  return createHmac("sha256", sessionSecret()).update(JSON.stringify(["api-knopf", zugangId, key, id, ziel, art, roh])).digest("hex").slice(0, 32);
}

const istVermittlung = (ids: string[], an: Ansichten): boolean => an.leads.get(ids[0])?.meta.weg === "vermittlung";

function aktionAnsicht(a: AssistentAktion, art: VorgangArt, automatik: AutomatikEinstellungen, ids: string[], an: Ansichten, key: string, zugangId: string, kaufRecht: boolean) {
  const grund = knopfGrund(a.id, art, istVermittlung(ids, an), automatik, kaufRecht);
  return {
    id: a.id,
    ziel: a.ziel ?? null,
    knopf: rein(a.knopf, ids, an, 80),
    dran: a.dran,
    gesperrt: a.gesperrt ? rein(a.gesperrt, ids, an) : null,
    signatur: apiSignatur(zugangId, key, a.id, a.ziel ?? "", art, a.signatur),
    mails: a.mails.map((m) => ({ zweck: m.zweck, rolle: m.rolle })),
    api: grund === null && !a.gesperrt,
    /** Bei Kauf nur mit dem Recht board:vorgang-kauf und kauf:true im Aufruf (nur auf Anweisung von Dennis). */
    nurMitKauf: art === "kauf",
    apiGrund: grund,
  };
}

/** Aufgaben („Jetzt zu tun“), Vorgänge mit ihren Knöpfen und die offenen Matching-Vorschläge — alles ohne personenbezogene Angaben. */
export async function vorgaengeLesen(zugangId: string, kaufRecht: boolean) {
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
      /** Weg des Angebots: „vermittlung“, „ankauf“ (Selbst kaufen) oder null = offen — entscheidet nur die Verwaltung. */
      weg: an.leads.get(ids[0])?.meta.weg ?? null,
      aktionen: alleAktionen(x.plan).map((a) => aktionAnsicht(a, artVon(x.art, ids, an), automatik, ids, an, x.key, zugangId, kaufRecht)),
    };
  });
  const aufgaben = aufgabenAus(dash).map((a) => {
    const ids = [...quellIds(a.quelle), ...idsIn(a.id, a.href)];
    // Mails aus dem Postfach und der Postausgang tragen Betreff und Adressen: dafür nur der Typ, der Text steht in der Verwaltung.
    const frei = a.quelle.typ !== "postfach" && a.quelle.typ !== "postausgang";
    return {
      id: a.id,
      prio: a.prio,
      typ: a.quelle.typ,
      titel: frei ? rein(a.titel, ids, an, 160) : "Text nur in der Verwaltung",
      grund: frei ? rein(a.grund, ids, an) : "",
      seit: a.seit,
      ueberfaellig: a.ueberfaellig,
      neu: a.neu,
    };
  });
  const vorschlaege = dash.vorschlaege.map((v) => {
    const ids = v.key.split("~");
    return { key: v.key, score: v.score, distanzKm: v.distanzKm, gruende: v.gruende.map((g) => rein(g, ids, an, 160)), hinweise: v.hinweise.map((h) => rein(h, ids, an, 160)), boerse: v.boerse, neu: v.neu };
  });
  return {
    stand: new Date().toISOString(),
    automatik: { notAus: automatik.notAus, probelauf: automatik.probelauf, rechtsschalter: automatik.recht34c && automatik.vorlagenGeprueft, regeln: automatik.regeln },
    anzahl: { aufgaben: aufgaben.length, vorgaenge: vorgaenge.length, vorschlaege: vorschlaege.length },
    aufgaben,
    vorgaenge,
    vorschlaege,
  };
}

export type KnopfEingabe = { key: string; id: string; ziel: string; signatur: string; kauf: boolean };

async function umgebung() {
  const [einstellungen, kunden] = await Promise.all([ladeEinstellungen(), alleKunden()]);
  return { einstellungen, basis: await basisUrl(), bewertungsUrl: M.bewertungsUrl(einstellungen, process.env.GOOGLE_REVIEW_URL), kunden: new Map(kunden.map((k) => [k.id, k])) };
}

/** Einen Knopf des Klick-Assistenten drücken (nur der gesehene Stand: die Signatur muss noch gelten). */
export async function knopfAusfuehren(e: KnopfEingabe, von: string, zugangId: string): Promise<AktionErgebnis> {
  if (!istPaarKey(e.key)) return { ok: false, status: 400, fehler: "key: LL-…~LL-… erwartet." };
  if (!istErlaubterKnopf(e.id)) return { ok: false, status: 403, fehler: `„${e.id}“ gibt es per API nicht (erlaubt: ${API_KNOEPFE.join(", ")}).` };
  const einstellungen = await ladeEinstellungen();
  const automatik = automatikVon(einstellungen.automatik);
  const ctx = await V.ladeVorgangKontext(e.key);
  if (!ctx) return { ok: false, status: 404, fehler: "Vorgang nicht gefunden." };
  if (!ctx.meta && !ctx.vorgang) return { ok: false, status: 409, fehler: "Dieses Paar ist nicht vorgemerkt — erst per Aktion paar vormerken." };
  const ids = e.key.split("~");
  const an = await ansichten();
  const grund = knopfGrund(e.id, artVon(ctx.art, ids, an), istVermittlung(ids, an), automatik, e.kauf);
  if (grund) return { ok: false, status: 403, fehler: grund };
  const u = await umgebung();
  const veraltet = { ok: false as const, status: 409 as const, fehler: "Nichts ausgeführt — der Stand hat sich geändert. Vorgänge neu lesen und mit der neuen Signatur wiederholen." };
  const finde = (c: V.VorgangKontext) => alleAktionen(assistentPlan(c, u)).find((x) => x.id === e.id && (x.ziel ?? "") === e.ziel);
  const stimmt = (x: AssistentAktion | undefined, art: VorgangArt): x is AssistentAktion => Boolean(x) && apiSignatur(zugangId, e.key, x!.id, x!.ziel ?? "", art, x!.signatur) === e.signatur;
  // Erst prüfen, dann schreiben: Mit veralteter Signatur ändert nichts etwas (auch nicht der Abgleich unten).
  const art = artVon(ctx.art, ids, an);
  if (!stimmt(finde(ctx), art)) return veraltet;
  // Anbieter mit mehreren Flächen: abgleichen, damit keine zweite Einladung entsteht (wie im Dashboard); ändert das den Stand, gilt die Signatur nicht mehr.
  await anbieterAbgleichFuer(e.key.split("~")[0], von);
  const frisch = (await V.ladeVorgangKontext(e.key)) ?? ctx;
  const a = finde(frisch);
  if (!stimmt(a, artVon(frisch.art, ids, await ansichten()))) return veraltet;
  if (a.gesperrt) return { ok: false, status: 409, fehler: `Nicht möglich: ${rein(a.gesperrt, ids, an)}` };

  // Mails an den Anbieter nur, wenn der Weg „Vermitteln“ gewählt ist (wie bei der Automatik, r3Paare); sonst bleibt nur, was den Suchenden betrifft.
  const mails = a.mails.filter((m) => !(m.rolle === "anbieter" && frisch.angebot.meta.weg !== "vermittlung"));
  if (["einladen", "erinnern", "pacht-erinnern"].includes(a.id) && mails.length === 0) {
    return { ok: false, status: 409, fehler: "Nichts zu senden: Der Weg des Angebots ist noch offen oder Direktankauf — das entscheidet die Verwaltung." };
  }

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
      for (const m of mails) {
        if (m.neuerLink && !(await linkErstellen(von, m, u, zeilen))) continue;
        await mailsSenden(von, e.key, u, [m], zeilen);
      }
      break;
    case "pacht-erinnern":
      await mailsSenden(von, e.key, u, mails, zeilen);
      break;
    case "hinweise":
    case "freigabe-mitteilen":
      await mailsSenden(von, e.key, u, a.mails, zeilen);
      break;
    case "freigeben": {
      const r = await V.freigeben(e.key, von);
      if (!r.ok) return { ok: false, status: 409, fehler: `Freigabe nicht möglich: ${rein(r.fehler ?? "unbekannt", ids, an)}` };
      zeilen.push({ art: "ok", text: "Kontakt freigegeben — beide sehen die Kontaktdaten jetzt im Kundenbereich" });
      await mailsSenden(von, e.key, u, a.mails, zeilen);
      break;
    }
    default:
      return { ok: false, status: 403, fehler: `„${a.id}“ gibt es per API nicht.` };
  }

  const text = zeilen.map((z) => `${z.art === "fehler" ? "FEHLER" : z.art === "ok" ? "ok" : "Hinweis"}: ${rein(z.text, ids, an, 240)}`).join(" · ");
  if (zeilen.some((z) => z.art === "fehler") && !zeilen.some((z) => z.art === "ok")) return { ok: false, status: 409, fehler: text || "Nicht ausgeführt." };
  return { ok: true, text: text || "Ausgeführt." };
}

/**
 * Weg eines Angebots auf „Vermitteln“ setzen — die einzige Wahl, die die API trifft (keine Mail, kein Statuswechsel, nur die Weiche; in der
 * Verwaltung jederzeit wieder offen zu machen). „Selbst kaufen“ nimmt die Börse offline und braucht einen Preis: nur die Verwaltung. Die Routine
 * trifft die Wahl nach Rücksprache mit Codex (siehe Skill). Alle Prüfungen stehen in derselben Zustandsänderung wie das Schreiben: Stellt die
 * Verwaltung gleichzeitig auf „Selbst kaufen“ um, bleibt es dabei.
 */
export async function wegVermitteln(anfrage: string, von: string): Promise<{ ok: boolean; geaendert: boolean; ergebnis: AktionErgebnis }> {
  const nein = (status: 404 | 409, fehler: string) => ({ ok: false, geaendert: false, ergebnis: { ok: false as const, status, fehler } });
  const lead = (await ansichten()).leads.get(anfrage);
  if (!lead) return nein(404, "Anfrage nicht gefunden.");
  if (lead.rolle !== "angebot") return nein(409, "Den Weg gibt es nur bei Angeboten (Verkaufen/Verpachten).");
  let fehler: string | null = null;
  let geaendert = false;
  let schonSo = false;
  await mutateZustand(von, (z) => {
    fehler = null;
    geaendert = false;
    schonSo = false;
    const meta: LeadMeta = { ...(z.anfragen[anfrage] ?? {}) };
    if (meta.weg === "ankauf") {
      fehler = "Für dieses Angebot ist „Selbst kaufen“ gewählt — das ändert nur die Verwaltung.";
      return;
    }
    if (meta.weg === "vermittlung") {
      schonSo = true;
      return;
    }
    if (meta.status === "archiv" || meta.status === "erledigt") {
      fehler = "Die Anfrage ist erledigt oder archiviert.";
      return;
    }
    meta.weg = "vermittlung";
    meta.geaendert = { am: new Date().toISOString(), von };
    z.anfragen[anfrage] = meta;
    geaendert = true;
    return { was: `Weg → ${WEG_NAME.vermittlung}`, ref: anfrage };
  });
  if (fehler) return nein(409, fehler);
  return { ok: true, geaendert, ergebnis: { ok: true, text: schonSo ? "Der Weg war schon „Vermitteln“." : "Weg → Vermitteln." } };
}
