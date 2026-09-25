import "server-only";
import type { LeadView, Zustand } from "@/lib/admin/model";
import type { NachfassKandidat } from "./anfrage-typen";
import { nachfassEntwurf } from "./entwuerfe";
import * as M from "./model";
import { RUECKMELDUNG_NAME } from "./rueckmeldung-typen";
import * as T from "./texte";

// Gesammeltes Nachfassen alter Anfragen (Dashboard „Nachfassen“): Wer sich vor
// längerer Zeit gemeldet hat und seitdem nichts mehr von uns gehört hat, bekommt
// auf Klick eine kurze Mail, ob noch Interesse besteht — mit persönlichem
// Antwort-Link; jede Antwort wird im Dashboard zum Ticket (lib/portal/rueckmeldung.ts).
// Gesendet wird in
// app/admin/assistent-actions.ts (nachfassenAktion) als Einzelmail über
// lib/portal/versand.ts — dort werden Datum („nachgefasst am“) und Status vermerkt.

/** Nachfassen frühestens so viele Tage nach Eingang und letztem Kontakt (Standard 21, per LF_NACHFASS_TAGE übersteuerbar, z. B. 0 für Tests). */
export function nachfassTage(): number {
  const roh = (process.env.LF_NACHFASS_TAGE ?? "").trim();
  const n = roh ? Number(roh) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 21;
}

/** „nach 21 Tagen“ — für Texte in der Oberfläche. */
export function nachfassFrist(tage = nachfassTage()): string {
  return tage === 0 ? "sofort" : tage === 1 ? "nach einem Tag" : `nach ${tage} Tagen`;
}

/** Nach einer Nachfass-Mail so viele Tage Ruhe. */
export const NACHFASS_PAUSE_TAGE = 60;

const TAG_MS = 86_400_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFEN = new Set(["neu", "in_arbeit", "beantwortet"]);
/** Einträge im Verlauf der Anfrage, die einen Kontakt bedeuten (Mail, Antwort, Nachfassen). */
const KONTAKT_PROTOKOLL = /E-Mail gesendet|Nachfass-Mail gesendet|Status → Beantwortet/;

