// Texte aus dem Anfragenpostfach auswerten (Postfach-Abgleich, lib/portal/postfach.ts):
// den neuen Teil einer Antwort vom Zitat trennen, persönliche Links (Antwort-Link,
// Einladung) im zitierten Text finden und aus dem Text einen VORSCHLAG ableiten,
// welche Rückmeldung gemeint ist. Der Vorschlag ist eine Lesehilfe — geändert wird
// erst, wenn die Verwaltung ihn übernimmt. Ohne Server-Abhängigkeit (testbar).

import { themaVorschlag, type Antwortgruppe, type RueckmeldungArt } from "./rueckmeldung-typen";

/** So viel neuer Text wird je Mail gespeichert. */
export const TEXT_MAX = 2000;

// Beginn des zitierten Teils: „Am 25.09.2026 um 10:28 schrieb …:“, „… hat am … geschrieben:“,
// „On … wrote:“, Outlook-Kopf („Von: … Gesendet: …“) und Trennlinien wie „-----Original-Nachricht-----“.
const ZITAT_ANFANG: RegExp[] = [
  /^[ \t>]*Am\s.{3,160}?\s(schrieb|geschrieben)\b[^\n]*$/im,
  /^[^\n]{0,160}\shat am\s[^\n]{3,80}\sgeschrieben:?[ \t]*$/im,
  /^[ \t>]*On\s.{3,160}?\swrote:?[ \t]*$/im,
  /-{2,}\s*(Original-Nachricht|Ursprüngliche Nachricht|Originalnachricht|Original Message|Weitergeleitete Nachricht|Forwarded message)\s*-{2,}/i,
  /^[ \t>]*(Von|From):[^\n]*\n(?:[^\n]*\n){0,2}?[ \t>]*(Gesendet|Sent|Datum|Date):/im,
  /^[ \t>]*(Von|From):[^\n]*(Gesendet|Sent):/im,
  /^_{8,}\s*$/m,
];

// Anhängsel von Mail-Apps am Ende des neuen Teils.
const APP_FUSS = /^[ \t]*(Von meinem [^\n]{0,60}gesendet|Gesendet (von|mit) [^\n]{0,80}|Sent from [^\n]{0,60}|Diese Nachricht wurde von [^\n]{0,60}gesendet)[^\n]*$/gim;

