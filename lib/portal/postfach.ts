import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminEmails } from "@/lib/admin/config";
import { leadView, type LeadMeta, type LeadView, type PostfachMail, type Zustand } from "@/lib/admin/model";
import { listLeads, mutateZustand, readZustand } from "@/lib/admin/store";
import * as A from "./ablauf";
import { adminInfo } from "./mail";
import type * as M from "./model";
import { kernText, linkTokens, neuerTeil, postfachVorschlag } from "./postfach-text";
import { rueckmeldungSpeichern, type RueckmeldungErgebnis } from "./rueckmeldung";
import { RUECKMELDUNG_NAME, antwortGruppe, antwortOptionen, type RueckmeldungArt } from "./rueckmeldung-typen";
import { alleKunden } from "./speicher";
import * as T from "./texte";
import { pruefeAntwort, pruefeEinladung } from "./token";

// Postfach-Abgleich (Dennis 25.09.2026: „eine Routine, die E-Mails im Postfach checkt
// und das Backend updatet“): Ein Skript auf dem Mac (scripts/postfach/abgleich.py,
// täglich per launchd) liest das Anfragenpostfach info@tr-immobilien.com in Outlook
// und meldet Mails von Interessenten an /api/verwaltung/postfach. Hier werden sie der
// Anfrage zugeordnet (Absenderadresse oder persönlicher Link im zitierten Text),
// der neue Text ohne Zitat gespeichert und ein Vorschlag abgeleitet. Daraus wird ein
// Ticket im Dashboard („Rückmeldungen“): EIN Klick übernimmt den Vorschlag als
// Rückmeldung (lib/portal/rueckmeldung.ts) oder nimmt die Mail zur Kenntnis. Von
// selbst ändert der Abgleich keine Einordnung und keinen Status; an Kunden geht nichts.

/** So viele Mails je Anfrage bleiben gespeichert (neueste zuerst). */
const MAX_JE_ANFRAGE = 12;
/** Wie lib/admin/store.ts: der Verlauf bleibt begrenzt. */
const PROTOKOLL_MAX = 400;
/** Höchstens so viele Mails je Aufruf. */
export const MAX_JE_AUFRUF = 60;
/** Eigene Adressen und Absender, die nie ein Kunde sind. */
const INTERN = /@(lippeforst\.de|tr-immobilien\.com|tr-vertrieb\.de)$|^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster)@|@formspree\.io$|@resend\.dev$/;

export type PostfachEingabe = {
  /** Message-ID (ohne < >) — Dublettenschutz über alle Läufe. */
  id: string;
  /** Eingang im Postfach (ISO). */
  am: string;
  von: string;
  betreff?: string;
  /** Voller Klartext der Mail, auch mit Zitat (daraus werden persönliche Links gelesen). */
  text: string;
};

