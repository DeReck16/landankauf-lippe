// Überblick im Dashboard: vier Fragen auf einen Blick — Was wollen die Leads? Wie weit sind sie im Kundenbereich?
// Was steht auf der Seite? Welche Matching-Paare gibt es? Reine Zählung aus vorhandenen Daten (nichts wird
// geschrieben); jede Zahl führt zur passend gefilterten Anfragen-Liste bzw. zum Matching.

import { MATCH_STATUS, type LeadView } from "./model";
import { kontoStandFuer, seitenStand, type Anzeige, type Ton } from "./online-stand";
import type { KundeRecord } from "@/lib/portal/model";

export type Zaehler = { schluessel: string; label: string; n: number; neu?: number; puls?: boolean; href: string; tipp: string; ton?: Ton };

export type Ueberblick = {
  wollen: Zaehler[];
  konto: Zaehler[];
  seite: Zaehler[];
  matching: Zaehler[];
};

/** Anliegen aus Rolle und Art: „angebot:kauf“, „gesuch:pacht“, „keine“ — dieselben Werte nutzt der Filter „Anliegen“ der Anfragen-Liste. */
export function anliegenSchluessel(l: Pick<LeadView, "rolle" | "art">): string {
  if (l.rolle === "keine") return "keine";
  return `${l.rolle}:${l.art ?? "offen"}`;
}

export const ANLIEGEN: { schluessel: string; label: string; tipp: string }[] = [
  { schluessel: "angebot:kauf", label: "Verkaufen", tipp: "Eigentümer will die Fläche verkaufen" },
  { schluessel: "angebot:pacht", label: "Verpachten", tipp: "Eigentümer will die Fläche verpachten" },
  { schluessel: "gesuch:kauf", label: "Gesucht · Kauf", tipp: "Sucht eine Fläche zum Kauf" },
  { schluessel: "gesuch:pacht", label: "Gesucht · Pacht", tipp: "Sucht eine Fläche zur Pacht" },
  { schluessel: "keine", label: "Auskunft", tipp: "Bewertung, Beratung, Energiepacht, Ökopunkte … — kein Flächenangebot, kein Gesuch" },
];

const AUS = new Set(["archiv", "erledigt"]);

/** Filter der Anfragen-Liste: „angebot“, „gesuch“, „keine“ oder genau „angebot:kauf“ usw. */
export function passtZumAnliegen(l: Pick<LeadView, "rolle" | "art">, filter: string): boolean {
  if (!filter || filter === "alle") return true;
  if (!filter.includes(":")) return l.rolle === filter;
  return anliegenSchluessel(l) === filter;
}

