import type { AssistentAktion } from "./assistent-typen";
import type { DashAnfrage, DashAnkauf, DashBoerse, DashErklaerung, DashLoeschwunsch, DashPostfach, DashRueckmeldung, DashVorgang, Dashboard } from "./dashboard";

// Aufgabenliste fürs Dashboard (Review 27.09.2026, Abschnitt 4): bildet die vorhandenen
// Dashboard-Objekte auf Zeilen mit Priorität, Grund und EINEM Knopf ab — ohne neue Fachlogik.
// Reihenfolge: 1 Fristen & Recht · 2 Geld · 3 Kunde wartet auf uns · 4 neue Eingänge ·
// 5 Wachstum. Innerhalb einer Stufe zuerst Überfälliges, dann das Älteste.

export type AufgabeQuelle =
  | { typ: "vorgang"; x: DashVorgang }
  | { typ: "anfrage"; a: DashAnfrage }
  | { typ: "rueckmeldung"; r: DashRueckmeldung }
  | { typ: "postfach"; p: DashPostfach }
  | { typ: "boerse"; b: DashBoerse }
  | { typ: "erklaerung"; e: DashErklaerung }
  | { typ: "loeschwunsch"; l: DashLoeschwunsch }
  | { typ: "ankauf"; k: DashAnkauf }
  | { typ: "postausgang" };

export type Aufgabe = {
  /** Eindeutig, zugleich Anker in der Seite. */
  id: string;
  prio: 1 | 2 | 3 | 4 | 5;
  zeichen: "!" | "€" | "•" | "";
  titel: string;
  /** Ein Satz: warum jetzt und was der Knopf tut. */
  grund: string;
  seit: string | null;
  /** Frist überschritten (z. B. Antwort „innerhalb eines Werktags“, Löschfrist). */
  ueberfaellig: boolean;
  neu: boolean;
  href: string;
  quelle: AufgabeQuelle;
};

const TAG_MS = 86_400_000;

