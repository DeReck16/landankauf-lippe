import "server-only";
import { revalidatePath } from "next/cache";
import { menueErneuern } from "@/lib/admin/menue";
import { LEAD_STATUS, MATCH_STATUS, formatGroesse, leadView, paarKey, type BoerseMeta, type LeadMeta, type LeadStatus, type LeadView, type MatchMeta } from "@/lib/admin/model";
import { BESTAETIGUNG_LIMIT_PRO_TAG, LINK_QUELLE, boerseNeuSchreiben, boerseVeroeffentlichen } from "@/lib/boerse";
import { DETAIL_FELDER, boerseLuecken, detailsBereinigen, type BoerseDetails } from "@/lib/boerse-regeln";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { drosseln, jsonAendern, kurzwert, listLeads, mutateZustand, readZustand, verlaufLesen } from "@/lib/admin/store";
import { alleKunden } from "@/lib/portal/speicher";
import { stufe } from "@/lib/portal/model";
import { istOffen } from "@/lib/portal/postfach";
import type { Recht } from "./zugang";

// Lesen und sichere Einträge am Board der Verwaltung per API (Rechte: lib/api/zugang.ts).
// Nie dabei: Namen, E-Mail-Adressen, Telefonnummern, Anschriften, Kundenakten-Inhalte, Verträge.
// Nie möglich: Mails senden, einladen, Zustimmungen/Freigabe/Einwilligung erteilen, Löschen. Börse: anonym online stellen nur mit Einwilligung des Eigentümers.

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
export function schwaerzen(text: string, eigene?: RegExp | null): string {
  let t = text.slice(0, 20_000);
  if (eigene) t = t.replace(eigene, "[entfernt]");
  return t.replace(MAIL, "[E-Mail]").replace(TELEFON, (m) => (DATUM.test(m.trim()) ? m : "[Telefon]"));
}

const TITEL = new Set(["herr", "frau", "dr", "prof", "und", "von", "van", "der", "den", "zu"]);