/** Neuer Text einer Antwort — ohne Zitat, ohne App-Fußzeile, Leerzeilen zusammengefasst. */
export function neuerTeil(roh: string, max = TEXT_MAX): string {
  let t = (roh ?? "").replace(/\r\n?/g, "\n").replace(/ /g, " ");
  let schnitt = t.length;
  for (const re of ZITAT_ANFANG) {
    const m = re.exec(t);
    if (m && m.index < schnitt) schnitt = m.index;
  }
  t = t.slice(0, schnitt);
  // Zitierte Zeilen („> …“) und App-Fußzeilen entfernen.
  t = t
    .split("\n")
    .filter((z) => !/^\s*>/.test(z))
    .join("\n")
    .replace(APP_FUSS, "")
    .replace(/<https?:\/\/[^>\s]+>/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Nur die Aussage: ohne Anrede in der ersten Zeile („Guten Tag,“, „Hallo Herr Reckling,“) und ohne
 * Grußformel mit Namen am Ende — für Zitate im Antwortentwurf („Sie schrieben: …“).
 */
export function kernText(text: string): string {
  let t = (text ?? "").trim();
  // Anrede bis zum ersten Komma/Ausrufezeichen („Hallo Herr Reckling,wir werden …“ behält den Rest der Zeile).
  t = t.replace(/^(guten (tag|morgen|abend)|hallo|moin|servus|sehr geehrte[rs]?|liebe[rs]?|lieber)\b[^\n,!]{0,60}[,!][ \t]*\n*/i, "");
  // Grußformel nur am Zeilenanfang und nur im letzten Stück der Mail.
  t = t.replace(/(^|\n)[ \t]*(mit )?(freundlichen|besten|herzlichen|lieben|liebe|vielen|viele|schönen|schöne)? ?(grüßen|grüße|gruß|gruessen|gruesse|gruss)(?![a-zäöüß])[\s\S]{0,200}$/i, "");
  t = t.replace(/(^|\n)[ \t]*(mfg|lg|vg|bg)(?![a-zäöüß])[\s\S]{0,120}$/i, "");
  return t.trim() || (text ?? "").trim();
}

/** Persönliche Links im (auch zitierten) Text: Antwort-Link der Nachfass-Mail und Einladungen. */
export function linkTokens(roh: string): { art: "antwort" | "einladung"; token: string }[] {
  const out: { art: "antwort" | "einladung"; token: string }[] = [];
  const re = /\/kunde\/(antwort|einladung)\?t=([A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g;
  for (const m of (roh ?? "").matchAll(re)) {
    if (!out.some((x) => x.token === m[2])) out.push({ art: m[1] as "antwort" | "einladung", token: m[2] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vorschlag aus dem Text

export type PostfachVorschlag = {
  art: RueckmeldungArt | null;
  /** Kurzbegründung („„…zu pachten…“ — sucht offenbar selbst“). */
  grund: string;
  /** Beratung: Thema aus dem Anliegen. */
  thema?: string;
  /** Hinweise für die Verwaltung (Löschwunsch, widersprüchliche Signale). */
  hinweis?: string;
};

/** Kleinbuchstaben, Umlaute ausgeschrieben, Leerraum vereinheitlicht — dafür sind die Muster geschrieben. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[„“”"«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Textstelle um einen Treffer für die Anzeige (Originalschreibung, ohne Umbrüche). */
function stelle(original: string, n: string, idx: number, laenge: number): string {
  // Die Normalisierung ändert die Länge (ä → ae) — die Stelle im Original über den Anteil schätzen.
  const f = original.length / Math.max(1, n.length);
  const von = Math.max(0, Math.floor((idx - 30) * f));
  const bis = Math.min(original.length, Math.ceil((idx + laenge + 30) * f));
  const s = original.slice(von, bis).replace(/\s+/g, " ").trim();
  return `„${von > 0 ? "…" : ""}${s}${bis < original.length ? "…" : ""}“`;
}

type Treffer = { idx: number; laenge: number };

function suche(n: string, muster: RegExp[]): Treffer | null {
  for (const re of muster) {
    const m = re.exec(n);
    if (m) return { idx: m.index, laenge: m[0].length };
  }
  return null;
}

const VERNEINUNG = /\b(kein|keine|keinen|keinerlei|nicht|nie|niemals)\b/;

/**
 * Wie `suche`, aber ohne verneinte Treffer: weder im Treffer selbst („ich möchte nicht pachten“)
 * noch kurz davor („kein Interesse“, „nicht interessiert“).
 */
function sucheBejaht(n: string, muster: RegExp[]): Treffer | null {
  for (const re of muster) {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of n.matchAll(global)) {
      const idx = m.index ?? 0;
      if (VERNEINUNG.test(m[0])) continue;
      if (/\b(kein|keine|keinen|keinerlei|nicht|nie|niemals)\b[^.!?,]{0,20}$/.test(n.slice(Math.max(0, idx - 30), idx))) continue;
      return { idx, laenge: m[0].length };
    }
  }
  return null;
}

const LOESCHWUNSCH = [
  /\b(daten|angaben|anfrage|kontaktdaten)\b.{0,50}\b(loeschen|entfernen|vernichten)\b/,
  /\bloeschen sie\b/,
  /\b(widerspreche|widerspruch gegen)\b.{0,60}\b(verarbeitung|nutzung|werbung|kontakt)/,
  /\bdsgvo\b|\bdatenschutz-?grundverordnung\b|\bart\.? ?(15|17|21)\b/,
];

const KEIN_INTERESSE = [
  /\bkein(e|en)? (weiteres |grosses )?(interesse|bedarf)\b/,
  /\bnicht (mehr )?(interessiert|aktuell|relevant|noetig)\b/,
  /\b(hat|haette|haben) sich (bereits |schon |inzwischen )?(erledigt|zerschlagen)\b/,
  /\b(bereits|schon|inzwischen|mittlerweile) (anderweitig )?(verkauft|verpachtet|vergeben|gefunden|verkauft worden|verpachtet worden)\b/,
  /\b(vorerst|erstmal|erst mal|momentan|derzeit|aktuell|zurzeit|zur zeit|vorlaeufig) (doch )?(noch )?nicht\b/,
  /\b(moechte|moechten|will|wollen|werde|werden|wuerde|wuerden|koennen|kann)\b[^.!?]{0,40}\bnicht (mehr )?(verkaufen|verpachten|abgeben|pachten|kaufen)\b/,
  /\bnicht (mehr )?(verkaufen|verpachten|abgeben)\b/,
  /\b(keine|nicht) (weiteren |mehr )?(e-?mails?|kontakt(aufnahme)?|nachrichten|anrufe|werbung|angebote)\b/,
  /\bmelden sie sich (bitte )?nicht\b|\bbitte nicht mehr (melden|anschreiben|kontaktieren)\b/,
  /\b(abmelden|austragen)\b/,
  /^(nein|nein danke|danke,? nein|danke,? aber nein)\b/,
  /\b(bitte|danke),? (aber )?nein\b/,
];

// „pachten“ ohne „ver“ davor (\b trennt „verpachten“), dazu an-/zu-/hinzupachten und Pachtgesuche —
// nur in der ersten Person („ich/wir … pachten“), sonst wäre „der Pächter möchte weiter pachten“ ein Treffer.
const SUCHT_PACHT = [
  /\b(ich|wir|uns|mich)\b[^.!?]{0,60}?\b(an|zu|hinzu|dazu)?pachten\b/,
  /\b(pachtgesuch|pachtland|pachtflaeche(n)?) (gesucht|suche|suchen)\b|\b(suche|suchen)\b.{0,40}\b(pacht|pachtland|pachtflaeche(n)?)\b/,
];
// „kaufen“ ohne „ver“ davor, erwerben, Kaufgesuche — nicht „Käufer suchen“ (das ist der Verkäufer).
const SUCHT_KAUF = [
  /\b(ich|wir|uns|mich)\b[^.!?]{0,60}?\b(an|dazu|hinzu|zu)?kaufen\b/,
  /\b(ich|wir)\b[^.!?]{0,60}?\b(erwerben|kaufinteresse|kaufgesuch)\b/,
  /\b(suche|suchen)\b.{0,40}\b(zum kauf|zu kaufen|kaufflaeche(n)?)\b/,
];
const MISSVERSTAENDNIS = /\b(missverstaendnis|verwechselt|verwechslung|versehentlich|aus versehen|falsch (angeklickt|ausgewaehlt|angegeben|verstanden))\b/;

// Positive Absicht vor dem Verb (ohne Verneinung dazwischen).
const ABSICHT = "(moechte|moechten|will|wollen|wuerde|wuerden|werde|werden|gern|gerne|bereit|interesse|interessiert|plane|planen|ueberlege|ueberlegen|beabsichtige|sogar|ja|koennte|koennten)";

function absicht(n: string, verb: string): Treffer | null {
  // Je Absichtswort einzeln prüfen (überlappend): „kein Interesse zu verkaufen, würde aber gern verpachten“
  // hat drei Kandidaten — der erste ist verneint, „gern verpachten“ zählt.
  const danach = new RegExp(`^([^.!?]{0,60}?)\\b${verb}\\b`);
  for (const m of n.matchAll(new RegExp(`\\b${ABSICHT}\\b`, "g"))) {
    const idx = m.index ?? 0;
    const d = danach.exec(n.slice(idx + m[0].length));
    if (!d) continue;
    if (/\b(nicht|kein|keine|keinesfalls|niemals|nie)\b/.test(d[1])) continue;
    // „kein Interesse (mehr) zu verkaufen“: Verneinung direkt vor dem Absichtswort.
    if (/\b(nicht|kein|keine|keinerlei|keinesfalls)\b[^.!?,]{0,12}$/.test(n.slice(Math.max(0, idx - 20), idx))) continue;
    return { idx, laenge: m[0].length + d[0].length };
  }
  // „…verkaufen möchte ich …“ / „verkaufen: ja“ — Verb vor der Absicht, im selben Satzteil (ohne Komma).
  const re2 = new RegExp(`\\b${verb}\\b([^.!?,;]{0,25}?)\\b(moechte|moechten|will|wollen|wuerde|wuerden|ja|gern|gerne)\\b`, "g");
  for (const m of n.matchAll(re2)) {
    const idx = m.index ?? 0;
    if (/\b(nicht|kein|keine)\b/.test(m[1])) continue;
    if (/\b(nicht|kein|keine|keinerlei)\b[^.!?,]{0,25}$/.test(n.slice(Math.max(0, idx - 30), idx))) continue;
    return { idx, laenge: m[0].length };
  }
  return null;
}

const WEITER_SUCHEN = [
  /\b(suche|suchen|sind|bin)\b.{0,30}\b(weiter(hin)?|noch immer|immer noch|nach wie vor)\b/,
  /\b(interessier(t|en|e)|interesse)\b/,
  /\bangebot (unterbreiten|machen|abgeben)\b/,
];
const BERATUNG = [
  /\b(beratung|beraten|rueckruf|zurueckrufen|anrufen|termin|besichtigung|besichtigen|vor ort|treffen|gespraech|telefonat|telefonisch)\b/,
  /\b(bewertung|wertermittlung|gutachten|was (ist|waere) (die|meine|unsere) flaeche wert|preisvorstellung)\b/,
];
const JA_KURZ = /^(ja|jawohl|jep|gern|gerne|ja,? (bitte|gern|gerne|sehr gern|sehr gerne|natuerlich|klar)|bitte|sehr gern|sehr gerne|natuerlich|selbstverstaendlich|besteht (noch|weiterhin))\b/;

/**
 * Vorschlag für eine Antwort per E-Mail. `gruppe`/`art` beschreiben die Anfrage
 * (Anbieter mit Kauf/Pacht, Suchender, reine Auskunft), `intent`/`flaechentyp` das
 * Formular (für das Beratungsthema). Reihenfolge: Löschwunsch → sucht selbst
 * (Missverständnis) → ausdrücklich verkaufen/verpachten → kein Interesse →
 * Suchende suchen weiter → kurzes „Ja“ → Beratung → Rückfrage/offen.
 */
export function postfachVorschlag(textRoh: string, ziel: { gruppe: Antwortgruppe; art: "kauf" | "pacht" | null; intent: string; flaechentyp: string }): PostfachVorschlag {
  const original = (textRoh ?? "").trim();
  const n = norm(original);
  if (!n) return { art: null, grund: "Kein eigener Text (nur Zitat oder Anhang) — bitte selbst ansehen" };
  const zeig = (t: Treffer) => stelle(original, n, t.idx, t.laenge);
  const thema = themaVorschlag(ziel.intent, ziel.flaechentyp);

  const loeschen = suche(n, LOESCHWUNSCH);
  if (loeschen) {
    return {
      art: "kein-interesse",
      grund: `${zeig(loeschen)} — will offenbar nicht mehr kontaktiert werden`,
      hinweis: "Mögliche Löschung/Widerspruch nach DSGVO — Anfrage prüfen und ggf. archivieren bzw. Daten löschen, Frist 1 Monat (Art. 12 Abs. 3 DSGVO)",
    };
  }

  const kein = suche(n, KEIN_INTERESSE);
  const verkaufen = absicht(n, "verkauf(en|t)?");
  const verpachten = absicht(n, "verpacht(en|et)?");
  const pachtSelbst = sucheBejaht(n, SUCHT_PACHT);
  const kaufSelbst = sucheBejaht(n, SUCHT_KAUF);
  const missverstaendnis = MISSVERSTAENDNIS.test(n);

  // Anbieter oder Auskunft, der selbst eine Fläche sucht (Formular falsch verstanden).
  if (ziel.gruppe !== "suchender" && (pachtSelbst || kaufSelbst) && !verkaufen && !verpachten) {
    const t = (pachtSelbst && kaufSelbst ? (pachtSelbst.idx <= kaufSelbst.idx ? pachtSelbst : kaufSelbst) : (pachtSelbst ?? kaufSelbst))!;
    const art: RueckmeldungArt = t === pachtSelbst ? "pachten" : "kaufen";
    return {
      art,
      grund: `${zeig(t)} — sucht offenbar selbst eine Fläche ${art === "pachten" ? "zur Pacht" : "zum Kauf"}${missverstaendnis ? " (Missverständnis beim Formular)" : ""}`,
      ...(kein ? { hinweis: `Enthält auch ${zeig(kein)} — bitte prüfen` } : {}),
    };
  }

  // Ausdrücklich verkaufen/verpachten — bei „nicht verkaufen, sondern verpachten“ zählt die positive Absicht.
  if (verkaufen || verpachten) {
    const beide = verkaufen && verpachten;
    const t = (beide ? (verkaufen!.idx <= verpachten!.idx ? verkaufen : verpachten) : (verkaufen ?? verpachten))!;
    const art: RueckmeldungArt = t === verkaufen ? "verkaufen" : "verpachten";
    const hinweise = [
      ...(beide ? ["Nennt Verkauf und Verpachtung — Einordnung prüfen"] : []),
      ...(kein ? [`Enthält auch ${zeig(kein)} — bitte prüfen`] : []),
      ...(ziel.gruppe === "suchender" ? ["Die Anfrage ist ein Gesuch — übernehmen ordnet sie als Angebot ein"] : []),
    ];
    return { art, grund: `${zeig(t)} — ${art === "verkaufen" ? "möchte verkaufen" : "möchte verpachten"}`, ...(hinweise.length ? { hinweis: hinweise.join(" · ") } : {}) };
  }

  // Suchende: „kein Interesse an Horn, aber Kalletal interessiert uns“ — die positive Aussage zählt.
  if (ziel.gruppe === "suchender") {
    const weiter = sucheBejaht(n, WEITER_SUCHEN) ?? (JA_KURZ.test(n) ? { idx: 0, laenge: Math.min(n.length, 20) } : null);
    if (weiter) return { art: "suche", grund: `${zeig(weiter)} — sucht weiter`, ...(kein ? { hinweis: `Enthält auch ${zeig(kein)} — bitte prüfen` } : {}) };
  }

  if (kein) return { art: "kein-interesse", grund: `${zeig(kein)} — kein Interesse mehr` };

  // Kurzes „Ja (bitte)“ auf die Frage der Nachfass-Mail: das bisherige Anliegen gilt weiter.
  if (JA_KURZ.test(n) && n.length <= 160) {
    const t = { idx: 0, laenge: Math.min(n.length, 30) };
    if (ziel.gruppe === "anbieter") {
      const art: RueckmeldungArt = ziel.art === "kauf" ? "verkaufen" : "verpachten";
      return { art, grund: `${zeig(t)} — bestätigt das Anliegen (${art === "verkaufen" ? "Verkauf" : "Verpachtung"})` };
    }
    if (ziel.gruppe === "beratung") return { art: "beratung", grund: `${zeig(t)} — möchte weiter beraten werden`, ...(thema ? { thema } : {}) };
  }

  const beratung = sucheBejaht(n, BERATUNG);
  if (beratung) return { art: "beratung", grund: `${zeig(beratung)} — wünscht Beratung bzw. Kontakt`, ...(thema ? { thema } : {}) };

  if (/\?/.test(original)) return { art: null, grund: "Rückfrage des Kunden — selbst antworten, danach „zur Kenntnis“" };
  return { art: null, grund: "Kein eindeutiges Anliegen erkannt — selbst lesen und einordnen" };
}
