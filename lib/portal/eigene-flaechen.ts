import "server-only";
import { formatGroesse, type Art, type BoerseMeta, type KatasterDaten, type LeadMeta, type LeadRecord } from "@/lib/admin/model";
import { dateiAnlegen, mutateZustand } from "@/lib/admin/store";
import { boerseNeuSchreiben, neuerBoerseCode } from "@/lib/boerse";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { anbieterAbgleichJetzt } from "./anbieter-gruppe";
import { bodenrichtwert, brwArtFuer, flurstueckAusText, flurstueckSuchen, type BrwTreffer, type FlurstueckTreffer } from "./kataster";

// Flächen selbst einstellen (Verwaltung → „Flächen einstellen“, Dennis 25.09.2026: eigene
// Wiesen und Waldstücke einzeln und anonym in die Flächenbörse). Je Zeile ein Flurstück;
// Größe, Nutzung und grobe Lage kommen aus dem Kataster NRW (lib/portal/kataster.ts).
// Jede Fläche wird eine eigene Anfrage (Angebot, Quelle „verwaltung“) mit erfasster
// Einwilligung des Eigentümers und geht als eigenes Angebot online — danach gilt der
// normale Ablauf (Interesse → Einladung → Vertrag → Zustimmung → Freigabe).

export type FlaechenZeile = {
  zeile: string;
  /** Öffentlicher Text dieser Fläche (Teil nach „|“ in der Zeile), sonst der gemeinsame Text. */
  text: string;
  fs: FlurstueckTreffer | null;
  brw: BrwTreffer | null;
  /** Vorschlag für den Flächentyp der Börse aus der amtlichen Nutzung. */
  typ: string;
  groesseHa: number | null;
  /** Grobe, öffentliche Lage („Horn-Bad Meinberg (Leopoldstal)“) — nie Flurstück oder Straße. */
  lage: string;
  fehler?: string;
};

/** Eine Zeile: „Leopoldstal, Flur 3, Flurstück 416 | optionaler Text“. */
function zerlegen(zeile: string): { ort: string; flurstueck: string; text: string } | null {
  const [links, ...rest] = zeile.split("|");
  const text = rest.join("|").trim();
  const m = /^(.*?)[,;]?\s*(flur\b.*|flurst.*|flst.*)$/i.exec(links.trim());
  if (!m) return null;
  return { ort: m[1].replace(/[,;]\s*$/, "").trim(), flurstueck: m[2].trim(), text };
}

function typAusNutzung(nutzung: string, standard: string): string {
  if (/wald|gehölz|forst/i.test(nutzung)) return "Wald / Forst";
  if (/wohnbau/i.test(nutzung)) return "Bauland";
  if (/landwirtschaft|acker|grünland/i.test(nutzung)) return standard;
  return "Sonstiges";
}

function grobeLage(fs: FlurstueckTreffer): string {
  return fs.gemarkung && fs.gemarkung !== fs.gemeinde && !fs.gemeinde.startsWith(fs.gemarkung) ? `${fs.gemeinde} (${fs.gemarkung})` : fs.gemeinde;
}

/** Zeilen prüfen: Flurstück im Kataster suchen, Typ, Größe und grobe Lage vorschlagen (parallel, ~5 s). */
export async function flaechenPruefen(roh: string, gemeinsamerText: string, standardTyp: string): Promise<FlaechenZeile[]> {
  const zeilen = roh
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter(Boolean)
    .slice(0, 20);
  const standard = (FLAECHENTYPEN as readonly string[]).includes(standardTyp) ? standardTyp : "Wiese / Grünland";
  return Promise.all(
    zeilen.map(async (zeile): Promise<FlaechenZeile> => {
      const leer: FlaechenZeile = { zeile, text: gemeinsamerText, fs: null, brw: null, typ: standard, groesseHa: null, lage: "" };
      const z = zerlegen(zeile);
      const angabe = z ? flurstueckAusText(z.flurstueck) : null;
      if (!z || !angabe || !z.ort) return { ...leer, fehler: "Nicht lesbar — Format: „Ort bzw. Gemarkung, Flur 3, Flurstück 416“." };
      const text = z.text || gemeinsamerText;
      const { treffer, grund } = await flurstueckSuchen(z.ort, angabe, 14_000);
      if (!treffer) return { ...leer, text, fehler: grund ?? "Nicht gefunden." };
      const typ = typAusNutzung(treffer.nutzung, standard);
      const brw = await bodenrichtwert(treffer.punkt, brwArtFuer(typ, treffer.nutzung), 5000);
      return {
        zeile,
        text,
        fs: treffer,
        brw: brw && brw !== "fehler" ? brw : null,
        typ,
        groesseHa: Math.round(treffer.flaecheM2 / 100) / 100,
        lage: grobeLage(treffer),
      };
    }),
  );
}

export type Einstellung = { zeile: string; typ: string; text: string };

export type EinstellErgebnis = { zeile: string; ok: boolean; code?: string; id?: string; eckdaten?: string; fehler?: string };

/**
 * Geprüfte Flächen einstellen: je Fläche eine Anfrage (Angebot) anlegen, Einwilligung des
 * Eigentümers vermerken und das Angebot anonym veröffentlichen. Das Kataster wird dabei neu
 * abgefragt (nichts aus dem Browser wird ungeprüft übernommen).
 */