function kuerzen(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Letzter Kontakt mit dem Kunden: gesendete Mail, Aktivität im Kundenbereich, Antwort oder Nachfassen laut Verlauf. */
export function letzterKontakt(l: LeadView, k: M.KundeRecord | null, protokoll: Zustand["protokoll"]): { am: string; text: string } | null {
  const liste: { am: string; text: string }[] = [];
  const mail = k?.mails.filter((m) => m.ok).sort((a, b) => b.am.localeCompare(a.am))[0];
  if (mail) liste.push({ am: mail.am, text: `E-Mail „${kuerzen(mail.betreff, 60)}“` });
  const aktiv = k?.ereignisse.find((e) => e.von === "kunde" || e.von.startsWith("kunde:"));
  if (aktiv) liste.push({ am: aktiv.am, text: `im Kundenbereich: ${kuerzen(aktiv.text, 60)}` });
  if (l.meta.nachgefasstAm) liste.push({ am: l.meta.nachgefasstAm, text: "nachgefasst" });
  if (l.meta.rueckmeldung) liste.push({ am: l.meta.rueckmeldung.am, text: `Rückmeldung: ${RUECKMELDUNG_NAME[l.meta.rueckmeldung.art]}` });
  // Mit Kundenakte stehen gesendete Mails dort (genauer) — aus dem Verlauf zählt dann nur das „Als beantwortet markieren“.
  const p = protokoll.find((x) => x.ref === l.id && (k ? /Status → Beantwortet/.test(x.was) && !/gesendet/.test(x.was) : KONTAKT_PROTOKOLL.test(x.was)));
  if (p) {
    const betreff = /(?:E-Mail|Nachfass-Mail) gesendet: „([^“]*)“/.exec(p.was)?.[1];
    liste.push({ am: p.am, text: betreff ? `E-Mail „${kuerzen(betreff, 60)}“` : "als beantwortet markiert" });
  }
  return liste.sort((a, b) => b.am.localeCompare(a.am))[0] ?? null;
}

/** Anfragen, bei denen jetzt Nachfassen möglich ist — älteste zuerst. `neu` setzt das Dashboard. */
export function nachfassKandidaten(opts: {
  leads: LeadView[];
  zustand: Zustand;
  kunden: Map<string, M.KundeRecord>;
  vorgaenge: Map<string, M.VorgangRecord>;
  jetzt: Date;
  /** Adresse der Website für den Antwort-Link. */
  basis: string;
  tage?: number;
}): NachfassKandidat[] {
  const { leads, zustand, kunden, vorgaenge, jetzt, basis } = opts;
  const tage = opts.tage ?? nachfassTage();
  const grenze = jetzt.getTime() - tage * TAG_MS;
  const pause = jetzt.getTime() - NACHFASS_PAUSE_TAGE * TAG_MS;

  // Aktive Paare über „Vorschlag“ hinaus (vorgemerkt, angefragt, Kontakt, Abschluss) — dort läuft der Vorgang.
  const imVorgang = new Set<string>();
  for (const [key, meta] of Object.entries(zustand.paare)) {
    if (meta.status === "vorschlag" || meta.status === "verworfen") continue;
    const v = vorgaenge.get(key);
    if (v?.beendet && !v.abschluss) continue;
    for (const id of key.split("~")) imVorgang.add(id);
  }

  const out: NachfassKandidat[] = [];
  for (const l of leads) {
    if (!OFFEN.has(l.status)) continue;
    // Offenes Ticket (Antwort auf eine frühere Nachfass-Mail, noch nicht bearbeitet): nicht erneut fragen.
    if (l.meta.rueckmeldung && l.meta.rueckmeldung.art !== "kein-interesse" && l.status === "neu") continue;
    try {
      const k = kunden.get(l.id) ?? null;
      const mail = nachfassEntwurf(l, k, basis);
      if (!EMAIL.test(mail.an)) continue;
      const eingang = Date.parse(l.receivedAt);
      if (!Number.isFinite(eingang) || eingang > grenze) continue;
      const nachgefasst = l.meta.nachgefasstAm ? Date.parse(l.meta.nachgefasstAm) : NaN;
      if (Number.isFinite(nachgefasst) && nachgefasst > pause) continue;
      if (imVorgang.has(l.id)) continue;
      // Unterschrieben (auch widerrufen oder gekündigt) oder gesperrt: kein Nachfassen.
      if (k?.vertrag || k?.gesperrt) continue;
      // Nicht kurz nach einer Einladung, Antwort oder Aktivität des Kunden nachhaken.
      const kontakt = letzterKontakt(l, k, zustand.protokoll);
      if (kontakt && Date.parse(kontakt.am) > grenze) continue;
      const seit = Math.max(eingang + tage * TAG_MS, Number.isFinite(nachgefasst) ? nachgefasst + NACHFASS_PAUSE_TAGE * TAG_MS : 0, kontakt ? Date.parse(kontakt.am) + tage * TAG_MS : 0);
      out.push({
        id: l.id,
        name: k?.stammdaten?.name || T.wert(l.name) || l.id,
        anliegen: T.wert(l.intent) || "—",
        typ: mail.typ,
        eingang: l.receivedAt,
        letzterKontakt: kontakt,
        an: mail.an,
        betreff: mail.betreff,
        text: mail.text,
        seit: new Date(Math.min(seit, jetzt.getTime())).toISOString(),
        neu: false,
      });
    } catch (err) {
      // Ein kaputter Datensatz darf das Dashboard nicht lahmlegen.
      console.error("[nachfassen] Anfrage nicht auswertbar", l.id, err);
    }
  }
  return out.sort((a, b) => a.eingang.localeCompare(b.eingang));
}
