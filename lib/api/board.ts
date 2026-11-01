import "server-only";
import { revalidatePath } from "next/cache";
import { menueErneuern } from "@/lib/admin/menue";
import { LEAD_STATUS, MATCH_STATUS, formatGroesse, leadView, paarKey, type LeadStatus, type LeadView, type MatchMeta } from "@/lib/admin/model";
import { drosseln, jsonAendern, kurzwert, listLeads, mutateZustand, readZustand, verlaufLesen } from "@/lib/admin/store";
import { alleKunden } from "@/lib/portal/speicher";
import { stufe } from "@/lib/portal/model";
import { istOffen } from "@/lib/portal/postfach";
import type { Recht } from "./zugang";

// Lesen und sichere Einträge am Board der Verwaltung per API (Rechte: lib/api/zugang.ts).
// Nie dabei: Namen, E-Mail-Adressen, Telefonnummern, Anschriften, Kundenakten-Inhalte, Verträge.
// Nie möglich: Mails senden, einladen, Zustimmungen/Freigabe, Börse veröffentlichen, Löschen.

const ID = /^LL-[A-Z0-9]+$/;
const PAAR = /^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/;

const MAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g;
const TELEFON = /(?<![\w.])(?:\+\d{1,3}|0\d)[\d\s/().-]{6,}\d/g;
const DATUM = /^\d{1,2}\.\d{1,2}\.\d{2,4}$/;

/**
 * Freitext (Notizen, Verlauf, Ort, Flurstück) enthält gelegentlich Adressen oder Nummern — sie verlassen die
 * Verwaltung nicht per API. Bewusst nur „bestmöglich“: Namen und Straßen lassen sich in freiem Text nicht sicher
 * erkennen; deshalb gibt es Notizen, Nachricht und Verlauf nur mit dem eigenen Recht board:details.
 */
export function schwaerzen(text: string): string {
  return text
    .slice(0, 20_000)
    .replace(MAIL, "[E-Mail]")
    .replace(TELEFON, (m) => (DATUM.test(m.trim()) ? m : "[Telefon]"));
}

export type BoardZeile = {
  id: string;
  eingang: string;
  anliegen: string;
  rolle: string;
  art: string | null;
  typ: string;
  groesse: string;
  ort: string;
  flurstueck: string | null;
  status: LeadStatus;
  weg: string | null;
  boerse: { code: string; online: boolean } | null;
  suche: { code: string; online: boolean } | null;
  kunde: string;
  tri: string | null;
  rueckmeldung: { art: string; am: string } | null;
  postfachOffen: number;
  letzterKontakt: string | null;
  nachgefasstAm: string | null;
  quelle: string;
};

function zeile(l: LeadView, kunde: string): BoardZeile {
  const m = l.meta;
  const offeneMails = (m.postfach ?? []).filter(istOffen).length;
  return {
    id: l.id,
    eingang: l.receivedAt,
    anliegen: l.intent,
    rolle: l.rolle,
    art: l.art,
    typ: l.typ,
    groesse: formatGroesse(l.groesseWert),
    ort: schwaerzen(l.ortText),
    flurstueck: l.flurstueck === "—" ? null : schwaerzen(l.flurstueck),
    status: l.status,
    weg: m.weg ?? null,
    boerse: m.boerse ? { code: m.boerse.code, online: m.boerse.online } : null,
    suche: m.suche ? { code: m.suche.code, online: m.suche.online } : null,
    kunde,
    tri: m.triUebergabe?.triId ?? null,
    rueckmeldung: m.rueckmeldung && l.status === "neu" ? { art: m.rueckmeldung.art, am: m.rueckmeldung.am } : null,
    postfachOffen: offeneMails,
    letzterKontakt: m.letzterKontakt ?? null,
    nachgefasstAm: m.nachgefasstAm ?? null,
    quelle: l.source,
  };
}

export type PaarZeile = {
  key: string;
  angebot: string;
  gesuch: string;
  status: MatchMeta["status"];
  zustimmungAnbieter: string | null;
  zustimmungSuchender: string | null;
  ablehnung: { rolle: string; am: string } | null;
  notiz: string | null;
  geaendert: string | null;
};