function kurz(s: string, max = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function tagBerlin(d: Date): { y: number; m: number; t: number; wochentag: number } {
  const teile = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const wert = (typ: string) => teile.find((x) => x.type === typ)?.value ?? "";
  const wochentage = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { y: Number(wert("year")), m: Number(wert("month")), t: Number(wert("day")), wochentag: wochentage.indexOf(wert("weekday")) };
}

/**
 * Zusage der Website: Antwort „in der Regel innerhalb eines Werktags“. Frist = Ende des nächsten
 * Werktags (Mo–Fr, deutsche Zeit; Feiertage bleiben unberücksichtigt) nach dem Eingang.
 */
export function werktagFrist(eingang: string): Date {
  const d = new Date(eingang);
  const b = tagBerlin(d);
  let tage = 1;
  let wt = (b.wochentag + 1) % 7;
  while (wt === 0 || wt === 6) {
    tage++;
    wt = (wt + 1) % 7;
  }
  // 23:59 deutscher Zeit am Frist-Tag (Sommerzeit: UTC+2 — eine Stunde Unschärfe im Winter ist unkritisch).
  return new Date(Date.UTC(b.y, b.m - 1, b.t + tage, 21, 59, 0));
}

const ERINNERN = new Set(["erinnern", "pacht-erinnern", "kauf-erinnern"]);

/** Der Knopf, den eine Vorgangszeile zeigt: erst eine offene Meldung, sonst der Hauptknopf. */
export function hauptAktion(x: DashVorgang): AssistentAktion | null {
  return x.plan.meldungen[0]?.aktionen[0] ?? x.plan.aktion ?? null;
}

/** Fällige Erinnerung eines wartenden Vorgangs (für den Einzeiler „Warten“ und die Sammel-Erinnerung). */
export function faelligeErinnerung(x: DashVorgang): AssistentAktion | null {
  const a = x.plan.aktion;
  return a && ERINNERN.has(a.id) && !a.gesperrt && a.mails.length > 0 ? a : null;
}

function vorgangAufgabe(x: DashVorgang): Aufgabe {
  const m = x.plan.meldungen[0];
  const a = x.plan.aktion;
  const titel = `${x.anbieter} ↔ ${x.suchender} · ${x.art === "kauf" ? "Kauf" : "Pacht"}${x.plan.nr ? ` · ${x.plan.nr}/${x.plan.gesamt}` : ""}`;
  let prio: Aufgabe["prio"] = 3;
  let zeichen: Aufgabe["zeichen"] = "•";
  let grund = x.plan.stand;
  if (m?.art === "abschluss") {
    prio = 1;
    zeichen = "!";
    grund = `${m.titel}: ${m.text}`;
  } else if (a && (a.id === "anzeige-erinnern" || a.id === "anzeige-vermerken")) {
    prio = 1;
    zeichen = "!";
  } else if (a && a.id.startsWith("provision-")) {
    prio = 2;
    zeichen = "€";
  } else if (m) {
    grund = `${m.titel}: ${m.text}`;
  }
  return {
    id: `vorgang-${x.key}`,
    prio,
    zeichen,
    titel,
    grund: kurz(grund),
    seit: m?.am ?? x.plan.wartetSeit ?? (x.zuletzt || null),
    ueberfaellig: false,
    neu: x.neu > 0 || x.plan.meldungen.length > 0,
    href: `/admin/vorgang/${x.key}`,
    quelle: { typ: "vorgang", x },
  };
}

export function aufgabenAus(d: Dashboard, jetzt = new Date(d.am)): Aufgabe[] {
  const liste: Aufgabe[] = [];

  for (const e of d.erklaerungen) {
    liste.push({
      id: `erklaerung-${e.id}-${e.art}`,
      prio: 1,
      zeichen: "!",
      titel: `${e.name} · ${e.art === "widerruf" ? "Widerruf" : "Kündigung"} ohne Anmeldung`,
      grund: "Gilt sofort, stammt aber nicht sicher vom Kunden — prüfen und bei Missbrauch „nicht vom Kunden, verwerfen“.",
      seit: e.am,
      ueberfaellig: false,
      neu: true,
      href: `/admin/anfrage/${e.id}#kundenbereich`,
      quelle: { typ: "erklaerung", e },
    });
  }
  for (const l of d.loeschwuensche) {
    const ueber = Date.parse(l.frist) < jetzt.getTime();
    liste.push({
      id: `loeschwunsch-${l.id}`,
      prio: 1,
      zeichen: "!",
      titel: `${l.name} · Löschwunsch`,
      grund: `Mit „Vorgang endgültig löschen (DSGVO)“ erledigen — Verträge bleiben dabei nur gesperrt. Frist ${new Date(l.frist).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}${ueber ? " (überschritten)" : ""}.`,
      seit: l.am,
      ueberfaellig: ueber,
      neu: false,
      href: `/admin/anfrage/${l.id}#loeschen`,
      quelle: { typ: "loeschwunsch", l },
    });
  }
  if (d.postausgang.offen + d.postausgang.aufgegeben > 0) {
    const alt = d.postausgang.aeltestes ? jetzt.getTime() - Date.parse(d.postausgang.aeltestes) > TAG_MS : false;
    liste.push({
      id: "postausgang",
      prio: d.postausgang.aufgegeben > 0 || alt ? 1 : 3,
      zeichen: d.postausgang.aufgegeben > 0 || alt ? "!" : "•",
      titel: `Postausgang · ${d.postausgang.offen + d.postausgang.aufgegeben} ${d.postausgang.offen + d.postausgang.aufgegeben === 1 ? "E-Mail" : "E-Mails"} nicht zugestellt`,
      grund: `${d.postausgang.aufgegeben ? `${d.postausgang.aufgegeben} nach mehreren Versuchen aufgegeben · ` : ""}Systemmails (z. B. Vertrags- oder Widerrufsbestätigung) werden automatisch erneut versucht — jetzt sofort senden oder einzeln erledigen.`,
      seit: d.postausgang.aeltestes,
      ueberfaellig: d.postausgang.aufgegeben > 0,
      neu: false,
      href: "/admin/dashboard#postausgang",
      quelle: { typ: "postausgang" },
    });
  }

  for (const x of d.jetzt) liste.push(vorgangAufgabe(x));

  for (const p of d.postfach) {
    liste.push({
      id: `postfach-${p.key}`,
      prio: 3,
      zeichen: "•",
      titel: `${p.name} · E-Mail`,
      grund: kurz(`${p.mail.vorschlag ? "Vorschlag übernehmen" : "Selbst einordnen"}: ${p.mail.grund}`),
      seit: p.mail.am,
      ueberfaellig: false,
      neu: p.neu,
      href: `/admin/anfrage/${p.id}#postfach`,
      quelle: { typ: "postfach", p },
    });
  }
  for (const r of d.rueckmeldungen) {
    liste.push({
      id: `rueckmeldung-${r.id}`,
      prio: 3,
      zeichen: "•",
      titel: `${r.name} · Rückmeldung`,
      grund: kurz(r.vorschlag ? r.vorschlag.warum : r.antwort ? `Beratung — Antwort zum Thema „${r.antwort.themaName}“ ist vorbereitet` : "Beratung gewünscht — per E-Mail antworten, dann als beantwortet markieren"),
      seit: r.r.am,
      ueberfaellig: false,
      neu: r.neu,
      href: `/admin/anfrage/${r.id}`,
      quelle: { typ: "rueckmeldung", r },
    });
  }
  for (const a of d.anfragen) {
    const ueber = werktagFrist(a.eingang).getTime() < jetzt.getTime();
    liste.push({
      id: `anfrage-${a.id}`,
      prio: ueber ? 1 : 4,
      zeichen: ueber ? "!" : "",
      titel: `${a.name} · ${a.anliegen}${a.ort ? ` · ${a.ort}` : ""}`,
      grund: kurz(`${ueber ? "Antwort „innerhalb eines Werktags“ überfällig — " : ""}${a.antwort ? `Antwort ist fertig (${a.antwort.themaName}) — prüfen und senden` : a.vorschlag.warum}`),
      seit: a.eingang,
      ueberfaellig: ueber,
      neu: a.neu,
      href: `/admin/anfrage/${a.id}`,
      quelle: { typ: "anfrage", a },
    });
  }
  for (const k of d.ankauf) {
    const bezug = k.angebotAm ?? k.gewaehltAm;
    const alt = jetzt.getTime() - Date.parse(bezug) > 14 * TAG_MS;
    if (k.angebotAm && !alt) continue; // Angebot ist raus — der Eigentümer ist am Zug
    liste.push({
      id: `ankauf-${k.id}`,
      prio: 4,
      zeichen: "",
      titel: `${k.name} · Direktankauf`,
      grund: k.angebotAm ? "Kaufangebot seit über 14 Tagen raus — Ergebnis erfassen (gekauft, abgelehnt) oder doch vermitteln." : "„Selbst kaufen“ gewählt — die Mail zum Direktankauf steht unter „E-Mail-Entwürfe“.",
      seit: bezug,
      ueberfaellig: false,
      neu: false,
      href: `/admin/anfrage/${k.id}#weg`,
      quelle: { typ: "ankauf", k },
    });
  }
  for (const b of d.boerse) {
    if (b.online || !b.einwilligung || b.luecken.length) continue;
    liste.push({
      id: `boerse-${b.id}`,
      prio: 5,
      zeichen: "",
      titel: `${b.code ?? "Börse"} · ${b.eckdaten}`,
      grund: "Einwilligung liegt vor, nichts fehlt — mit einem Klick anonym veröffentlichen.",
      seit: b.einwilligung.am,
      ueberfaellig: false,
      neu: false,
      href: `/admin/anfrage/${b.id}#boerse`,
      quelle: { typ: "boerse", b },
    });
  }

  return liste.sort((a, b) => a.prio - b.prio || Number(b.ueberfaellig) - Number(a.ueberfaellig) || (a.seit ?? "9").localeCompare(b.seit ?? "9"));
}

/** Neue Anfragen/Tickets, deren Hauptknopf „Einladen“ ist — für die Sammel-Einladung. */
export function sammelEinladungen(d: Dashboard): { id: string; name: string; signatur: string; an: string }[] {
  const out: { id: string; name: string; signatur: string; an: string }[] = [];
  const nehmen = (id: string, name: string, v: DashAnfrage["vorschlag"] | null) => {
    const a = v?.aktion;
    if (!a || a.id !== "einladen" || a.gesperrt || !a.mails[0]) return;
    out.push({ id, name, signatur: a.signatur, an: a.mails[0].an });
  };
  for (const a of d.anfragen) if (!a.antwort) nehmen(a.id, a.name, a.vorschlag);
  for (const r of d.rueckmeldungen) nehmen(r.id, r.name, r.vorschlag);
  return out;
}