export async function flaechenEinstellen(opts: {
  eintraege: Einstellung[];
  art: Art;
  eigentuemer: string;
  email: string;
  von: string;
}): Promise<EinstellErgebnis[]> {
  const { art, eigentuemer, email, von } = opts;
  const geprueft = await Promise.all(
    opts.eintraege.slice(0, 20).map(async (e) => {
      const [p] = await flaechenPruefen(e.zeile, e.text, e.typ);
      return { e, p };
    }),
  );
  const jetzt = new Date();
  const am = jetzt.toISOString();
  const tag = am.slice(0, 10);
  const ergebnisse: EinstellErgebnis[] = [];
  const neu: { id: string; p: FlaechenZeile; typ: string; text: string; kataster: KatasterDaten }[] = [];
  let n = 0;
  for (const { e, p } of geprueft) {
    if (!p?.fs || p.fehler) {
      ergebnisse.push({ zeile: e.zeile, ok: false, fehler: p?.fehler ?? "Nicht gefunden." });
      continue;
    }
    const typ = (FLAECHENTYPEN as readonly string[]).includes(e.typ) ? e.typ : p.typ;
    const text = e.text.replace(/\s+/g, " ").trim().slice(0, 400);
    const id = `LL-${(jetzt.getTime() + n++).toString(36).toUpperCase()}`;
    const fs = p.fs;
    const record: LeadRecord = {
      id,
      receivedAt: am,
      intent: art === "kauf" ? "Verkaufen" : "Verpachten",
      flaechentyp: typ,
      groesse: formatGroesse({ minHa: p.groesseHa, maxHa: p.groesseHa }),
      ort: p.lage,
      flurstueck: `${fs.gemarkung}, Flur ${fs.flur}, Flurstück ${fs.nummer}`,
      message: `Von der Verwaltung eingestellt (eigene Fläche). Eigentümer: ${eigentuemer}. Amtlich ${fs.flaecheM2.toLocaleString("de-DE")} m², ${fs.nutzung}${fs.lage ? `, Lage „${fs.lage}“` : ""}.`,
      name: eigentuemer,
      phone: "—",
      email,
      source: "verwaltung",
      consent: "on",
      gclid: "—",
      boerse: "—",
    };
    try {
      await dateiAnlegen(`leads/${tag}/${id}.json`, JSON.stringify(record, null, 2), "application/json");
      neu.push({
        id,
        p,
        typ,
        text,
        kataster: { am, schluessel: `${p.lage}|${record.flurstueck}`, flurstueck: fs, brw: p.brw },
      });
    } catch (err) {
      console.error("[flaechen] Anfrage nicht angelegt", e.zeile, err);
      ergebnisse.push({ zeile: e.zeile, ok: false, fehler: "Konnte nicht gespeichert werden." });
    }
  }
  if (neu.length) {
    // Im Callback gesammelt (bei Konflikten wird er erneut ausgeführt) — erst danach übernommen.
    let online: EinstellErgebnis[] = [];
    await mutateZustand(von, (z) => {
      online = [];
      const vorhanden = new Set(Object.values(z.anfragen).map((m) => m.boerse?.code).filter((c): c is string => Boolean(c)));
      const eintraege: string[] = [];
      for (const x of neu) {
        const code = neuerBoerseCode(vorhanden);
        vorhanden.add(code);
        const boerse: BoerseMeta = {
          code,
          typ: x.typ,
          groesseHa: x.p.groesseHa,
          lage: x.p.lage,
          text: x.text,
          einwilligung: { am: tag, quelle: "eigene Fläche (Verwaltung)", von },
          online: true,
          seit: am,
          geaendert: { am, von },
        };
        const meta: LeadMeta = {
          ...(z.anfragen[x.id] ?? {}),
          status: "in_arbeit",
          notiz: `Eigene Fläche — von der Verwaltung eingestellt (Eigentümer: ${eigentuemer}).`,
          boerse,
          kataster: x.kataster,
          geaendert: { am, von },
        };
        z.anfragen[x.id] = meta;
        // Eigener Eintrag je Anfrage, damit er in deren Verlauf steht.
        z.protokoll.unshift({ am, von, was: `Eigene Fläche eingestellt (${eigentuemer}) und anonym in der Flächenbörse veröffentlicht (${code})`, ref: x.id });
        eintraege.push(`${x.p.lage} ${x.p.groesseHa?.toLocaleString("de-DE")} ha → ${code}`);
        online.push({ zeile: x.p.zeile, ok: true, code, id: x.id, eckdaten: `${x.typ}, ${formatGroesse({ minHa: x.p.groesseHa, maxHa: x.p.groesseHa })}, ${x.p.lage}` });
      }
      return { was: `Eigene Flächen eingestellt und anonym veröffentlicht (${art === "kauf" ? "Kauf" : "Pacht"}): ${eintraege.join(" · ")}` };
    });
    ergebnisse.push(...online);
    await boerseNeuSchreiben();
    // Hat der Eigentümer die Vereinbarung schon über eine andere Fläche unterschrieben, gilt sie auch hier.
    await anbieterAbgleichJetzt(von);
  }
  return ergebnisse;
}