export async function boardLesen(opt: { status?: "offen" | "alle"; paare?: "aktiv" | "alle"; anfrage?: string; details?: boolean }) {
  const [leads, { zustand }, kunden] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
  const akten = new Map(kunden.map((k) => [k.id, k]));
  const views = leads.map((l) => leadView(l, zustand.anfragen[l.id]));

  if (opt.anfrage) {
    const v = views.find((x) => x.id === opt.anfrage);
    if (!v) return null;
    const verlauf = opt.details ? await verlaufLesen(v.id, zustand.protokoll) : [];
    return {
      anfrage: {
        ...zeile(v, stufe(akten.get(v.id))),
        ...(opt.details ? { nachricht: v.message === "—" ? "" : schwaerzen(v.message).slice(0, 2000), notiz: schwaerzen(v.meta.notiz ?? "") || null } : {}),
      },
      paare: Object.entries(zustand.paare)
        .filter(([k]) => k.split("~").includes(v.id))
        .map(([k, p]) => paarZeile(k, p, Boolean(opt.details))),
      verlauf: verlauf.slice(0, 40).map((e) => ({ am: e.am, von: e.von.includes("@") ? "Verwaltung" : e.von, was: schwaerzen(e.was) })),
    };
  }

  const offen = (opt.status ?? "offen") === "offen";
  const zeilen = views
    .filter((l) => (offen ? l.status !== "archiv" && l.status !== "erledigt" : true))
    .map((l) => zeile(l, stufe(akten.get(l.id))));
  const paare = Object.entries(zustand.paare)
    .filter(([, p]) => (opt.paare ?? "aktiv") === "alle" || p.status !== "verworfen")
    .map(([k, p]) => paarZeile(k, p, false))
    .sort((a, b) => (b.geaendert ?? "").localeCompare(a.geaendert ?? ""));
  return {
    stand: new Date().toISOString(),
    anzahl: { anfragen: zeilen.length, paare: paare.length, rueckmeldungen: zeilen.filter((z) => z.rueckmeldung).length, postfachOffen: zeilen.reduce((n, z) => n + z.postfachOffen, 0) },
    anfragen: zeilen,
    paare,
  };
}

function paarZeile(key: string, p: MatchMeta, mitNotiz: boolean): PaarZeile {
  const [angebot, gesuch] = key.split("~");
  return {
    key,
    angebot,
    gesuch,
    status: p.status,
    zustimmungAnbieter: p.zustimmungAnbieter ?? null,
    zustimmungSuchender: p.zustimmungSuchender ?? null,
    ablehnung: p.ablehnung ? { rolle: p.ablehnung.rolle, am: p.ablehnung.am } : null,
    notiz: mitNotiz && p.notiz ? schwaerzen(p.notiz) : null,
    geaendert: p.geaendert?.am ?? null,
  };
}

// ---------------------------------------------------------------------------
// Einträge

export type BoardAktion =
  | { aktion: "notiz"; anfrage: string; text: string }
  | { aktion: "notiz"; paar: string; text: string }
  | { aktion: "status"; anfrage: string; status: LeadStatus }
  | { aktion: "paar"; angebot: string; gesuch: string; status: "vorgemerkt" | "verworfen" };

export type AktionErgebnis = { ok: true; text: string } | { ok: false; status: 400 | 403 | 404 | 409 | 422 | 429; fehler: string };

const istText = (x: unknown): x is string => typeof x === "string";

/**
 * Eingabe streng prüfen, bevor irgendein Recht oder Zustand angefasst wird: nur echte Texte in den erwarteten
 * Formen (ein Array oder Objekt, das „zufällig“ wie ein Text aussieht, wird abgewiesen).
 */
