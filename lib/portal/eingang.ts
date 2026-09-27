import { FLAECHENTYPEN, INTENTS } from "@/lib/lead-options";
import { GRUSS } from "./gruss";

// Eingang einer Anfrage über das Formular (/api/lead): Prüfen und Begrenzen der
// Felder sowie die automatische Eingangsbestätigung an den Kunden (Dennis,
// 27.09.2026: „vom Kunden selbst ausgelöst, rein informativ, mit Vorgangsnummer,
// ‚in der Regel innerhalb eines Werktags per E-Mail‘, keine Telefonnummer“).
// Ohne Server-Abhängigkeit, damit es sich direkt testen lässt.

export type Eingabe = {
  intent: string;
  flaechentyp: string;
  groesse: string;
  ort: string;
  flurstueck: string;
  message: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  consent: string;
  gclid: string;
  /** Kennung eines Flächenbörse-Angebots (LF-1234), sonst „—“. */
  boerse: string;
};

/** Höchstlängen je Feld — alles darüber wird gekürzt (Schutz vor Missbrauch des Formulars). */
export const FELD_MAX: Record<Exclude<keyof Eingabe, "boerse" | "consent">, number> = {
  intent: 60,
  flaechentyp: 40,
  groesse: 80,
  ort: 200,
  flurstueck: 200,
  message: 4000,
  name: 120,
  phone: 40,
  email: 200,
  source: 80,
  gclid: 300,
};

export const EMAIL_MUSTER = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]{2,}$/;

function feld(v: unknown, max: number): string {
  const s = (v ?? "").toString().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : "—";
}

export type EingangsPruefung = { ok: true; eingabe: Eingabe; spam: boolean } | { ok: false; fehler: string };

/** Formulardaten prüfen und bereinigen. `spam`: sieht nach Bot aus — still annehmen, nichts tun. */
export function eingangPruefen(body: Record<string, unknown>): EingangsPruefung {
  const e: Eingabe = {
    intent: feld(body.intent, FELD_MAX.intent),
    flaechentyp: feld(body.flaechentyp, FELD_MAX.flaechentyp),
    groesse: feld(body.groesse, FELD_MAX.groesse),
    ort: feld(body.ort, FELD_MAX.ort),
    flurstueck: feld(body.flurstueck, FELD_MAX.flurstueck),
    message: feld(body.message, FELD_MAX.message),
    name: feld(body.name, FELD_MAX.name),
    phone: feld(body.phone, FELD_MAX.phone),
    email: feld(body.email, FELD_MAX.email).toLowerCase(),
    source: feld(body.source, FELD_MAX.source),
    consent: feld(body.consent, 10),
    gclid: feld(body.gclid, FELD_MAX.gclid),
    boerse: typeof body.boerse === "string" && /^LF-\d{4}$/.test(body.boerse.trim()) ? body.boerse.trim() : "—",
  };
  // Nur bekannte Anliegen und Flächentypen — alles andere gilt als „Allgemein“ bzw. offen.
  if (!(INTENTS as readonly string[]).includes(e.intent)) e.intent = "Allgemein";
  if (!(FLAECHENTYPEN as readonly string[]).includes(e.flaechentyp)) e.flaechentyp = "—";
  // Telefon: nur Ziffern und übliche Zeichen.
  if (e.phone !== "—" && !/^[+\d][\d\s()/.-]{3,}$/.test(e.phone)) e.phone = "—";

  // Leichter Spam-Filter: Links im Namen sind ein sehr starkes Bot-Signal.
  const spam = /https?:\/\/|\[url=|<a\s|www\./i.test(e.name);
  if (!e.email || e.email === "—") return { ok: false, fehler: "Bitte geben Sie eine E-Mail-Adresse an." };
  if (!EMAIL_MUSTER.test(e.email)) return { ok: false, fehler: "Bitte prüfen Sie Ihre E-Mail-Adresse." };
  if (!e.name || e.name === "—") return { ok: false, fehler: "Bitte geben Sie Ihren Namen an." };
  if (e.consent !== "on") return { ok: false, fehler: "Bitte stimmen Sie der Datenschutzerklärung zu." };
  return { ok: true, eingabe: e, spam };
}

function zeitDe(iso: string): string {
  const d = new Date(iso);
  const tag = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const uhr = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return `${tag} um ${uhr} Uhr`;
}

/**
 * Eingangsbestätigung: bewusst ohne Freitexte aus dem Formular (Name, Nachricht) — so
 * lässt sich das Formular nicht missbrauchen, um fremden Adressen beliebige Texte zu schicken.
 */
export function eingangsbestaetigung(e: Pick<Eingabe, "intent" | "flaechentyp" | "boerse">, id: string, am: string): { betreff: string; text: string } {
  const anliegen = [e.intent, e.flaechentyp !== "—" ? e.flaechentyp : ""].filter(Boolean).join(" · ");
  return {
    betreff: `Ihre Anfrage bei Lippe Forst ist eingegangen (Vorgang ${id})`,
    text: [
      "Guten Tag,",
      "",
      `vielen Dank für Ihre Anfrage. Sie ist am ${zeitDe(am)} bei uns eingegangen.`,
      "",
      `Ihre Vorgangsnummer: ${id}`,
      `Anliegen: ${anliegen}`,
      ...(e.boerse !== "—" ? [`Flächenbörse: Interesse an Angebot ${e.boerse}`] : []),
      "",
      "Wir melden uns in der Regel innerhalb eines Werktags per E-Mail bei Ihnen. Bei Rückfragen antworten Sie einfach auf diese E-Mail und nennen Sie Ihre Vorgangsnummer.",
      "",
      "Diese E-Mail wurde automatisch verschickt, weil über das Formular auf lippeforst.de eine Anfrage mit dieser E-Mail-Adresse gestellt wurde. Waren Sie das nicht, können Sie diese E-Mail ignorieren oder uns kurz Bescheid geben. Wie wir Ihre Angaben verarbeiten: lippeforst.de/datenschutz",
      "",
      GRUSS,
    ].join("\n"),
  };
}
