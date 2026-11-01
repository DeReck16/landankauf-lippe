import "server-only";
import { revalidatePath } from "next/cache";
import { menueErneuern } from "@/lib/admin/menue";
import { LEAD_STATUS, MATCH_STATUS, formatGroesse, leadView, paarKey, type LeadStatus, type LeadView, type MatchMeta } from "@/lib/admin/model";
import { listLeads, mutateZustand, readZustand, verlaufLesen } from "@/lib/admin/store";
import { alleKunden } from "@/lib/portal/speicher";
import { stufe } from "@/lib/portal/model";
import { istOffen } from "@/lib/portal/postfach";
import type { Recht } from "./zugang";

// Lesen und sichere Einträge am Board der Verwaltung per API (Rechte: lib/api/zugang.ts).
// Nie dabei: Namen, E-Mail-Adressen, Telefonnummern, Anschriften, Kundenakten-Inhalte, Verträge.
// Nie möglich: Mails senden, einladen, Zustimmungen/Freigabe, Börse veröffentlichen, Löschen.

const ID = /^LL-[A-Z0-9]+$/;

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
    ort: l.ortText,
    flurstueck: l.flurstueck === "—" ? null : l.flurstueck,
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
        ...(opt.details ? { nachricht: v.message === "—" ? "" : v.message.slice(0, 2000) } : {}),
        notiz: v.meta.notiz ?? null,
      },
      paare: Object.entries(zustand.paare)
        .filter(([k]) => k.split("~").includes(v.id))
        .map(([k, p]) => paarZeile(k, p)),
      verlauf: verlauf.slice(0, 40).map((e) => ({ am: e.am, von: e.von.includes("@") ? "Verwaltung" : e.von, was: e.was })),
    };
  }

  const offen = (opt.status ?? "offen") === "offen";
  const zeilen = views
    .filter((l) => (offen ? l.status !== "archiv" && l.status !== "erledigt" : true))
    .map((l) => zeile(l, stufe(akten.get(l.id))));
  const paare = Object.entries(zustand.paare)
    .filter(([, p]) => (opt.paare ?? "aktiv") === "alle" || p.status !== "verworfen")
    .map(([k, p]) => paarZeile(k, p))
    .sort((a, b) => (b.geaendert ?? "").localeCompare(a.geaendert ?? ""));
  return {
    stand: new Date().toISOString(),
    anzahl: { anfragen: zeilen.length, paare: paare.length, rueckmeldungen: zeilen.filter((z) => z.rueckmeldung).length, postfachOffen: zeilen.reduce((n, z) => n + z.postfachOffen, 0) },
    anfragen: zeilen,
    paare,
  };
}

function paarZeile(key: string, p: MatchMeta): PaarZeile {
  const [angebot, gesuch] = key.split("~");
  return {
    key,
    angebot,
    gesuch,
    status: p.status,
    zustimmungAnbieter: p.zustimmungAnbieter ?? null,
    zustimmungSuchender: p.zustimmungSuchender ?? null,
    ablehnung: p.ablehnung ? { rolle: p.ablehnung.rolle, am: p.ablehnung.am } : null,
    notiz: p.notiz ?? null,
    geaendert: p.geaendert?.am ?? null,
  };
}

// ---------------------------------------------------------------------------
// Einträge

export type BoardAktion =
  | { aktion: "notiz"; anfrage?: string; paar?: string; text: string }
  | { aktion: "status"; anfrage: string; status: string }
  | { aktion: "paar"; angebot: string; gesuch: string; status: string };

export type AktionErgebnis = { ok: true; text: string } | { ok: false; status: 400 | 403 | 404 | 409 | 422; fehler: string };

/** Welches Recht eine Aktion braucht (für die Prüfung vor dem Ausführen). */
export function rechtFuer(a: BoardAktion): Recht {
  if (a.aktion === "notiz") return "board:notiz";
  if (a.aktion === "paar") return "board:paare";
  return a.status === "erledigt" || a.status === "archiv" ? "board:abschliessen" : "board:status";
}

export async function boardAktion(a: BoardAktion, von: string): Promise<AktionErgebnis> {
  const wer = von.slice(0, 80);
  if (a.aktion === "notiz") {
    const text = String(a.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!text) return { ok: false, status: 400, fehler: "Text fehlt." };
    const ref = a.paar ?? a.anfrage ?? "";
    const gueltig = a.paar ? /^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/.test(ref) : ID.test(ref);
    if (!gueltig) return { ok: false, status: 400, fehler: "Anfrage (LL-…) oder Paar (LL-…~LL-…) angeben." };
    const { zustand } = await readZustand();
    const existiert = a.paar ? Boolean(zustand.paare[ref]) || (await paarMoeglich(ref)) : (await listLeads()).some((l) => l.id === ref);
    if (!existiert) return { ok: false, status: 404, fehler: "Nicht gefunden." };
    await mutateZustand(wer, () => ({ was: `Notiz: ${text}`, ref }));
    return { ok: true, text: "Notiz im Verlauf eingetragen." };
  }

  if (a.aktion === "status") {
    if (!ID.test(a.anfrage ?? "")) return { ok: false, status: 400, fehler: "Anfrage (LL-…) fehlt." };
    if (!(a.status in LEAD_STATUS)) return { ok: false, status: 400, fehler: "Status unbekannt (neu, in_arbeit, beantwortet, erledigt, archiv)." };
    const neu = a.status as LeadStatus;
    const leads = await listLeads();
    if (!leads.some((l) => l.id === a.anfrage)) return { ok: false, status: 404, fehler: "Anfrage nicht gefunden." };
    const st: { fehler: AktionErgebnis | null; geaendert: boolean } = { fehler: null, geaendert: false };
    await mutateZustand(wer, (z) => {
      const meta = { ...(z.anfragen[a.anfrage] ?? {}) };
      if ((meta.status ?? "neu") === neu) return;
      if (meta.loeschwunsch && !meta.loeschwunsch.erledigtAm) {
        st.fehler = { ok: false, status: 409, fehler: "Löschwunsch offen — nur in der Verwaltung." };
        return;
      }
      if ((neu === "erledigt" || neu === "archiv") && (meta.boerse?.online || meta.suche?.online)) {
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
    if (st.geaendert) erneuern();
    return { ok: true, text: st.geaendert ? `Status → ${LEAD_STATUS[neu].label}` : "Status war schon so gesetzt." };
  }

  if (a.aktion === "paar") {
    if (!ID.test(a.angebot ?? "") || !ID.test(a.gesuch ?? "")) return { ok: false, status: 400, fehler: "Angebot und Gesuch (LL-…) angeben." };
    if (a.status !== "vorgemerkt" && a.status !== "verworfen") return { ok: false, status: 400, fehler: "Status: vorgemerkt oder verworfen." };
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
      const meta: MatchMeta = { ...(alt ?? { status: "vorschlag" }), status: a.status as MatchMeta["status"] };
      meta.geaendert = { am: new Date().toISOString(), von: wer };
      z.paare[key] = meta;
      st.geaendert = true;
      return { was: a.status === "vorgemerkt" ? "Paar vorgemerkt" : "Paar verworfen", ref: key };
    });
    if (st.fehler) return st.fehler;
    if (st.geaendert) erneuern();
    return { ok: true, text: st.geaendert ? `Paar ${MATCH_STATUS[a.status as "vorgemerkt" | "verworfen"].label.toLowerCase()}.` : "Keine Änderung nötig." };
  }
  return { ok: false, status: 400, fehler: "Aktion unbekannt (notiz, status, paar)." };
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