export function aktionPruefen(roh: unknown): { ok: true; aktion: BoardAktion } | { ok: false; fehler: string } {
  const nein = (fehler: string) => ({ ok: false as const, fehler });
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return nein("Kein gültiges JSON-Objekt.");
  const b = roh as Record<string, unknown>;
  if (b.aktion === "notiz") {
    if (!istText(b.text)) return nein("text muss ein Text sein.");
    const text = b.text.replace(/\s+/g, " ").trim().slice(0, 500);
    if (!text) return nein("Text fehlt.");
    if ((b.anfrage === undefined) === (b.paar === undefined)) return nein("Entweder anfrage (LL-…) oder paar (LL-…~LL-…) angeben.");
    if (b.paar !== undefined) return istText(b.paar) && PAAR.test(b.paar) ? { ok: true, aktion: { aktion: "notiz", paar: b.paar, text } } : nein("paar: LL-…~LL-… erwartet.");
    return istText(b.anfrage) && ID.test(b.anfrage) ? { ok: true, aktion: { aktion: "notiz", anfrage: b.anfrage, text } } : nein("anfrage: LL-… erwartet.");
  }
  if (b.aktion === "status") {
    if (!istText(b.anfrage) || !ID.test(b.anfrage)) return nein("anfrage: LL-… erwartet.");
    if (!istText(b.status) || !Object.hasOwn(LEAD_STATUS, b.status)) return nein("Status unbekannt (neu, in_arbeit, beantwortet, erledigt, archiv).");
    return { ok: true, aktion: { aktion: "status", anfrage: b.anfrage, status: b.status as LeadStatus } };
  }
  if (b.aktion === "paar") {
    if (!istText(b.angebot) || !ID.test(b.angebot) || !istText(b.gesuch) || !ID.test(b.gesuch)) return nein("angebot und gesuch: LL-… erwartet.");
    if (b.status !== "vorgemerkt" && b.status !== "verworfen") return nein("Status: vorgemerkt oder verworfen.");
    return { ok: true, aktion: { aktion: "paar", angebot: b.angebot, gesuch: b.gesuch, status: b.status } };
  }
  return nein("Aktion unbekannt (notiz, status, paar).");
}

/** Welches Recht eine geprüfte Aktion braucht. */
export function rechtFuer(a: BoardAktion): Recht {
  if (a.aktion === "notiz") return "board:notiz";
  if (a.aktion === "paar") return "board:paare";
  return a.status === "erledigt" || a.status === "archiv" ? "board:abschliessen" : "board:status";
}

