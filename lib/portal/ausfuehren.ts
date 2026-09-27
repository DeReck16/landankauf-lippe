import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { LeadView } from "@/lib/admin/model";
import * as A from "./ablauf";
import { assistentEntwurf, type AssistentMail, type AssistentUmgebung } from "./assistent";
import { entwuerfeKunde } from "./entwuerfe";
import type * as M from "./model";
import { ladeKunde } from "./speicher";
import { rolleVonLead, wert } from "./texte";
import { verwaltungsMailSenden } from "./versand";
import * as V from "./vorgang";
import { wegSetzen } from "./weg";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";

// Gemeinsame Ausführung für Klick-Assistent (app/admin/assistent-actions.ts) und Automatik
// (lib/portal/automatik.ts): Link erstellen, Mails nach aktuellem Stand erzeugen und einzeln
// senden, Einladung zu einer neuen Anfrage. Keine Server Actions — die Aufrufer prüfen vorher
// die Anmeldung bzw. die Automatik-Schalter. Jede Mail läuft über verwaltungsMailSenden
// (dieselben Sperren wie beim Einzelversand).

export type AusfuehrZeile = { art: "ok" | "fehler" | "info"; text: string };

export type Umgebung = AssistentUmgebung & { kunden: Map<string, M.KundeRecord> };

/** Neuen persönlichen Einladungslink erstellen — mit denselben Prüfungen wie „Einladung erstellen“. */
export async function linkErstellen(von: string, m: AssistentMail, u: AssistentUmgebung, zeilen: AusfuehrZeile[]): Promise<boolean> {
  const geladen = await A.ladeLead(m.kundeId);
  if (!geladen) {
    zeilen.push({ art: "fehler", text: `${m.wer}: Anfrage nicht gefunden.` });
    return false;
  }
  const rr = rolleVonLead(geladen.lead);
  if (!rr) {
    zeilen.push({ art: "fehler", text: `${m.wer}: Die Anfrage ist nicht als Angebot oder Gesuch mit Kauf/Pacht eingeordnet.` });
    return false;
  }
  const vorlage = kundenVorlage(rr.rolle, rr.art);
  if (!istFreigegeben(u.einstellungen, vorlage)) {
    zeilen.push({ art: "fehler", text: `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — kein Link für ${m.werAkk}.` });
    return false;
  }
  try {
    await A.einladungErstellen(geladen.lead, von);
  } catch (err) {
    unstable_rethrow(err);
    zeilen.push({ art: "fehler", text: `${m.wer}: ${err instanceof Error ? err.message : "Einladung nicht möglich."}` });
    return false;
  }
  zeilen.push({ art: "ok", text: `Persönlicher Einladungslink für ${m.werAkk} erstellt (30 Tage gültig)` });
  return true;
}

/** Mails nach dem aktuellen Stand erzeugen (echte Links) und einzeln senden — je Mail eine Zeile ✓/✗. */
export async function mailsSenden(von: string, key: string, u: AssistentUmgebung, geplant: AssistentMail[], zeilen: AusfuehrZeile[]): Promise<number> {
  if (geplant.length === 0) return 0;
  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx) {
    zeilen.push({ art: "fehler", text: "Vorgang nicht gefunden — keine E-Mail gesendet." });
    return 0;
  }
  let gesendet = 0;
  for (const m of geplant) {
    const e = assistentEntwurf(ctx, u, m.zweck, m.rolle);
    if (!e || e.gesperrt) {
      zeilen.push({ art: "fehler", text: `E-Mail an ${m.wer}: nicht gesendet — ${e?.gesperrt ?? "nicht mehr vorgesehen"}` });
      continue;
    }
    const r = await verwaltungsMailSenden(von, { zweck: e.zweck, kundeId: e.kundeId, key, rolle: m.rolle, an: e.an, betreff: e.betreff, text: e.text });
    zeilen.push(r.ok ? { art: "ok", text: `E-Mail an ${m.wer} (${e.an}): „${e.betreff}“` } : { art: "fehler", text: `E-Mail an ${m.wer} (${e.an}) nicht gesendet: ${r.text}` });
    if (r.ok) gesendet++;
  }
  return gesendet;
}

/**
 * Einladung zu einer neuen Anfrage ohne Paar (Dashboard-Knopf „Einladen“ bzw. Automatik R3):
 * Link bei Bedarf erstellen, Einladung senden; bei einem Angebot mit offenem Weg „Vermitteln“ vermerken.
 */
export async function anfrageEinladen(lead: LeadView, von: string, u: Umgebung, zeilen: AusfuehrZeile[]): Promise<boolean> {
  const rr = rolleVonLead(lead);
  if (!rr) {
    zeilen.push({ art: "fehler", text: "Für diese Anfrage ist keine Einladung möglich." });
    return false;
  }
  const name = wert(lead.name) || lead.id;
  let kunde = await ladeKunde(lead.id);
  if (!kunde?.einladung || Date.parse(kunde.einladung.bis) < Date.now()) {
    const vorlage = kundenVorlage(rr.rolle, rr.art);
    if (!istFreigegeben(u.einstellungen, vorlage)) {
      zeilen.push({ art: "fehler", text: `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben — keine Einladung.` });
      return false;
    }
    await A.einladungErstellen(lead, von);
    zeilen.push({ art: "ok", text: `Persönlicher Einladungslink für ${name} erstellt (30 Tage gültig)` });
    kunde = await ladeKunde(lead.id);
  }
  const e = entwuerfeKunde({ lead, kunde, einstellungen: u.einstellungen, basis: u.basis, kunden: u.kunden.values() }).find((x) => x.zweck === "einladung");
  if (!e || e.gesperrt) {
    zeilen.push({ art: "fehler", text: `E-Mail an ${name}: nicht gesendet — ${e?.gesperrt ?? "keine Einladung möglich"}` });
    return false;
  }
  const r = await verwaltungsMailSenden(von, { zweck: "einladung", kundeId: lead.id, rolle: rr.rolle, an: e.an, betreff: e.betreff, text: e.text });
  zeilen.push(r.ok ? { art: "ok", text: `E-Mail an ${name} (${e.an}): „${e.betreff}“` } : { art: "fehler", text: `E-Mail an ${name} (${e.an}) nicht gesendet: ${r.text}` });
  if (!r.ok) return false;
  if (rr.rolle === "anbieter" && !lead.meta.weg) {
    await wegSetzen(lead.id, "vermittlung", von);
    zeilen.push({ art: "ok", text: "Weg „Vermitteln“ vermerkt" });
  }
  zeilen.push({ art: "ok", text: "Status → „Beantwortet“ — die Anfrage steht nicht mehr unter „Neue Anfragen“" });
  return true;
}
