import "server-only";
import { boerseNeuSchreiben } from "@/lib/boerse";
import type { PostausgangEintrag } from "@/lib/portal/mail";
import * as M from "@/lib/portal/model";
import { mailKey } from "@/lib/portal/postfach";
import { aendereVorgang, indexEntfernen, ladeKunde, ladeVorgang, sperraktePfad } from "@/lib/portal/speicher";
import { ortKey, orteAusText } from "./geo";
import * as R from "./loeschen-regeln";
import type { GesperrtPosten, Grabstein, LeadMeta, LeadRecord, Zustand } from "./model";
import { dateienListen, dateienLoeschen, jsonAendern, jsonLesen, kurzwert, leadPfade, listLeads, mutateZustand, readZustand, type Verlauf } from "./store";

// „Vorgang endgültig löschen (DSGVO)“ (Dennis 27.09.2026: „ja“). Aus dem Löschwunsch-Vermerk
// (lib/admin/loeschwunsch.ts) wird echtes Löschen: Anfrage, Kundenakte, Dokumente, Mails, Tickets,
// Postfach-Einträge, Verlauf, Börsen-Angebot, E-Mail-Index und Kundenzugang — außer dem, was eine
// Aufbewahrungspflicht hat (unterschriebene Verträge, Nachweis, Provision; Regeln in
// lib/admin/loeschen-regeln.ts). Das wird nur gesperrt: Sperrakte portal/gesperrt/<LL-ID>.json bzw.
// Sperrvermerk im Vorgang, mit „gesperrt bis“ und Grund. Übrig bleibt ein Grabstein ohne Personendaten
// im Verwaltungszustand (zustand.geloescht) und ein Protokolleintrag ohne Personendaten.
//
// Ablauf in festen Schritten; jeder Schritt lässt sich wiederholen. Scheitert einer, steht der
// Grabstein auf „unvollständig“ und die Anfrage-Seite bietet „Erneut ausführen“ an — die dafür nötigen
// Kennungen (Name, Adressen) liegen bis zum Ende in admin/loeschung/<LL-ID>.json und werden dann gelöscht.

const ID = /^LL-[A-Z0-9]+$/;
const auftragPfad = (id: string) => `admin/loeschung/${id}.json`;
const kundePfad = (id: string) => `portal/kunden/${id}.json`;
const vorgangPfad = (key: string) => `portal/vorgaenge/${key}.json`;
const verlaufPfad = (id: string) => `admin/verlauf/${id}.json`;

/** Kategorien im Grabstein und in der Vorschau (feste Begriffe, keine Inhalte). */
export const UMFANG = {
  anfrage: "Anfrage mit allen Formularangaben (Name, Kontakt, Ort, Flurstück, Nachricht)",
  verwaltung: "Bearbeitungsstand, Notizen, Kataster- und Matching-Angaben der Verwaltung",
  tickets: "Rückmeldungen, Tickets und E-Mails aus dem Postfach",
  boerse: "Börsen-Angebot (offline und aus der öffentlichen Liste)",
  ankauf: "Angaben zum Direktankauf",
  kunde: "Kundenakte (Einladung, Angaben, freiwillige Angaben, Verlauf)",
  kundeTeil: "Kundenakte bis auf den Vertrag (Einladung, Angaben, freiwillige Angaben, Verlauf)",
  zugang: "Zugang zum Kundenbereich (Einladungs-, Anmelde- und Antwortlinks ungültig, Sitzungen beendet)",
  dokumente: "Hochgeladene Dateien und Dokumente",
  mails: "Gespeicherte E-Mails",
  entwuerfe: "E-Mail-Entwürfe (entstehen aus der Anfrage und entfallen mit ihr)",
  verlauf: "Einträge im Verlauf der Anfrage",
  vorgaenge: "Vorgänge ohne Vertrag (Vorschläge, anonyme Hinweise, Zustimmungen)",
  postausgang: "Mails im Postausgang",
  index: "Einträge im E-Mail-Index",
  geschwaerzt: "Geschwärzte Stellen in Protokollen und Verläufen (Personendaten)",
} as const;

/** Was außerhalb dieses Systems liegt und von Hand gelöscht werden muss. */
export const EXTERN: readonly string[] = [
  "Postfach info@tr-immobilien.com in Outlook: Anfrage-Benachrichtigung, Antworten des Kunden, Kopien (Bcc) gesendeter Mails",
  "Formspree: Kopie der Formular-Anfrage",
  "Resend: Versandprotokoll der Mails an den Kunden",
];

type Auftrag = {
  v: 1;
  id: string;
  von: string;
  gestartet: string;
  kennungen: R.Kennungen;
  emails: string[];
  ortTexte: string[];
  receivedAt: string | null;
  art: string;
  status: string;
  loeschwunsch?: { am: string; frist: string };
  postfachKeys: string[];
};

type VorgangLage = { key: string; v: M.VorgangRecord | null; einstufung: R.Einstufung; dateien: string[] };