export async function boardAktion(a: BoardAktion, von: string, zugangId: string): Promise<AktionErgebnis> {
  const wer = von.slice(0, 80);
  if (a.aktion === "notiz") {
    const ref = "paar" in a ? a.paar : a.anfrage;
    const { zustand } = await readZustand();
    const existiert = "paar" in a ? Boolean(zustand.paare[ref]) || (await paarMoeglich(ref)) : (await listLeads()).some((l) => l.id === ref);
    if (!existiert) return { ok: false, status: 404, fehler: "Nicht gefunden." };
    // Notizen dürfen das gekappte Protokoll nicht mit Masse verdrängen: je Zugang und je Anfrage nur wenige am Tag.
    const frei =
      (await drosseln("api-notiz", kurzwert(zugangId, "notiz"), [{ sekunden: 86_400, max: 40 }])) &&
      (await drosseln("api-notiz-ref", kurzwert(ref, "notiz"), [{ sekunden: 86_400, max: 10 }]));
    if (!frei) return { ok: false, status: 429, fehler: "Zu viele Notizen (je Zugang 40, je Anfrage 10 am Tag)." };
    await mutateZustand(wer, () => ({ was: `Notiz: ${a.text}`, ref }));
    await apiProtokoll(wer, "notiz", ref, a.text);
    return { ok: true, text: "Notiz im Verlauf eingetragen." };
  }

  if (a.aktion === "status") {
    const neu = a.status;
    const leads = await listLeads();
    if (!leads.some((l) => l.id === a.anfrage)) return { ok: false, status: 404, fehler: "Anfrage nicht gefunden." };
    const st: { fehler: AktionErgebnis | null; geaendert: boolean } = { fehler: null, geaendert: false };
    await mutateZustand(wer, (z) => {
      const meta = { ...(z.anfragen[a.anfrage] ?? {}) };
      if ((meta.status ?? "neu") === neu) return;
      if (geschlossen(meta.status) && !geschlossen(neu)) {
        st.fehler = { ok: false, status: 409, fehler: "Abgeschlossene Anfragen öffnet nur die Verwaltung wieder (sie kann ein Angebot zurück in die Börse bringen)." };
        return;
      }
      if (meta.loeschwunsch && !meta.loeschwunsch.erledigtAm) {
        st.fehler = { ok: false, status: 409, fehler: "Löschwunsch offen — nur in der Verwaltung." };
        return;
      }
      if (geschlossen(neu) && (meta.boerse?.online || meta.suche?.online)) {
        st.fehler = { ok: false, status: 409, fehler: "Angebot oder Suchauftrag ist in der Börse online — in der Verwaltung erledigen (nimmt es von der Website)." };
        return;
      }
      meta.status = neu;
      meta.geaendert = { am: new Date().toISOString(), von: wer };
      z.anfragen[a.anfrage] = meta;
      st.geaendert = true;
      return { was: `Status → ${LEAD_STATUS[neu].label}`, ref: a.anfrage };
    });
    if (st.fehler) return st.fehler;
    if (st.geaendert) {
      await apiProtokoll(wer, "status", a.anfrage, LEAD_STATUS[neu].label);
      erneuern();
    }
    return { ok: true, text: st.geaendert ? `Status → ${LEAD_STATUS[neu].label}` : "Status war schon so gesetzt." };
  }

  // Rest: a.aktion === "paar"
  const key = paarKey(a.angebot, a.gesuch);
  if (a.status === "vorgemerkt" && !(await paarMoeglich(key))) {
    return { ok: false, status: 422, fehler: "Passt nicht: Angebot und Gesuch müssen vorhanden, nicht archiviert und von gleicher Art (Kauf/Pacht) sein." };
  }
  const st: { fehler: AktionErgebnis | null; geaendert: boolean } = { fehler: null, geaendert: false };
  await mutateZustand(wer, (z) => {
    const alt = z.paare[key];
    if (alt?.status === "kontakt" || alt?.status === "abschluss") {
      st.fehler = { ok: false, status: 409, fehler: "Kontakt ist schon freigegeben — nur in der Verwaltung änderbar." };
      return;
    }
    if (a.status === "vorgemerkt" && alt && alt.status !== "vorschlag" && alt.status !== "verworfen") return; // schon weiter
    if (alt?.status === a.status) return;
    const meta: MatchMeta = { ...(alt ?? { status: "vorschlag" }), status: a.status };
    meta.geaendert = { am: new Date().toISOString(), von: wer };
    z.paare[key] = meta;
    st.geaendert = true;
    return { was: a.status === "vorgemerkt" ? "Paar vorgemerkt" : "Paar verworfen", ref: key };
  });
  if (st.fehler) return st.fehler;
  if (st.geaendert) {
    await apiProtokoll(wer, "paar", key, a.status);
    erneuern();
  }
  return { ok: true, text: st.geaendert ? `Paar ${MATCH_STATUS[a.status].label.toLowerCase()}.` : "Keine Änderung nötig." };
}

/** Beide Anfragen gibt es, sind nicht archiviert, Rolle passt, gleiche Art. */
async function paarMoeglich(key: string): Promise<boolean> {
  const [aId, gId] = key.split("~");
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const a = leads.find((l) => l.id === aId);
  const g = leads.find((l) => l.id === gId);
  if (!a || !g) return false;
  const av = leadView(a, zustand.anfragen[a.id]);
  const gv = leadView(g, zustand.anfragen[g.id]);
  return av.rolle === "angebot" && gv.rolle === "gesuch" && av.status !== "archiv" && gv.status !== "archiv" && av.art !== null && av.art === gv.art;
}

function erneuern(): void {
  revalidatePath("/admin", "layout");
  menueErneuern();
}

const geschlossen = (s: LeadStatus | undefined): boolean => s === "erledigt" || s === "archiv";

/**
 * Eigenes, nie gekürztes Protokoll aller Änderungen per API (eine Datei je Monat). Das Gesamtprotokoll und der Verlauf
 * je Anfrage sind in der Länge begrenzt und könnten durch Masse verdrängt werden — hier bleibt jede Änderung stehen.
 */
async function apiProtokoll(von: string, aktion: "notiz" | "status" | "paar", ref: string, was: string): Promise<void> {
  const am = new Date().toISOString();
  await jsonAendern<{ v: 1; eintraege: { am: string; von: string; aktion: string; ref: string; was: string }[] }>(
    `admin/api-protokoll/${am.slice(0, 7)}.json`,
    () => ({ v: 1, eintraege: [] }),
    (d) => {
      d.eintraege.push({ am, von, aktion, ref, was: was.slice(0, 200) });
    },
  );
}