export type PostfachErgebnis = {
  id: string;
  ergebnis: "neu" | "bekannt" | "unzugeordnet" | "intern" | "ungueltig";
  anfrage?: string;
  vorschlag?: RueckmeldungArt | null;
};

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function adresseNorm(s: string): string {
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

function istIntern(adresse: string): boolean {
  return INTERN.test(adresse) || adminEmails().includes(adresse);
}

/** Kurze, stabile Kennung einer Mail für Formulare und „gesehen“-Marker. */
export function mailKey(mailId: string): string {
  return sha(mailId).slice(0, 16);
}

/** Offen = weder übernommen noch zur Kenntnis genommen. */
export function istOffen(m: PostfachMail): boolean {
  return !m.erledigt;
}

/** Anfragen (ohne Archiv), deren Absender Kunden sind: Adresse der Anfrage und der Kundenakte. */
async function kundenAdressen(): Promise<{ leads: LeadView[]; zustand: Zustand; nachAdresse: Map<string, LeadView[]> }> {
  const [roh, { zustand }, kunden] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
  const leads = roh.map((l) => leadView(l, zustand.anfragen[l.id]));
  const kundeVon = new Map<string, M.KundeRecord>(kunden.map((k) => [k.id, k]));
  const nachAdresse = new Map<string, LeadView[]>();
  for (const l of leads) {
    if (l.status === "archiv") continue;
    const adressen = new Set([adresseNorm(T.wert(l.email)), adresseNorm(kundeVon.get(l.id)?.email ?? "")]);
    for (const a of adressen) {
      if (!a.includes("@") || istIntern(a)) continue;
      nachAdresse.set(a, [...(nachAdresse.get(a) ?? []), l]);
    }
  }
  return { leads, zustand, nachAdresse };
}

/**
 * Gehashte Absenderadressen aller Kunden — das Skript auf dem Mac meldet nur Mails
 * dieser Absender (und Antworten mit „Lippe Forst“ im Betreff), sonst nichts aus dem Postfach.
 */
export async function postfachAdressen(): Promise<string[]> {
  const { nachAdresse } = await kundenAdressen();
  return [...nachAdresse.keys()].map(sha).sort();
}

/** Letzter Kontakt einer Anfrage (zum Wählen, wenn eine Adresse zu mehreren Anfragen gehört). */
function zuletzt(l: LeadView): string {
  return [l.receivedAt, l.meta.nachgefasstAm, l.meta.rueckmeldung?.am, l.meta.geaendert?.am, l.meta.postfach?.[0]?.am].filter(Boolean).sort().at(-1) ?? "";
}

/** Vorgangsnummern („LL-MUDWPZYV“) im Text, die es als Anfrage gibt. */
function kennungen(text: string, leads: LeadView[]): LeadView[] {
  const out: LeadView[] = [];
  for (const m of (text ?? "").matchAll(/\bLL-[A-Z0-9]{6,12}\b/g)) {
    const l = leads.find((x) => x.id === m[0] && x.status !== "archiv");
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

/**
 * Zu welcher Anfrage gehört die Mail? Persönlicher Link im Text, dann Vorgangsnummer im Betreff
 * (steht in unseren Vertragsmails), dann Absenderadresse, zuletzt eine Vorgangsnummer im zitierten Text.
 */
function zuordnen(e: PostfachEingabe, leads: LeadView[], nachAdresse: Map<string, LeadView[]>): { lead: LeadView; zuordnung: PostfachMail["zuordnung"] } | null {
  // Der persönliche Link ging nur an diesen Kunden — antwortet jemand anderes darauf (z. B. der Ehepartner
  // von eigener Adresse), gehört die Mail trotzdem zu dieser Anfrage.
  for (const t of linkTokens(e.text)) {
    const id = t.art === "antwort" ? pruefeAntwort(t.token)?.k : pruefeEinladung(t.token)?.k;
    const lead = id ? leads.find((l) => l.id === id && l.status !== "archiv") : undefined;
    if (lead) return { lead, zuordnung: "link" };
  }
  const imBetreff = kennungen(e.betreff ?? "", leads);
  if (imBetreff.length === 1) return { lead: imBetreff[0], zuordnung: "kennung" };
  const kandidaten = nachAdresse.get(adresseNorm(e.von)) ?? [];
  if (kandidaten.length > 0) {
    // Mehrere Anfragen derselben Adresse: die mit dem jüngsten Kontakt, offene vor erledigten.
    const sortiert = [...kandidaten].sort((a, b) => Number(a.status === "erledigt") - Number(b.status === "erledigt") || zuletzt(b).localeCompare(zuletzt(a)));
    return { lead: sortiert[0], zuordnung: "absender" };
  }
  const imText = kennungen(e.text, leads);
  return imText.length === 1 ? { lead: imText[0], zuordnung: "kennung" } : null;
}

const ZUORDNUNG: Record<PostfachMail["zuordnung"], string> = { link: "persönlicher Link", kennung: "Vorgangsnummer", absender: "Absender" };

function kuerzen(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Mails aus dem Postfach übernehmen: zuordnen, Dubletten auslassen, neuen Text und
 * Vorschlag speichern. Mails, deren Anliegen schon als Rückmeldung erfasst ist (erfasst
 * nach Eingang der Mail), gelten gleich als erledigt. Eine Meldung an die Verwaltung
 * fasst neue Tickets zusammen.
 */
export async function postfachEingang(eingaben: PostfachEingabe[], opts: { basis: string }): Promise<PostfachErgebnis[]> {
  const { leads, nachAdresse } = await kundenAdressen();
  const jetzt = new Date().toISOString();
  const ergebnisse: PostfachErgebnis[] = [];
  const neu: { lead: LeadView; mail: PostfachMail }[] = [];

  for (const e of eingaben.slice(0, MAX_JE_AUFRUF)) {
    const id = String(e.id ?? "").trim().replace(/^<|>$/g, "").slice(0, 300);
    const von = adresseNorm(String(e.von ?? "")).slice(0, 200);
    const am = Date.parse(String(e.am ?? ""));
    if (!id || !von.includes("@") || !Number.isFinite(am)) {
      ergebnisse.push({ id: id || "?", ergebnis: "ungueltig" });
      continue;
    }
    if (istIntern(von)) {
      ergebnisse.push({ id, ergebnis: "intern" });
      continue;
    }
    const text = String(e.text ?? "").slice(0, 60_000);
    const z = zuordnen({ ...e, id, von, text }, leads, nachAdresse);
    if (!z) {
      ergebnisse.push({ id, ergebnis: "unzugeordnet" });
      continue;
    }
    const l = z.lead;
    if (l.meta.postfach?.some((m) => m.id === id) || neu.some((x) => x.mail.id === id)) {
      ergebnisse.push({ id, ergebnis: "bekannt", anfrage: l.id });
      continue;
    }
    const inhalt = neuerTeil(text);
    const v = postfachVorschlag(inhalt, { gruppe: antwortGruppe(l.rolle), art: l.art, intent: T.wert(l.intent), flaechentyp: T.wert(l.flaechentyp) });
    // Nur Vorschläge, die die Verwaltung auch übernehmen kann.
    const erlaubt = antwortOptionen(antwortGruppe(l.rolle), l.art, true);
    const vorschlag = v.art && erlaubt.includes(v.art) ? v.art : null;
    const amIso = new Date(am).toISOString();
    const mail: PostfachMail = {
      id,
      am: amIso,
      von,
      betreff: kuerzen(String(e.betreff ?? "").replace(/\s+/g, " ").trim(), 200),
      text: inhalt,
      zuordnung: z.zuordnung,
      vorschlag,
      grund: vorschlag || !v.art ? v.grund : `${v.grund} (passt nicht zur Einordnung — bitte selbst wählen)`,
      ...(v.hinweis ? { hinweis: v.hinweis } : {}),
      erfasstAm: jetzt,
      // Schon als Rückmeldung erfasst (nach Eingang der Mail, z. B. per Link oder von Hand): nur ablegen.
      ...(l.meta.rueckmeldung && l.meta.rueckmeldung.am >= amIso ? { erledigt: { am: jetzt, von: "postfach", wie: "spaeter-erfasst" as const } } : {}),
    };
    neu.push({ lead: l, mail });
    ergebnisse.push({ id, ergebnis: "neu", anfrage: l.id, vorschlag });
  }

  if (neu.length > 0) {
    // Je Anfrage ein eigener Verlaufseintrag (die Anfrage-Seite zeigt ihren Verlauf über `ref`).
    await mutateZustand("postfach", (z) => {
      for (const { lead, mail } of neu) {
        const meta: LeadMeta = { ...(z.anfragen[lead.id] ?? {}) };
        const liste = meta.postfach ?? [];
        if (liste.some((m) => m.id === mail.id)) continue;
        // Frisch gelesen: eine inzwischen erfasste Rückmeldung macht die Mail ebenfalls erledigt.
        const m = !mail.erledigt && meta.rueckmeldung && meta.rueckmeldung.am >= mail.am ? { ...mail, erledigt: { am: jetzt, von: "postfach", wie: "spaeter-erfasst" as const } } : mail;
        meta.postfach = [m, ...liste].sort((a, b) => b.am.localeCompare(a.am)).slice(0, MAX_JE_ANFRAGE);
        z.anfragen[lead.id] = meta;
        z.protokoll.unshift({
          am: jetzt,
          von: "postfach",
          ref: lead.id,
          was: `E-Mail aus dem Postfach zugeordnet (${ZUORDNUNG[mail.zuordnung]}): „${kuerzen(mail.betreff || "ohne Betreff", 80)}“ vom ${T.datumDe(mail.am)} — ${m.erledigt ? "Antwort war schon erfasst" : `Vorschlag: ${mail.vorschlag ? RUECKMELDUNG_NAME[mail.vorschlag] : "selbst einordnen"}`}`,
        });
      }
      z.protokoll.length = Math.min(z.protokoll.length, PROTOKOLL_MAX);
    });

    const tickets = neu.filter((x) => !x.mail.erledigt);
    if (tickets.length > 0) {
      await adminInfo(
        tickets.length === 1 ? `E-Mail-Antwort von ${T.wert(tickets[0].lead.name) || tickets[0].lead.id} zugeordnet` : `${tickets.length} E-Mail-Antworten zugeordnet`,
        [
          "Der Postfach-Abgleich hat Antworten von Interessenten aus dem Anfragenpostfach den Anfragen zugeordnet. Geändert ist noch nichts — im Dashboard unter „Rückmeldungen“ genügt je Mail ein Klick (Vorschlag übernehmen oder zur Kenntnis nehmen).",
          "",
          ...tickets.flatMap(({ lead, mail }) => [
            `• ${T.wert(lead.name) || lead.id} (${lead.id}, ${T.wert(lead.intent) || "—"}) — E-Mail vom ${T.datumDe(mail.am)}: „${kuerzen(mail.text.replace(/\s+/g, " "), 220)}“`,
            `  Vorschlag: ${mail.vorschlag ? RUECKMELDUNG_NAME[mail.vorschlag] : "selbst einordnen"}${mail.hinweis ? ` · Hinweis: ${mail.hinweis}` : ""}`,
          ]),
        ],
        `${opts.basis}/admin/dashboard#rueckmeldungen`,
      );
    }
    revalidatePath("/admin", "layout");
  }
  return ergebnisse;
}

export type PostfachUebernahme =
  | { ok: true; art: RueckmeldungArt; name: string; rueckmeldung: RueckmeldungErgebnis }
  | { ok: false; fehler: string };

async function mailFinden(anfrageId: string, schluessel: string): Promise<{ lead: LeadView; mail: PostfachMail } | null> {
  const geladen = await A.ladeLead(anfrageId);
  if (!geladen) return null;
  const mail = geladen.lead.meta.postfach?.find((m) => m.id === schluessel || mailKey(m.id) === schluessel);
  return mail ? { lead: geladen.lead, mail } : null;
}

/**
 * Mail als erledigt markieren. Beim Übernehmen gehen ältere offene Mails derselben Anfrage mit,
 * sofern sie nichts anderes sagen (kein Vorschlag oder derselbe) — z. B. eine frühere Rückfrage.
 * Ältere Mails mit einem anderen Anliegen bleiben offen, ebenso alles bei „zur Kenntnis“.
 */
async function erledigen(anfrageId: string, mailId: string, erledigt: NonNullable<PostfachMail["erledigt"]>, was: string): Promise<void> {
  await mutateZustand(erledigt.von, (z) => {
    const meta: LeadMeta = { ...(z.anfragen[anfrageId] ?? {}) };
    const liste = meta.postfach ?? [];
    const ziel = liste.find((m) => m.id === mailId);
    if (!ziel || ziel.erledigt) return;
    const mitnehmen = (m: PostfachMail) => erledigt.wie === "uebernommen" && !m.erledigt && m.am <= ziel.am && (m.vorschlag === null || m.vorschlag === erledigt.art);
    meta.postfach = liste.map((m) => (m.id === mailId ? { ...m, erledigt } : mitnehmen(m) ? { ...m, erledigt: { am: erledigt.am, von: erledigt.von, wie: "kenntnis" as const } } : m));
    meta.geaendert = { am: erledigt.am, von: erledigt.von };
    z.anfragen[anfrageId] = meta;
    return { was, ref: anfrageId };
  });
}

/**
 * Vorschlag (oder eine andere Antwort) aus einer Mail übernehmen: speichert die Rückmeldung
 * wie beim Antwort-Link (Ticket, Einordnung, „kein Interesse“ → Erledigt) und hakt die Mail ab.
 */
export async function postfachUebernehmen(anfrageId: string, schluessel: string, art: RueckmeldungArt, opts: { von: string; basis: string; thema?: string }): Promise<PostfachUebernahme> {
  const f = await mailFinden(anfrageId, schluessel);
  if (!f) return { ok: false, fehler: "E-Mail nicht gefunden — die Ansicht ist veraltet." };
  const { lead, mail } = f;
  const name = T.wert(lead.name) || lead.id;
  if (mail.erledigt) return { ok: false, fehler: `Die E-Mail von ${name} ist schon bearbeitet.` };
  // Nur die Aussage selbst (ohne Anrede und Grußformel) — ein Antwortentwurf zitiert sie („Sie schrieben: …“).
  const r = await rueckmeldungSpeichern(anfrageId, { art, thema: opts.thema, text: kernText(mail.text) }, { quelle: "email", von: opts.von, basis: opts.basis, mail: mail.id });
  if (!r.ok) return { ok: false, fehler: r.fehler };
  await erledigen(anfrageId, mail.id, { am: new Date().toISOString(), von: opts.von, art, wie: "uebernommen" }, `E-Mail vom ${T.datumDe(mail.am)} übernommen: ${RUECKMELDUNG_NAME[art]}`);
  revalidatePath("/admin", "layout");
  return { ok: true, art, name, rueckmeldung: r };
}

/** Mail nur zur Kenntnis nehmen (z. B. Dank, Rückfrage schon selbst beantwortet) — nichts wird eingeordnet. */
export async function postfachZurKenntnis(anfrageId: string, schluessel: string, von: string): Promise<{ ok: true; name: string } | { ok: false; fehler: string }> {
  const f = await mailFinden(anfrageId, schluessel);
  if (!f) return { ok: false, fehler: "E-Mail nicht gefunden — die Ansicht ist veraltet." };
  const name = T.wert(f.lead.name) || f.lead.id;
  if (f.mail.erledigt) return { ok: false, fehler: `Die E-Mail von ${name} ist schon bearbeitet.` };
  await erledigen(anfrageId, f.mail.id, { am: new Date().toISOString(), von, wie: "kenntnis" }, `E-Mail vom ${T.datumDe(f.mail.am)} zur Kenntnis genommen (ohne Einordnung)`);
  revalidatePath("/admin", "layout");
  return { ok: true, name };
}