/** Name, Adresse und Nummer dieser einen Anfrage (und die Wörter des Namens), damit sie auch im Freitext nicht auftauchen. */
export function eigeneAngaben(v: Pick<LeadView, "name" | "email" | "phone">): RegExp | null {
  const teile = new Set<string>();
  for (const s of [v.name, v.email, v.phone]) if (s.trim().length >= 4 && s !== "—") teile.add(s.trim());
  for (const w of v.name.split(/[\s,;]+/)) {
    const wort = w.replace(/[^\p{L}-]/gu, "");
    if (wort.length >= 3 && !TITEL.has(wort.toLowerCase())) teile.add(wort);
  }
  if (teile.size === 0) return null;
  const muster = [...teile].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${muster.join("|")})(?![\\p{L}\\p{N}])`, "giu");
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

/** `leser`: Verlaufsname des fragenden Zugangs („API: <Name>“). */
export async function boardLesen(opt: { status?: "offen" | "alle"; paare?: "aktiv" | "alle"; anfrage?: string; details?: boolean; leser?: string }) {
  const [leads, { zustand }, kunden] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
  const akten = new Map(kunden.map((k) => [k.id, k]));
  const views = leads.map((l) => leadView(l, zustand.anfragen[l.id]));

  if (opt.anfrage) {
    const v = views.find((x) => x.id === opt.anfrage);
    if (!v) return null;
    const verlauf = opt.details ? await verlaufLesen(v.id, zustand.protokoll) : [];
    const eig = eigeneAngaben(v);
    return {
      anfrage: {
        ...zeile(v, stufe(akten.get(v.id))),
        ...(opt.details ? { nachricht: v.message === "—" ? "" : schwaerzen(v.message, eig).slice(0, 2000), notiz: schwaerzen(v.meta.notiz ?? "", eig) || null } : {}),
      },
      paare: Object.entries(zustand.paare)
        .filter(([k]) => k.split("~").includes(v.id))
        .map(([k, p]) => paarZeile(k, p, Boolean(opt.details) && eig)),
      // Den eigenen Notiztext sieht ein Zugang nur allgemein geschwärzt: Würde er anfragespezifisch geschwärzt, verriete
      // „[entfernt]“, ob ein geratener Name zur Anfrage gehört. Notizen anderer API-Zugänge zeigt das Board gar nicht (weder
      // geschwärzt noch offen): Sonst könnte ein zweiter Zugang das Orakel lesen oder fremde Namen weitergeben.
      verlauf: verlauf.slice(0, 40).map((e) => {
        const api = e.von.startsWith("API: ");
        const was = api && e.von !== opt.leser && e.was.startsWith("Notiz:") ? "Notiz eines anderen API-Zugangs (Text nur in der Verwaltung)" : schwaerzen(e.was, api && e.von === opt.leser ? null : eig);
        return { am: e.am, von: e.von.includes("@") ? "Verwaltung" : e.von, was };
      }),
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

function paarZeile(key: string, p: MatchMeta, notizEig: RegExp | null | false): PaarZeile {
  const [angebot, gesuch] = key.split("~");
  return {
    key,
    angebot,
    gesuch,
    status: p.status,
    zustimmungAnbieter: p.zustimmungAnbieter ?? null,
    zustimmungSuchender: p.zustimmungSuchender ?? null,
    ablehnung: p.ablehnung ? { rolle: p.ablehnung.rolle, am: p.ablehnung.am } : null,
    notiz: notizEig !== false && p.notiz ? schwaerzen(p.notiz, notizEig) : null,
    geaendert: p.geaendert?.am ?? null,
  };
}

// ---------------------------------------------------------------------------
// Einträge

export type BoardAktion =
  | { aktion: "notiz"; anfrage: string; text: string }
  | { aktion: "notiz"; paar: string; text: string }
  | { aktion: "status"; anfrage: string; status: LeadStatus }
  | { aktion: "paar"; angebot: string; gesuch: string; status: "vorgemerkt" | "verworfen" }
  | { aktion: "boerse"; anfrage: string; was: "offline" }
  | { aktion: "boerse"; anfrage: string; was: "veroeffentlichen" }
  | { aktion: "boerse"; anfrage: string; was: "aendern"; aenderung: BoerseAenderung }
  | { aktion: "knopf"; key: string; id: string; ziel: string; signatur: string; kauf: boolean }
  | { aktion: "weg"; anfrage: string; weg: "vermittlung" };

/** Öffentliche Angaben eines Börsen-Angebots, die per API geändert werden dürfen (alles andere nur in der Verwaltung). */
export type BoerseAenderung = { typ?: string; groesseHa?: number | null; lage?: string; text?: string; details?: Partial<Record<keyof BoerseDetails, string>> };

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
  if (b.aktion === "boerse") {
    if (!istText(b.anfrage) || !ID.test(b.anfrage)) return nein("anfrage: LL-… erwartet.");
    if (b.was === "offline") return { ok: true, aktion: { aktion: "boerse", anfrage: b.anfrage, was: "offline" } };
    if (b.was === "veroeffentlichen") return { ok: true, aktion: { aktion: "boerse", anfrage: b.anfrage, was: "veroeffentlichen" } };
    if (b.was !== "aendern") return nein("was: offline, veroeffentlichen oder aendern.");
    const a: BoerseAenderung = {};
    if (b.typ !== undefined) {
      if (!istText(b.typ) || !(FLAECHENTYPEN as readonly string[]).includes(b.typ)) return nein(`typ: ${FLAECHENTYPEN.join(", ")}.`);
      a.typ = b.typ;
    }
    if (b.groesseHa !== undefined) {
      if (b.groesseHa !== null && !(typeof b.groesseHa === "number" && Number.isFinite(b.groesseHa) && b.groesseHa > 0 && b.groesseHa <= 10_000)) return nein("groesseHa: Zahl größer 0 (Hektar) oder null.");
      a.groesseHa = b.groesseHa;
    }
    for (const [feld, max] of [["lage", 80], ["text", 300]] as const) {
      if (b[feld] === undefined) continue;
      const wert = b[feld];
      if (!istText(wert) || wert.length > max) return nein(`${feld}: Text bis ${max} Zeichen.`);
      if (/https?:|www\./i.test(wert)) return nein(`${feld}: keine Internetadressen.`);
      a[feld] = wert.replace(/\s+/g, " ").trim();
    }
    if (b.details !== undefined) {
      if (!b.details || typeof b.details !== "object" || Array.isArray(b.details)) return nein("details: Objekt erwartet.");
      const d: Partial<Record<keyof BoerseDetails, string>> = {};
      for (const [k, v] of Object.entries(b.details as Record<string, unknown>)) {
        const feld = DETAIL_FELDER.find((f) => f.key === k);
        if (!feld || !istText(v) || v.length > 80 || /https?:|www\./i.test(v)) return nein(`details.${k}: erlaubt sind ${DETAIL_FELDER.map((f) => f.key).join(", ")} mit Text bis 80 Zeichen, ohne Internetadressen.`);
        d[feld.key] = v;
      }
      a.details = d;
    }
    if (Object.keys(a).length === 0) return nein("Nichts zu ändern angegeben (typ, groesseHa, lage, text, details).");
    return { ok: true, aktion: { aktion: "boerse", anfrage: b.anfrage, was: "aendern", aenderung: a } };
  }
  if (b.aktion === "weg") {
    if (!istText(b.anfrage) || !ID.test(b.anfrage)) return nein("anfrage: LL-… erwartet.");
    if (b.weg !== "vermittlung") return nein("weg: nur „vermittlung“ per API — „Selbst kaufen“ (Börse, Preis) entscheidet nur die Verwaltung.");
    return { ok: true, aktion: { aktion: "weg", anfrage: b.anfrage, weg: "vermittlung" } };
  }
  if (b.aktion === "knopf") {
    if (!istText(b.key) || !PAAR.test(b.key)) return nein("key: LL-…~LL-… erwartet.");
    if (!istText(b.id) || !/^[a-z-]{3,30}$/.test(b.id)) return nein("id: Name des Knopfs (einladen, erinnern, hinweise, freigeben, …).");
    const ziel = b.ziel === undefined ? "" : b.ziel;
    if (!istText(ziel) || !/^[a-z0-9-]{0,40}$/.test(ziel)) return nein("ziel: kurzer Name oder leer.");
    if (!istText(b.signatur) || !/^[A-Za-z0-9_-]{8,64}$/.test(b.signatur)) return nein("signatur: aus der Antwort von GET ?vorgaenge=1 übernehmen.");
    if (b.kauf !== undefined && typeof b.kauf !== "boolean") return nein("kauf: true oder false.");
    return { ok: true, aktion: { aktion: "knopf", key: b.key, id: b.id, ziel, signatur: b.signatur, kauf: b.kauf === true } };
  }
  return nein("Aktion unbekannt (notiz, status, paar, boerse, knopf, weg).");
}

/** Welche Rechte eine geprüfte Aktion erlauben (eines davon genügt). Angebot offline nehmen darf auch, wer abschließen darf. */
export function rechteFuer(a: BoardAktion): Recht[] {
  if (a.aktion === "notiz") return ["board:notiz"];
  if (a.aktion === "paar") return ["board:paare"];
  if (a.aktion === "boerse") return a.was === "offline" ? ["board:boerse", "board:abschliessen"] : ["board:boerse"];
  if (a.aktion === "knopf" || a.aktion === "weg") return ["board:vorgang"];
  return [geschlossen(a.status) ? "board:abschliessen" : "board:status"];
}

export async function boardAktion(a: BoardAktion, von: string, zugangId: string): Promise<AktionErgebnis> {
  const wer = von.slice(0, 80);
  // Alle Änderungen je Zugang und Tag begrenzen (hält das Protokoll klein; der Zähler speichert höchstens 200 Zeitpunkte).
  if (!(await drosseln("api-schreiben", kurzwert(zugangId, "schreiben"), [{ sekunden: 86_400, max: 150 }]))) {
    return { ok: false, status: 429, fehler: "Zu viele Änderungen für heute (höchstens 150 je Zugang und Tag)." };
  }
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

  if (a.aktion === "weg") {
    const { wegVermitteln } = await import("./vorgaenge");
    const r = await wegVermitteln(a.anfrage, wer);
    if (r.ok && r.geaendert) {
      await apiProtokoll(wer, "weg", a.anfrage, "Weg → Vermitteln");
      erneuern();
    }
    return r.ergebnis;
  }
  if (a.aktion === "knopf") {
    // Eigenes Modul (Klick-Assistent); erst bei Bedarf geladen, weil es dieses hier für die Schwärzung braucht.
    const { knopfAusfuehren } = await import("./vorgaenge");
    const r = await knopfAusfuehren(a, wer, zugangId);
    if (r.ok) {
      await apiProtokoll(wer, "knopf", a.key, `${a.id}${a.ziel ? ` (${a.ziel})` : ""}${a.kauf ? " [kauf:true]" : ""}`);
      erneuern();
    }
    return r;
  }
  if (a.aktion === "boerse") return a.was === "veroeffentlichen" ? boerseOnline(a.anfrage, wer) : boerseAendern(a, wer);

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
 * Eigenes, nie gekürztes Protokoll aller Änderungen per API (eine Datei je Tag). Das Gesamtprotokoll und der Verlauf
 * je Anfrage sind in der Länge begrenzt und könnten durch Masse verdrängt werden — hier bleibt jede Änderung stehen.
 */
async function apiProtokoll(von: string, aktion: "notiz" | "status" | "paar" | "boerse" | "knopf" | "weg", ref: string, was: string): Promise<void> {
  const am = new Date().toISOString();
  await jsonAendern<{ v: 1; eintraege: { am: string; von: string; aktion: string; ref: string; was: string }[] }>(
    `admin/api-protokoll/${am.slice(0, 10)}.json`,
    () => ({ v: 1, eintraege: [] }),
    (d) => {
      d.eintraege.push({ am, von, aktion, ref, was: was.slice(0, 200) });
    },
  );
}

/** Alles, was den Eigentümer erkennbar machen würde, steht unter einem Satz: keine Auskunft, ob gerade ein Name, eine Flur oder eine Nummer angeschlagen hat. */
function luckenFuerApi(luecken: string[]): string[] {
  const rest = luecken.filter((x) => !x.startsWith("Lage oder Text enthält "));
  return rest.length < luecken.length ? [...rest, "Lage oder Text enthält Angaben, die den Eigentümer erkennen lassen (Name, Adresse, Flur, Nummer)"] : rest;
}

/**
 * Angebot anonym online stellen — mit denselben Prüfungen wie in der Verwaltung (`boerseVeroeffentlichen`): Einwilligung des
 * Eigentümers (Bestätigungslink oder Verwaltung; per API nie erteilbar), keine Namen/Adressen/Flur im Text, keine vergebene Fläche und
 * kein Widerruf/Kündigung/Sperre des Eigentümers (`sperrGrund`), und nie ein Angebot, das offline genommen wurde (das öffnet nur die Verwaltung).
 */
async function boerseOnline(anfrage: string, wer: string): Promise<AktionErgebnis> {
  // Schutz vor Massen-Einträgen wie beim Bestätigungslink: Einwilligungen per Link gehen höchstens BESTAETIGUNG_LIMIT_PRO_TAG je Tag allein
  // online (gemeinsamer Zähler); darüber stellt sie nur die Verwaltung online. Gezählt wird nur, was sonst wirklich online ginge.
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const lead = leads.find((l) => l.id === anfrage);
  const meta = zustand.anfragen[anfrage];
  const b = meta?.boerse;
  let linkPlatz = false;
  if (lead && b?.einwilligung?.quelle === LINK_QUELLE && !b.online && !b.offline && boerseLuecken(b, leadView(lead, meta)).length === 0) {
    linkPlatz = await drosseln("boerse-bestaetigung", "alle", [{ sekunden: 86_400, max: BESTAETIGUNG_LIMIT_PRO_TAG }]);
    if (!linkPlatz) return { ok: false, status: 429, fehler: `Heute sind schon ${BESTAETIGUNG_LIMIT_PRO_TAG} Einwilligungen per Bestätigungslink allein online gegangen. Weitere stellt die Verwaltung online (Schutz vor Massen-Einträgen).` };
  }
  // Der Platz ist vorab reserviert; kam die Einwilligung per Link erst nach dem Lesen oben, lehnt die Veröffentlichung selbst ab (ohne Platz).
  const r = await boerseVeroeffentlichen(anfrage, wer, "per API nach Einwilligung", { linkErlaubt: linkPlatz });
  if (r.ok) {
    await apiProtokoll(wer, "boerse", anfrage, `Veröffentlicht (${r.code})`);
    erneuern();
    return { ok: true, text: `Angebot ist online (${r.code}) — anonym, ohne Namen und Adresse.` };
  }
  if (r.grund === "Anfrage nicht gefunden") return { ok: false, status: 404, fehler: "Anfrage nicht gefunden." };
  if (r.grund === "schon online") return { ok: true, text: "Angebot war schon online." };
  if (r.grund === "keine Einwilligung") return { ok: false, status: 409, fehler: "Nicht veröffentlicht: Der Eigentümer hat der anonymen Veröffentlichung noch nicht zugestimmt (Bestätigungslink aus dem Formular). Die Einwilligung erfasst nur die Verwaltung." };
  if (r.luecken?.length) return { ok: false, status: 422, fehler: `Nicht veröffentlicht: ${luckenFuerApi(r.luecken).join(" · ")}.` };
  return { ok: false, status: 409, fehler: `Nicht veröffentlicht: ${r.grund ?? "unbekannter Grund"}.` };
}

async function boerseAendern(a: Extract<BoardAktion, { aktion: "boerse"; was: "offline" | "aendern" }>, wer: string): Promise<AktionErgebnis> {
  const lead = (await listLeads()).find((l) => l.id === a.anfrage);
  if (!lead) return { ok: false, status: 404, fehler: "Anfrage nicht gefunden." };
  const st: { fehler: AktionErgebnis | null; was: string; oeffentlich: boolean } = { fehler: null, was: "", oeffentlich: false };
  await mutateZustand(wer, (z) => {
    st.fehler = null;
    st.was = "";
    st.oeffentlich = false;
    const meta: LeadMeta = { ...(z.anfragen[a.anfrage] ?? {}) };
    if (!meta.boerse) {
      st.fehler = { ok: false, status: 409, fehler: "Zu dieser Anfrage gibt es kein Börsen-Angebot." };
      return;
    }
    const b: BoerseMeta = { ...meta.boerse };
    if (a.was === "offline") {
      if (!b.online && b.offline) return;
      // Wie in der Verwaltung: von Hand offline genommen bleibt offline, bis die Verwaltung neu veröffentlicht (auch die Automatik
      // rührt es nicht an). Steht ein Angebot ohne diese Markierung schon offline, wird sie nachgetragen.
      st.oeffentlich = b.online;
      st.was = b.online ? `Aus der Flächenbörse genommen (${b.code})` : `Offline-Markierung gesetzt (${b.code})`;
      b.online = false;
      b.offline = { am: new Date().toISOString(), grund: `per API offline genommen (${wer})` };
    } else {
      const neu = a.aenderung;
      if (neu.typ !== undefined) b.typ = neu.typ;
      if (neu.groesseHa !== undefined) b.groesseHa = neu.groesseHa;
      if (neu.lage !== undefined) b.lage = neu.lage;
      if (neu.text !== undefined) b.text = neu.text;
      if (neu.details !== undefined) {
        const gemischt: BoerseDetails = { ...b.details };
        for (const [k, v] of Object.entries(neu.details) as [keyof BoerseDetails, string][]) gemischt[k] = v;
        const bereinigt = detailsBereinigen(gemischt);
        if (bereinigt) b.details = bereinigt;
        else delete b.details;
      }
      // Steht das Angebot online, darf eine Änderung nichts Verräterisches (Name, Flur, Adresse, Nummer) öffentlich machen.
      if (b.online) {
        const offen = boerseLuecken(b, leadView(lead, { ...meta, boerse: b }));
        if (offen.length) {
          st.fehler = { ok: false, status: 422, fehler: `Nicht gespeichert — das Angebot steht online, und so dürfte es nicht erscheinen: ${luckenFuerApi(offen).join(" · ")}.` };
          return;
        }
      }
      st.oeffentlich = b.online;
      st.was = `Angaben für die Flächenbörse geändert (${b.code})`;
    }
    b.geaendert = { am: new Date().toISOString(), von: wer };
    meta.boerse = b;
    z.anfragen[a.anfrage] = meta;
    return { was: st.was, ref: a.anfrage };
  });
  if (st.fehler) return st.fehler;
  if (!st.was) return { ok: true, text: "Keine Änderung nötig (Angebot war schon offline)." };
  if (st.oeffentlich) await boerseNeuSchreiben();
  await apiProtokoll(wer, "boerse", a.anfrage, st.was);
  erneuern();
  return { ok: true, text: st.was };
}