type Lage = {
  id: string;
  lead: LeadRecord | null;
  zustand: Zustand;
  meta: LeadMeta | undefined;
  kunde: M.KundeRecord | null;
  kundeEinstufung: R.Einstufung;
  kundeDateien: string[];
  vorgaenge: VorgangLage[];
  auftrag: Auftrag | null;
  sperrakte: R.Sperrakte | null;
  ankaufBehalten: boolean;
  alleLeads: LeadRecord[];
  kennungen: R.Kennungen;
  emails: string[];
  receivedAt: string | null;
  grabstein: Grabstein | null;
  verlaufAnzahl: number;
};

export type PlanPunkt = { was: string; anzahl: number | null };

export type LoeschPlan = {
  id: string;
  /** Es gibt etwas zu löschen (Anfrage, Akte, Vorgang oder ein unvollständiger früherer Lauf). */
  vorhanden: boolean;
  /** Vorgänge in Abwicklung — solange nicht möglich. */
  blockiert: { ref: string; gruende: string[] }[];
  loeschen: PlanPunkt[];
  sperren: GesperrtPosten[];
  /** Wo Personendaten nur geschwärzt werden (Einträge, die auch andere betreffen). */
  schwaerzen: string[];
  hinweise: string[];
  /** Weitere Anfragen mit derselben E-Mail-Adresse (einzeln löschen). */
  weitere: string[];
  extern: readonly string[];
  grabstein: Grabstein | null;
};

export type LoeschErgebnis = { ok: true; grabstein: Grabstein } | { ok: false; gruende: string[] };

// ---------------------------------------------------------------------------
// Lage erfassen (nur lesen)

async function wennDa<T>(pfad: string, aendern: (d: T) => boolean): Promise<boolean> {
  if (!(await jsonLesen<T>(pfad))) return false;
  let geaendert = false;
  await jsonAendern<T>(pfad, () => null as unknown as T, (d) => {
    geaendert = false;
    if (!d) return false;
    geaendert = aendern(d);
    return geaendert ? undefined : false;
  });
  return geaendert;
}

function emailNorm(s: string | null | undefined): string | null {
  const e = (s ?? "").trim().toLowerCase();
  return e && e !== "—" && e.includes("@") ? e : null;
}

/** Namen und Anschriften dieser Partei aus den Verträgen eines Vorgangs (für das Schwärzen). */
function vertragsKennungen(v: M.VorgangRecord | null, rolle: M.Rolle): string[] {
  if (!v) return [];
  const pv = v.pachtvertrag;
  const kauf = v.kauf;
  if (rolle === "anbieter") {
    return [pv?.daten.verpaechter.name, pv?.daten.verpaechter.anschrift, pv?.daten.kontoinhaber, pv?.unterschriften.verpaechter?.name, kauf?.daten.verkaeufer.name, kauf?.daten.verkaeufer.anschrift, kauf?.bestaetigungen.verkaeufer?.name].filter((x): x is string => Boolean(x));
  }
  return [pv?.daten.paechter.name, pv?.daten.paechter.anschrift, pv?.daten.paechter.betrieb, pv?.unterschriften.paechter?.name, kauf?.daten.kaeufer.name, kauf?.daten.kaeufer.anschrift, kauf?.daten.kaeufer.betrieb, kauf?.bestaetigungen.kaeufer?.name].filter((x): x is string => Boolean(x));
}