export function ueberblick(
  leads: LeadView[],
  kunden: Map<string, KundeRecord>,
  sperre: (id: string) => string | null,
  paare: { meta: { status: string } | null }[],
  /** Neue, von diesem Admin noch nicht geöffnete Anfrage — lässt die Zahl pulsieren. */
  istNeu: (l: LeadView) => boolean = () => false,
): Ueberblick {
  const aktiv = leads.filter((l) => !AUS.has(l.status));

  const wollen: Zaehler[] = ANLIEGEN.map((a) => {
    const liste = aktiv.filter((l) => anliegenSchluessel(l) === a.schluessel);
    return {
      schluessel: a.schluessel,
      label: a.label,
      n: liste.length,
      neu: liste.filter((l) => l.status === "neu").length,
      puls: liste.some(istNeu),
      href: `/admin?status=laufend&rolle=${encodeURIComponent(a.schluessel)}`,
      tipp: `${a.tipp} — ${liste.length} laufend (ohne Erledigte und Archiv)`,
    };
  });
  const ohneEinordnung = aktiv.filter((l) => l.rolle !== "keine" && l.art == null).length;
  if (ohneEinordnung > 0) {
    wollen.push({
      schluessel: "offen",
      label: "Einordnung offen",
      n: ohneEinordnung,
      href: "/admin?status=laufend",
      tipp: "Angebote oder Gesuche ohne Kauf-/Pacht-Einordnung — ohne sie läuft kein Matching. In der Anfrage unter „Matching-Angaben“ nachtragen.",
      ton: "warn",
    });
  }

  // Kundenkonto: nur Angebote und Gesuche (Auskünfte haben keinen Kundenbereich).
  const flaechen = aktiv.filter((l) => l.rolle !== "keine");
  const kontoStand = new Map<string, Anzeige>(flaechen.map((l) => [l.id, kontoStandFuer(l, kunden.get(l.id), kunden)]));
  const KONTO: { schluessel: string; label: string; tipp: string; ton?: Ton }[] = [
    { schluessel: "nicht", label: "Nicht eingeladen", tipp: "Noch keine Einladung zum Kundenbereich" },
    { schluessel: "eingeladen", label: "Eingeladen", tipp: "Einladung raus, Link noch nicht geöffnet" },
    { schluessel: "angemeldet", label: "Angemeldet", tipp: "Im Kundenbereich, Unterschrift fehlt noch" },
    { schluessel: "onboarded", label: "Onboarded", tipp: "Vereinbarung online unterschrieben", ton: "ok" },
    { schluessel: "aus", label: "Ausgestiegen", tipp: "Widerrufen, gekündigt oder Zugang gesperrt", ton: "rot" },
  ];
  const konto: Zaehler[] = KONTO.map((k) => ({
    schluessel: k.schluessel,
    label: k.label,
    n: flaechen.filter((l) => kontoStand.get(l.id)?.schluessel === k.schluessel).length,
    href: `/admin?status=laufend&konto=${k.schluessel}`,
    tipp: `${k.tipp} — Angebote und Gesuche, die laufen`,
    ton: k.ton,
  }));

  // Seite: Flächen (Flächenbörse) und Suchaufträge (Liste „Gesucht“).
  const seitenStaende = new Map<string, Anzeige>(flaechen.map((l) => [l.id, seitenStand(l, sperre(l.id))]));
  const SEITE: { schluessel: string; label: string; tipp: string; ton?: Ton }[] = [
    { schluessel: "online", label: "Online", tipp: "Steht anonym auf lippeforst.de (Flächenbörse bzw. Liste „Gesucht“)", ton: "ok" },
    { schluessel: "bereit", label: "Bereit — Klick fehlt", tipp: "Einwilligung und Angaben vollständig — nur „Veröffentlichen“ fehlt", ton: "warn" },
    { schluessel: "angaben", label: "Angaben fehlen", tipp: "Einwilligung da, Börsen-Angaben unvollständig" },
    { schluessel: "nicht", label: "Ohne Einwilligung", tipp: "Keine Einwilligung bzw. noch keine Börsen-Angaben — bleibt unveröffentlicht" },
    { schluessel: "offline", label: "Offline", tipp: "Vergeben, Eigentümer ausgestiegen oder von Hand offline genommen" },
    { schluessel: "direkt", label: "Direktankauf", tipp: "Die TR Vertriebs GmbH kauft selbst — nicht in der Börse, kein Matching" },
    { schluessel: "unsichtbar", label: "Prüfen", tipp: "Als online geführt, aber wegen einer Lücke nicht sichtbar", ton: "rot" },
  ];
  const seite: Zaehler[] = SEITE.map((k) => ({
    schluessel: k.schluessel,
    label: k.label,
    n: flaechen.filter((l) => seitenStaende.get(l.id)?.schluessel === k.schluessel).length,
    href: `/admin?status=laufend&seite=${k.schluessel}`,
    tipp: `${k.tipp} — laufende Angebote und Gesuche`,
    ton: k.ton,
  })).filter((z) => z.n > 0 || z.schluessel === "online" || z.schluessel === "bereit");

  // Matching: Paare nach Stand (verworfene zählen nicht).
  const nachStand = new Map<string, number>();
  for (const p of paare) {
    const s = p.meta?.status ?? "vorschlag";
    if (s === "verworfen") continue;
    nachStand.set(s, (nachStand.get(s) ?? 0) + 1);
  }
  const MATCHING: (keyof typeof MATCH_STATUS)[] = ["vorschlag", "vorgemerkt", "angefragt", "kontakt", "abschluss"];
  const matching: Zaehler[] = MATCHING.map((s) => ({
    schluessel: s,
    label: s === "vorschlag" ? "Neue Vorschläge" : MATCH_STATUS[s].label,
    n: nachStand.get(s) ?? 0,
    href: "/admin/matching",
    tipp: MATCH_STATUS[s].tipp,
    ton: s === "abschluss" ? ("ok" as const) : s === "vorschlag" ? ("warn" as const) : undefined,
  }));

  return {
    wollen,
    konto,
    seite,
    matching,
  };
}

/** Filter der Anfragen-Liste „Konto“ und „Auf der Seite“ gegen die abgeleiteten Stände. */
export function passtZumStand(a: Anzeige, filter: string): boolean {
  return !filter || filter === "alle" || a.schluessel === filter;
}
