import "server-only";
import { listLeads, readZustand } from "@/lib/admin/store";
import { leadView, type LeadView, type MatchStatus, type Zustand } from "@/lib/admin/model";
import { grobeLage } from "@/lib/admin/matching";
import * as M from "./model";
import { ladeEinstellungen, ladeKunde, ladeVorgang } from "./speicher";
import * as T from "./texte";
import { SICHTBAR } from "./vorgang";

// Was ein Kunde im Kundenbereich sehen darf — als schmale Datenobjekte.
// Vor der Freigabe nur anonyme Eckdaten der Gegenseite; Namen, Kontaktdaten
// und Flurstücke erst nach der Freigabe.

export type Kontakt = { name: string; betrieb: string; anschrift: string; telefon: string; email: string; flaechen: string[] };

export type KundenVorgang = {
  key: string;
  art: M.Art;
  status: MatchStatus;
  rolle: M.Rolle;
  gegenueberRolle: M.Rolle;
  anonym: { typ: string; groesse: string; lage: string; art: string };
  freigegeben: boolean;
  freigabeAm: string | null;
  kontakt: Kontakt | null;
  meineZustimmung: string | null;
  andereZustimmung: boolean;
  abgelehnt: boolean;
  pacht: { status: M.PachtvertragStand["status"]; meine: string | null; andere: boolean } | null;
  kauf: { status: M.KaufStand["status"]; meine: string | null; andere: boolean } | null;
  dokumente: M.DokumentMeta[];
  abschluss: M.VorgangRecord["abschluss"] | null;
  gutschein: M.Gutschein | null;
  danke: boolean;
};

export type KundenUebersicht = { kunde: M.KundeRecord; lead: LeadView | null; vorgaenge: KundenVorgang[] };

function istPartei(key: string, k: M.KundeRecord): boolean {
  const [a, g] = key.split("~");
  return k.rolle === "anbieter" ? a === k.id : g === k.id;
}

export async function kundenUebersicht(kunden: M.KundeRecord[], nurKey?: string): Promise<{ liste: KundenUebersicht[]; bewertungsUrl: string | null }> {
  const [leads, { zustand }, e] = await Promise.all([listLeads(), readZustand(), ladeEinstellungen()]);
  const byId = new Map(leads.map((l) => [l.id, l]));
  const bewertungsUrl = M.bewertungsUrl(e, process.env.GOOGLE_REVIEW_URL);
  const liste: KundenUebersicht[] = [];
  for (const k of kunden) {
    const roh = byId.get(k.id);
    const lead = roh ? leadView(roh, zustand.anfragen[k.id]) : null;
    const keys = Object.entries(zustand.paare)
      .filter(([key, m]) => istPartei(key, k) && SICHTBAR.includes(m.status) && (!nurKey || key === nurKey))
      .map(([key]) => key);
    const vorgaenge: KundenVorgang[] = [];
    for (const key of keys) {
      const v = await kundenVorgang(key, k, zustand, byId, bewertungsUrl);
      if (v) vorgaenge.push(v);
    }
    liste.push({ kunde: k, lead, vorgaenge });
  }
  return { liste, bewertungsUrl };
}

async function kundenVorgang(
  key: string,
  k: M.KundeRecord,
  zustand: Zustand,
  byId: Map<string, Parameters<typeof leadView>[0]>,
  bewertungsUrl: string | null,
): Promise<KundenVorgang | null> {
  const [aId, gId] = key.split("~");
  const meta = zustand.paare[key];
  const andereId = k.rolle === "anbieter" ? gId : aId;
  const roh = byId.get(andereId);
  if (!meta || !roh) return null;
  const andere = leadView(roh, zustand.anfragen[andereId]);
  const v = await ladeVorgang(key);
  const freigegeben = M.aktiveFreigabe(v) && (meta.status === "kontakt" || meta.status === "abschluss");
  let kontakt: Kontakt | null = null;
  if (freigegeben) {
    const gegen = await ladeKunde(andereId);
    const s = gegen?.stammdaten;
    kontakt = {
      name: s?.name || T.wert(andere.name),
      betrieb: s?.betrieb || "",
      anschrift: T.anschrift(s),
      telefon: s?.telefon || T.wert(andere.phone),
      email: gegen?.email || T.wert(andere.email),
      flaechen:
        k.rolle === "suchender"
          ? gegen?.flaechen?.length
            ? gegen.flaechen.map(T.flaecheZeile)
            : [[T.wert(andere.ort), T.wert(andere.flurstueck)].filter(Boolean).join(", ") || "Flurstücke bitte beim Eigentümer erfragen"]
          : [],
    };
  }
  const rolle = k.rolle;
  const pv = v?.pachtvertrag && v.pachtvertrag.status !== "entwurf" && v.pachtvertrag.status !== "verworfen" ? v.pachtvertrag : null;
  const kauf = v?.kauf && v.kauf.status !== "entwurf" ? v.kauf : null;
  const meinFeldPacht = rolle === "anbieter" ? "verpaechter" : "paechter";
  const anderesFeldPacht = rolle === "anbieter" ? "paechter" : "verpaechter";
  const meinFeldKauf = rolle === "anbieter" ? "verkaeufer" : "kaeufer";
  const anderesFeldKauf = rolle === "anbieter" ? "kaeufer" : "verkaeufer";
  return {
    key,
    art: v?.art ?? (andere.art === "kauf" ? "kauf" : "pacht"),
    status: meta.status,
    rolle,
    gegenueberRolle: rolle === "anbieter" ? "suchender" : "anbieter",
    anonym: T.anonymeEckdaten(andere, grobeLage(andere, zustand.orte)),
    freigegeben,
    freigabeAm: freigegeben ? v!.freigabe!.am : null,
    kontakt,
    meineZustimmung: (rolle === "anbieter" ? meta.zustimmungAnbieter : meta.zustimmungSuchender) ?? null,
    andereZustimmung: Boolean(rolle === "anbieter" ? meta.zustimmungSuchender : meta.zustimmungAnbieter),
    abgelehnt: meta.ablehnung?.rolle === rolle,
    pacht: pv ? { status: pv.status, meine: pv.unterschriften[meinFeldPacht]?.am ?? null, andere: Boolean(pv.unterschriften[anderesFeldPacht]) } : null,
    kauf: kauf ? { status: kauf.status, meine: kauf.bestaetigungen[meinFeldKauf]?.am ?? null, andere: Boolean(kauf.bestaetigungen[anderesFeldKauf]) } : null,
    dokumente: freigegeben ? (v?.dokumente ?? []).filter((d) => d.sichtbarFuer.includes(rolle)) : [],
    abschluss: v?.abschluss ?? null,
    gutschein: rolle === "suchender" && v?.gutschein && !v.gutschein.storniert ? v.gutschein : null,
    danke: Boolean(v?.abschluss && bewertungsUrl && !k.dankeGesehen?.[key]),
  };
}