async function lageErfassen(id: string): Promise<Lage> {
  const [alleLeads, { zustand }, kunde, auftragRoh, sperrakteRoh, vorgangPfade, kundeDateien, verlauf] = await Promise.all([
    listLeads(),
    readZustand(),
    ladeKunde(id),
    jsonLesen<Auftrag>(auftragPfad(id)),
    jsonLesen<R.Sperrakte>(sperraktePfad(id)),
    dateienListen("portal/vorgaenge/"),
    dateienListen(`portal/dokumente/kunde/${id}/`),
    jsonLesen<Verlauf>(verlaufPfad(id)),
  ]);
  const lead = alleLeads.find((l) => l.id === id) ?? null;
  const meta = zustand.anfragen[id];
  const auftrag = auftragRoh?.daten ?? null;
  const sperrakte = sperrakteRoh?.daten ?? null;

  const keys = new Set<string>();
  for (const p of vorgangPfade) {
    const key = p.replace(/^portal\/vorgaenge\//, "").replace(/\.json$/, "");
    if (key.split("~").includes(id)) keys.add(key);
  }
  for (const key of Object.keys(zustand.paare)) if (key.split("~").includes(id)) keys.add(key);
  const vorgaenge: VorgangLage[] = [];
  for (const key of [...keys].sort()) {
    const v = await ladeVorgang(key);
    // Schon gesperrt (z. B. weil die Gegenseite gelöscht wurde): bleibt gesperrt, wird nur ergänzt.
    const einstufung = R.vorgangEinstufen(v);
    vorgaenge.push({ key, v, einstufung, dateien: einstufung.wie === "loeschen" && v ? await dateienListen(`portal/dokumente/vorgang/${key}/`) : [] });
  }

  // Provisionsvereinbarung als Buchungsgrundlage: gebuchte Provision in einem Vorgang dieses Suchenden.
  const gebucht = vorgaenge
    .filter((x) => x.v && x.v.gesuchId === id)
    .flatMap((x) => x.v!.provisionen.filter((p) => p.status === "bezahlt" || p.rechnung))
    .flatMap((p) => [p.entstandenAm, p.rechnung?.datum, ...p.verlauf.map((x) => x.am)])
    .filter((x): x is string => Boolean(x))
    .sort();
  const kundeEinstufung = R.kundeEinstufen(kunde, gebucht.at(-1) ?? null);

  const ankaufBehalten = Boolean(meta?.weg === "ankauf" && meta.ankauf?.ergebnis?.wie === "gekauft");
  const kennungen = R.kennungenVereinen(
    R.kennungenSammeln({
      lead,
      kunde: kunde ?? sperrakte?.kunde ?? null,
      weitere: vorgaenge.flatMap((x) => vertragsKennungen(x.v, x.key.split("~")[0] === id ? "anbieter" : "suchender")),
    }),
    auftrag?.kennungen ?? { texte: [], telefone: [] },
  );
  const emails = [...new Set([emailNorm(lead?.email), emailNorm(kunde?.email), emailNorm(sperrakte?.kunde?.email), ...(auftrag?.emails ?? [])].filter((x): x is string => Boolean(x)))];
  return {
    id,
    lead,
    zustand,
    meta,
    kunde,
    kundeEinstufung,
    kundeDateien,
    vorgaenge,
    auftrag,
    sperrakte,
    ankaufBehalten,
    alleLeads,
    kennungen,
    emails,
    receivedAt: lead?.receivedAt ?? auftrag?.receivedAt ?? null,
    grabstein: zustand.geloescht?.[id] ?? null,
    verlaufAnzahl: verlauf?.daten.eintraege.length ?? 0,
  };
}

function postenKunde(l: Lage): GesperrtPosten | null {
  const e = l.kundeEinstufung;
  if (!l.kunde || e.wie !== "sperren") return null;
  const behalten = R.kundeFuerSperre(l.kunde);
  return { was: e.was, bis: e.bis, grund: e.grund, ort: "sperrakte", ref: l.id, dokumente: behalten.dokumente.map((d) => ({ id: d.id, titel: d.titel })) };
}

function postenAnkauf(l: Lage): GesperrtPosten | null {
  if (!l.ankaufBehalten || !l.meta?.ankauf?.ergebnis) return null;
  const ab = l.meta.ankauf.ergebnis.am;
  return {
    was: `Direktankauf durch die TR Vertriebs GmbH (gekauft am ${new Date(ab).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}): Angebot, Ergebnis und Korrespondenz`,
    bis: R.aufbewahrenBis(ab, "geschaeftsbrief"),
    grund: R.grundText("geschaeftsbrief", "Angebot und Korrespondenz eines geschlossenen Geschäfts"),
    ort: "sperrakte",
    ref: l.id,
    dokumente: [],
  };
}

function postenVorgaenge(l: Lage): GesperrtPosten[] {
  return l.vorgaenge
    .filter((x) => x.einstufung.wie === "sperren")
    .map((x) => {
      const e = x.einstufung as Extract<R.Einstufung, { wie: "sperren" }>;
      return { was: e.was, bis: e.bis, grund: e.grund, ort: "vorgang" as const, ref: x.key, dokumente: (x.v?.dokumente ?? []).map((d) => ({ id: d.id, titel: d.titel })) };
    });
}

function planAus(l: Lage): LoeschPlan {
  const blockiert = l.vorgaenge.filter((x) => x.einstufung.wie === "blockiert").map((x) => ({ ref: x.key, gruende: (x.einstufung as Extract<R.Einstufung, { wie: "blockiert" }>).gruende }));
  const loeschen: PlanPunkt[] = [];
  const dazu = (was: string, anzahl: number | null) => {
    if (anzahl === null || anzahl > 0) loeschen.push({ was, anzahl });
  };
  const m = l.meta;
  dazu(UMFANG.anfrage, l.lead ? 1 : 0);
  dazu(UMFANG.verwaltung, m ? 1 : 0);
  dazu(UMFANG.tickets, (m?.rueckmeldung ? 1 : 0) + (m?.postfach?.length ?? 0));
  dazu(UMFANG.boerse, m?.boerse ? 1 : 0);
  dazu(UMFANG.ankauf, m?.ankauf && !l.ankaufBehalten ? 1 : 0);
  if (l.kunde) {
    dazu(l.kundeEinstufung.wie === "sperren" ? UMFANG.kundeTeil : UMFANG.kunde, 1);
    dazu(UMFANG.zugang, 1);
  }
  const behalten = l.kunde && l.kundeEinstufung.wie === "sperren" ? R.kundeFuerSperre(l.kunde) : null;
  const bleibendePfade = new Set((behalten?.dokumente ?? []).map((d) => d.pfad));
  const geloeschteVorgaenge = l.vorgaenge.filter((x) => x.einstufung.wie === "loeschen");
  dazu(UMFANG.dokumente, l.kundeDateien.filter((p) => !bleibendePfade.has(p)).length + geloeschteVorgaenge.reduce((a, x) => a + x.dateien.length, 0));
  const emails = new Set(l.emails);
  const mailsVorgaenge = l.vorgaenge.reduce((a, x) => {
    if (!x.v) return a;
    if (x.einstufung.wie === "loeschen") return a + x.v.mails.length;
    return a + x.v.mails.filter((mm) => emails.has(mm.an.toLowerCase()) && !R.VORGANG_KORRESPONDENZ.includes(mm.zweck)).length;
  }, 0);
  dazu(UMFANG.mails, (l.kunde ? l.kunde.mails.length - (behalten?.mails.length ?? 0) : 0) + mailsVorgaenge);
  if (l.lead) dazu(UMFANG.entwuerfe, null);
  dazu(UMFANG.verlauf, Math.max(l.verlaufAnzahl, l.zustand.protokoll.filter((p) => p.ref === l.id).length));
  dazu(UMFANG.vorgaenge, geloeschteVorgaenge.length);
  const sperren = [postenKunde(l), postenAnkauf(l), ...postenVorgaenge(l)].filter((x): x is GesperrtPosten => Boolean(x));

  const schwaerzen = [
    "Protokoll der Verwaltung (Einträge, die auch andere betreffen)",
    ...(l.vorgaenge.length ? ["Verlauf der Gegenseite in gemeinsamen Vorgängen"] : []),
    "Automatik-Protokoll",
    "Meldungen an die Verwaltung im Postausgang",
  ];
  const hinweise: string[] = [];
  const k = l.kunde;
  if (k?.vertrag && !k.kuendigung && !k.widerruf) {
    hinweise.push("Der Vertrag ist weder gekündigt noch widerrufen. Mit dem Löschen endet die Zusammenarbeit; der Vertrag selbst bleibt nur gesperrt.");
  }
  if (sperren.some((p) => p.ort === "vorgang")) {
    hinweise.push("Gesperrte Vorgänge bleiben für die Aufbewahrung erhalten, erscheinen aber nirgends mehr zur Bearbeitung — auch nicht im Kundenbereich der Gegenseite. Deren eigene Akte bleibt unberührt.");
  }
  if (l.grabstein && l.grabstein.stand !== "fertig") hinweise.push("Ein früherer Lauf ist nicht fertig geworden — „Endgültig löschen“ setzt ihn fort.");
  const weitere = l.alleLeads
    .filter((x) => x.id !== l.id && l.emails.includes((x.email ?? "").trim().toLowerCase()))
    .map((x) => x.id);
  // Noch etwas zu tun? Gesperrte Vorgänge und gesperrte Vertrags-PDFs bleiben absichtlich — sie zählen nicht.
  const gesperrtePfade = new Set((l.sperrakte?.kunde?.dokumente ?? []).map((d) => d.pfad));
  const offeneVorgaenge = l.vorgaenge.filter((x) => x.einstufung.wie !== "sperren" || !x.v?.sperre?.parteien.includes(x.key.split("~")[0] === l.id ? "anbieter" : "suchender"));
  const vorhanden = Boolean(
    l.lead ||
      l.kunde ||
      l.meta ||
      offeneVorgaenge.length ||
      l.auftrag ||
      l.kundeDateien.some((p) => !gesperrtePfade.has(p) && !bleibendePfade.has(p)) ||
      (l.grabstein && l.grabstein.stand !== "fertig"),
  );
  return { id: l.id, vorhanden, blockiert, loeschen, sperren, schwaerzen, hinweise, weitere, extern: EXTERN, grabstein: l.grabstein };
}

/** Vorschau: was gelöscht, was nur gesperrt würde — und ob es gerade geht. Ändert nichts. */
export async function loeschPlan(id: string): Promise<LoeschPlan> {
  if (!ID.test(id)) throw new Error("Ungültige Vorgangsnummer");
  return planAus(await lageErfassen(id));
}

// ---------------------------------------------------------------------------
// Ausführen

function fehlerText(err: unknown): string {
  // Nur die Art des Fehlers — keine Inhalte (die könnten Personendaten enthalten).
  const t = err instanceof Error ? err.name || "Fehler" : "Fehler";
  const status = err instanceof Error ? /HTTP \d{3}/.exec(err.message)?.[0] : undefined;
  return status ? `${t} (${status})` : t;
}

function monatVon(iso: string | null): string {
  return iso && !Number.isNaN(Date.parse(iso)) ? iso.slice(0, 7) : "unbekannt";
}

function postenVereinen(a: GesperrtPosten[], b: GesperrtPosten[]): GesperrtPosten[] {
  const out = new Map<string, GesperrtPosten>();
  for (const p of [...a, ...b]) {
    const key = `${p.ort}|${p.ref}|${p.was}`;
    const alt = out.get(key);
    out.set(key, alt && alt.bis > p.bis ? alt : p);
  }
  return [...out.values()];
}

function protokollText(g: Grabstein): string {
  const umfang = g.umfang.map((u) => `${u.anzahl}× ${u.was.split(" (")[0]}`).join(", ");
  const sperre = g.gesperrt.length ? ` — nur gesperrt (Aufbewahrung): ${g.gesperrt.map((p) => `${p.ort === "vorgang" ? `Vorgang ${p.ref}` : "Vertrag"} bis ${p.bis.split("-").reverse().join(".")}`).join(", ")}` : "";
  return `Vorgang ${g.id} endgültig gelöscht (Art. 17 DSGVO)${g.stand === "fertig" ? "" : " — UNVOLLSTÄNDIG, erneut ausführen"}: ${umfang || "nichts mehr vorhanden"}${sperre}`;
}

/**
 * Vorgang endgültig löschen. Prüft vorher frisch (Plan); in Abwicklung befindliche Vorgänge verhindern das
 * Löschen. Wiederholbar: Ein zweiter Aufruf setzt einen unvollständigen Lauf fort.
 */
export async function vorgangLoeschen(id: string, von: string): Promise<LoeschErgebnis> {
  if (!ID.test(id)) return { ok: false, gruende: ["Ungültige Vorgangsnummer."] };
  const l = await lageErfassen(id);
  const plan = planAus(l);
  if (plan.blockiert.length) return { ok: false, gruende: plan.blockiert.flatMap((b) => b.gruende.map((g) => `Vorgang ${b.ref}: ${g}`)) };
  if (!plan.vorhanden) {
    return l.grabstein ? { ok: true, grabstein: l.grabstein } : { ok: false, gruende: ["Zu dieser Vorgangsnummer gibt es nichts (mehr) zu löschen."] };
  }

  const jetzt = new Date().toISOString();
  const fehler: string[] = [];
  const umfang = new Map<string, number>((l.grabstein?.umfang ?? []).map((u) => [u.was, u.anzahl]));
  const zaehle = (was: string, n: number) => {
    if (n > 0) umfang.set(was, (umfang.get(was) ?? 0) + n);
  };
  const schritt = async (name: string, f: () => Promise<void>) => {
    try {
      await f();
    } catch (err) {
      console.error(`[loeschen] ${id}: Schritt „${name}“ fehlgeschlagen`, err);
      fehler.push(`${name}: ${fehlerText(err)}`);
    }
  };
  const kennungen = l.kennungen;
  const emails = new Set(l.emails);
  const partner = [...new Set(l.vorgaenge.flatMap((x) => x.key.split("~")).filter((x) => x !== id))];
  const geloeschteKeys = new Set(l.vorgaenge.filter((x) => x.einstufung.wie === "loeschen").map((x) => x.key));
  const posten = postenVereinen(l.grabstein?.gesperrt ?? [], plan.sperren);
  const art = l.lead || l.meta ? R.artDerAnfrage(l.lead, l.meta) : (l.auftrag?.art ?? l.grabstein?.art ?? "Anfrage");
  const status = l.lead || l.meta ? R.statusDerAnfrage(l.meta, l.kunde ? M.STUFE_INFO[M.stufe(l.kunde)].label : null) : (l.auftrag?.status ?? l.grabstein?.status ?? "—");
  const loeschwunsch = l.meta?.loeschwunsch ? { am: l.meta.loeschwunsch.am, frist: l.meta.loeschwunsch.frist } : (l.auftrag?.loeschwunsch ?? l.grabstein?.loeschwunsch);
  const ortTexte = [...new Set([l.lead?.ort, l.meta?.ortMatching, ...(l.auftrag?.ortTexte ?? [])].filter((x): x is string => Boolean(x && x !== "—")))];
  const postfachKeys = [...new Set([...(l.meta?.postfach ?? []).map((p) => mailKey(p.id)), ...(l.auftrag?.postfachKeys ?? [])])];

  // 1. Auftrag: Kennungen für einen erneuten Lauf festhalten (wird am Ende gelöscht).
  const auftrag: Auftrag = {
    v: 1,
    id,
    von,
    gestartet: l.auftrag?.gestartet ?? jetzt,
    kennungen,
    emails: [...emails],
    ortTexte,
    receivedAt: l.receivedAt,
    art,
    status,
    ...(loeschwunsch ? { loeschwunsch } : {}),
    postfachKeys,
  };
  await jsonAendern<Auftrag>(auftragPfad(id), () => auftrag, (d) => {
    Object.assign(d, { ...auftrag, kennungen: R.kennungenVereinen(d.kennungen ?? { texte: [], telefone: [] }, kennungen) });
  });

  // 2. Anfrage-Datei (danach erscheint die Anfrage nirgends mehr und kein Ablauf greift mehr auf sie zu).
  await schritt("Anfrage", async () => {
    zaehle(UMFANG.anfrage, await dateienLoeschen(await leadPfade(id)));
  });

  // 3. Kundenakte: ohne Vertrag ganz löschen, sonst Vertrag in die Sperrakte und den Rest löschen.
  await schritt("Kundenakte", async () => {
    const k = l.kunde;
    const behalten = k && l.kundeEinstufung.wie === "sperren" ? R.kundeFuerSperre(k) : null;
    const ankauf =
      l.ankaufBehalten && l.lead && l.meta?.ankauf
        ? {
            anfrage: { receivedAt: l.lead.receivedAt, name: l.lead.name, email: l.lead.email, ort: l.lead.ort, flurstueck: l.lead.flurstueck, groesse: l.lead.groesse, flaechentyp: l.lead.flaechentyp },
            stand: l.meta.ankauf,
            mails: (k?.mails ?? []).filter((mm) => mm.zweck === "ankauf"),
          }
        : null;
    const eigenePosten = posten.filter((p) => p.ort === "sperrakte");
    if (behalten || ankauf || l.sperrakte) {
      const bis = eigenePosten.map((p) => p.bis).sort().at(-1) ?? l.sperrakte?.bis ?? "";
      await jsonAendern<R.Sperrakte>(
        sperraktePfad(id),
        () => ({ v: 1, id, seit: jetzt, von, bis, posten: eigenePosten }),
        (d) => {
          d.posten = postenVereinen(d.posten ?? [], eigenePosten);
          d.bis = d.posten.map((p) => p.bis).sort().at(-1) ?? d.bis;
          if (behalten) d.kunde = behalten;
          if (ankauf) d.ankauf = ankauf;
        },
      );
    }
    if (k) {
      const bleiben = new Set((behalten?.dokumente ?? []).map((d) => d.pfad));
      zaehle(UMFANG.dokumente, await dateienLoeschen(l.kundeDateien.filter((p) => !bleiben.has(p))));
      zaehle(UMFANG.mails, k.mails.length - (behalten?.mails.length ?? 0) - (ankauf?.mails.length ?? 0));
      await dateienLoeschen([kundePfad(id)]);
      zaehle(behalten ? UMFANG.kundeTeil : UMFANG.kunde, 1);
      zaehle(UMFANG.zugang, 1);
    } else if (l.kundeDateien.length) {
      // Verwaiste Dateien (z. B. aus einem abgebrochenen Lauf) — ohne die gesperrten.
      const bleiben = new Set((l.sperrakte?.kunde?.dokumente ?? []).map((d) => d.pfad));
      zaehle(UMFANG.dokumente, await dateienLoeschen(l.kundeDateien.filter((p) => !bleiben.has(p))));
    }
  });

  // 4. Vorgänge: ohne Vertrag löschen; mit Nachweis, Vertrag oder Provision sperren und um die Daten
  //    dieser Partei kürzen, die nicht dazugehören (Mails an sie, ihre Meldungen).
  for (const x of l.vorgaenge) {
    const rolle: M.Rolle = x.key.split("~")[0] === id ? "anbieter" : "suchender";
    if (x.einstufung.wie === "loeschen") {
      await schritt(`Vorgang ${x.key}`, async () => {
        if (x.v) {
          zaehle(UMFANG.dokumente, await dateienLoeschen(x.dateien));
          zaehle(UMFANG.mails, x.v.mails.length);
          await dateienLoeschen([vorgangPfad(x.key)]);
        }
        zaehle(UMFANG.vorgaenge, 1);
      });
    } else if (x.einstufung.wie === "sperren" && x.v) {
      const e = x.einstufung;
      await schritt(`Vorgang ${x.key}`, async () => {
        let mails = 0;
        let meldungen = 0;
        let geschwaerzt = 0;
        await aendereVorgang(x.key, x.v!.art, (v) => {
          const vorher = v.mails.length;
          v.mails = v.mails.filter((mm) => !emails.has(mm.an.toLowerCase()) || R.VORGANG_KORRESPONDENZ.includes(mm.zweck));
          mails = vorher - v.mails.length;
          const mv = v.meldungen.length;
          v.meldungen = v.meldungen.filter((mm) => mm.rolle !== rolle);
          meldungen = mv - v.meldungen.length;
          geschwaerzt = 0;
          for (const ev of v.ereignisse) {
            const t = R.schwaerzen(ev.text, kennungen);
            if (t !== ev.text) {
              ev.text = t;
              geschwaerzt++;
            }
          }
          const alt = v.sperre;
          v.sperre = {
            am: alt?.am ?? jetzt,
            von: alt?.von ?? von,
            bis: [alt?.bis ?? "", e.bis].sort().at(-1)!,
            grund: e.grund,
            parteien: [...new Set([...(alt?.parteien ?? []), rolle])],
          };
        });
        zaehle(UMFANG.mails, mails);
        zaehle(UMFANG.tickets, meldungen);
        zaehle(UMFANG.geschwaerzt, geschwaerzt);
      });
    }
  }

  // 5. Verwaltungszustand in einem Schritt: Anfrage raus, Paare, Protokoll, Orte, Grabstein (vorläufig).
  let protokollEntfernt = 0;
  await schritt("Verwaltungszustand", async () => {
    const andereOrte = new Set<string>();
    for (const x of l.alleLeads) {
      if (x.id === id) continue;
      for (const t of orteAusText((l.zustand.anfragen[x.id]?.ortMatching || (x.ort !== "—" ? x.ort : "")).trim())) andereOrte.add(ortKey(t));
    }
    const eigeneOrte = ortTexte.flatMap((t) => orteAusText(t)).map(ortKey).filter((k) => !andereOrte.has(k));
    let geschwaerzt = 0;
    let anfrageDa = false;
    await mutateZustand(von, (z) => {
      anfrageDa = Boolean(z.anfragen[id]);
      delete z.anfragen[id];
      for (const x of l.vorgaenge) {
        if (x.einstufung.wie === "loeschen") delete z.paare[x.key];
        else if (z.paare[x.key]) {
          // Gesperrter Vorgang: Stand bleibt, freie Notizen (können Personendaten enthalten) nicht.
          const mm = { ...z.paare[x.key] };
          delete mm.notiz;
          if (mm.ablehnung) {
            const ablehnung = { ...mm.ablehnung };
            delete ablehnung.grund;
            mm.ablehnung = ablehnung;
          }
          z.paare[x.key] = mm;
        }
      }
      protokollEntfernt = 0;
      geschwaerzt = 0;
      z.protokoll = z.protokoll
        .filter((p) => {
          if (p.ref !== id) return true;
          protokollEntfernt++;
          return false;
        })
        .map((p) => {
          const was = R.schwaerzen(p.was, kennungen);
          if (was === p.was) return p;
          geschwaerzt++;
          return { ...p, was };
        });
      for (const k of eigeneOrte) delete z.orte[k];
      z.geloescht = {
        ...(z.geloescht ?? {}),
        [id]: {
          id,
          monat: monatVon(l.receivedAt),
          art,
          status,
          geloeschtAm: jetzt,
          geloeschtVon: von,
          ...(loeschwunsch ? { loeschwunsch } : {}),
          umfang: [],
          gesperrt: posten,
          stand: "laeuft",
        },
      };
    });
    if (anfrageDa) {
      zaehle(UMFANG.verwaltung, 1);
      const m = l.meta;
      zaehle(UMFANG.tickets, (m?.rueckmeldung ? 1 : 0) + (m?.postfach?.length ?? 0));
      zaehle(UMFANG.boerse, m?.boerse ? 1 : 0);
      zaehle(UMFANG.ankauf, m?.ankauf && !l.ankaufBehalten ? 1 : 0);
    }
    zaehle(UMFANG.verlauf, protokollEntfernt);
    zaehle(UMFANG.geschwaerzt, geschwaerzt);
  });

  // 6. Verlauf: eigene Datei löschen, bei der Gegenseite gemeinsamer Vorgänge Personendaten schwärzen.
  await schritt("Verlauf", async () => {
    const eigen = await jsonLesen<Verlauf>(verlaufPfad(id));
    if (eigen) {
      // Einträge, die schon im Protokoll gezählt wurden, nicht doppelt zählen.
      zaehle(UMFANG.verlauf, Math.max(0, eigen.daten.eintraege.length - protokollEntfernt));
      await dateienLoeschen([verlaufPfad(id)]);
    }
    for (const andere of partner) {
      let n = 0;
      await wennDa<Verlauf>(verlaufPfad(andere), (d) => {
        n = 0;
        for (const e of d.eintraege) {
          const was = R.schwaerzen(e.was, kennungen);
          if (was !== e.was) {
            e.was = was;
            n++;
          }
        }
        return n > 0;
      });
      zaehle(UMFANG.geschwaerzt, n);
    }
  });

  // 7. Postausgang: Mails an die Person bzw. zu ihrer Akte löschen, Meldungen an die Verwaltung schwärzen.
  await schritt("Postausgang", async () => {
    for (const pfad of (await dateienListen("portal/postausgang/")).filter((p) => p.endsWith(".json"))) {
      const e = (await jsonLesen<PostausgangEintrag>(pfad))?.daten;
      if (!e) continue;
      const b = e.bezug;
      const hier = (b.typ === "kunde" && b.id === id) || (b.typ === "vorgang" && geloeschteKeys.has(b.key));
      if (hier || e.mail.an.some((a) => emails.has(a.toLowerCase()))) {
        zaehle(UMFANG.postausgang, await dateienLoeschen([pfad]));
        continue;
      }
      if (R.enthaeltKennung(`${e.mail.betreff}\n${e.mail.text}`, kennungen)) {
        await wennDa<PostausgangEintrag>(pfad, (d) => {
          d.mail.betreff = R.schwaerzen(d.mail.betreff, kennungen);
          d.mail.text = R.schwaerzen(d.mail.text, kennungen);
          return true;
        });
        zaehle(UMFANG.geschwaerzt, 1);
      }
    }
  });

  // 8. E-Mail-Index.
  await schritt("E-Mail-Index", async () => {
    for (const e of emails) if (await indexEntfernen(e, id)) zaehle(UMFANG.index, 1);
  });

  // 9. Zähler gegen Missbrauch (nur Kurzwerte, aber der Person zuzuordnen) und „gesehen“-Marker.
  await schritt("Zähler und Marker", async () => {
    await dateienLoeschen([
      ...[...emails].map((e) => `admin/drossel/bestaetigung/${kurzwert(e, "bestaetigung")}.json`),
      ...["widerruf", "kuendigung"].map((a) => `admin/drossel/erklaerung-${a}-vertrag/${kurzwert(id, "erklaerung-vertrag")}.json`),
    ]);
    const weg = (key: string) =>
      key.endsWith(`:${id}`) || [...geloeschteKeys].some((k) => key === `vorgang:${k}` || key === `paar:${k}`) || postfachKeys.some((p) => key === `postfach:${p}`);
    for (const pfad of (await dateienListen("admin/gesehen/")).filter((p) => p.endsWith(".json"))) {
      await wennDa<M.Gesehen>(pfad, (g) => {
        const keys = Object.keys(g.eintraege ?? {}).filter(weg);
        for (const key of keys) delete g.eintraege[key];
        return keys.length > 0;
      });
    }
  });

  // 10. Automatik-Protokoll seit Eingang der Anfrage: Personendaten schwärzen.
  await schritt("Automatik-Protokoll", async () => {
    const ab = (l.receivedAt ?? "2000-01-01").slice(0, 10);
    for (const pfad of await dateienListen("automatik/protokoll/")) {
      const tag = /\/(\d{4}-\d{2}-\d{2})\.json$/.exec(pfad)?.[1];
      if (!tag || tag < ab) continue;
      let n = 0;
      await wennDa<{ eintraege?: { text: string }[] }>(pfad, (d) => {
        n = 0;
        for (const e of d.eintraege ?? []) {
          const t = R.schwaerzen(e.text, kennungen);
          if (t !== e.text) {
            e.text = t;
            n++;
          }
        }
        return n > 0;
      });
      zaehle(UMFANG.geschwaerzt, n);
    }
  });

  // 11. Flächenbörse neu schreiben — das Angebot verschwindet aus der öffentlichen Datei.
  await schritt("Flächenbörse", async () => {
    await boerseNeuSchreiben();
  });

  // 12. Grabstein fertigstellen und Protokolleintrag (beides ohne Personendaten, ohne Bezug auf den gelöschten Verlauf).
  const reihenfolge = Object.values(UMFANG) as string[];
  const grabstein: Grabstein = {
    id,
    monat: monatVon(l.receivedAt),
    art,
    status,
    geloeschtAm: l.grabstein?.stand === "fertig" ? l.grabstein.geloeschtAm : jetzt,
    geloeschtVon: von,
    ...(loeschwunsch ? { loeschwunsch } : {}),
    umfang: [...umfang.entries()].map(([was, anzahl]) => ({ was, anzahl })).sort((a, b) => reihenfolge.indexOf(a.was) - reihenfolge.indexOf(b.was)),
    gesperrt: posten,
    stand: fehler.length ? "unvollstaendig" : "fertig",
    ...(fehler.length ? { fehler } : {}),
  };
  try {
    await mutateZustand(von, (z) => {
      z.geloescht = { ...(z.geloescht ?? {}), [id]: grabstein };
      return { was: protokollText(grabstein) };
    });
  } catch (err) {
    // Der vorläufige Grabstein („läuft“) und der Auftrag bleiben — die Seite bietet „Löschen fortsetzen“ an.
    console.error(`[loeschen] ${id}: Grabstein nicht gespeichert`, err);
    return { ok: true, grabstein: { ...grabstein, stand: "unvollstaendig", fehler: [...fehler, `Grabstein: ${fehlerText(err)}`] } };
  }

  // 13. Kennungen des Auftrags löschen — nur wenn alles geklappt hat (sonst braucht sie der nächste Lauf).
  if (!fehler.length) await dateienLoeschen([auftragPfad(id)]).catch((err) => console.error(`[loeschen] ${id}: Auftrag nicht gelöscht`, err));
  return { ok: true, grabstein };
}

/** Alle Grabsteine (neueste zuerst) — für die Übersicht in den Einstellungen. */
export function grabsteine(z: Zustand): Grabstein[] {
  return Object.values(z.geloescht ?? {}).sort((a, b) => b.geloeschtAm.localeCompare(a.geloeschtAm));
}

/** Sperrakte lesen (nur Verwaltung: gesperrte Dokumente herunterladen). */
export async function ladeSperrakte(id: string): Promise<R.Sperrakte | null> {
  if (!ID.test(id)) return null;
  return (await jsonLesen<R.Sperrakte>(sperraktePfad(id)))?.daten ?? null;
}
