import "server-only";
import { formatGroesse, type KatasterDaten, type LeadView, type Rueckmeldung } from "@/lib/admin/model";
import { CITIES, type City } from "@/lib/cities";
import { valuate, type FlaechenTyp } from "@/lib/valuation";
import { GRUSS } from "./ablauf";
import type { AntwortEntwurf, AntwortThema } from "./anfrage-typen";
import { anfrageBezug, antwortLink } from "./entwuerfe";
import type * as M from "./model";
import { antwortGruppe, antwortOptionen, type RueckmeldungArt } from "./rueckmeldung-typen";
import * as T from "./texte";

// Antwortentwurf zur Freigabe (Dashboard „Zur Freigabe“, Dennis 25.09.2026: „die
// Anfrage analysieren und das Antwortschreiben so formulieren, dass ich nur
// freigeben muss“). Gelesen werden Anliegen, Flächentyp, Größe, Ort und Nachricht;
// bei Bewertungen rechnet der Entwurf die Wertindikation mit lib/valuation.ts —
// dieselbe Rechnung wie das Bewertungstool der Website (Grundstücksmarktbericht
// Kreis Lippe 2026). Aussagen zu Solar/Wind, VNS und Lohnunternehmern stammen aus
// den Leistungsbeschreibungen der Website (lib/site.ts). Keine Steuer- oder
// Rechtsberatung, keine Telefonnummer. Gesendet wird nur per Klick der Verwaltung
// (app/admin/assistent-actions.ts antwortSendenAktion).

const THEMA_NAME: Record<AntwortThema, string> = {
  bewertung: "Bewertung",
  verkauf: "Verkauf",
  verpachtung: "Verpachtung",
  vergleich: "Verkauf oder Verpachtung",
  energie: "Energiepacht (Solar/Wind)",
  vns: "VNS / Ökopunkte",
  bauland: "Bauland",
  wald: "Wald und Forst",
  lohnunternehmer: "Lohnunternehmer",
  allgemein: "Allgemeine Anfrage",
};

const NACH_ANLIEGEN: Record<string, AntwortThema> = {
  Bewertung: "bewertung",
  "Energiepacht (Solar/Wind)": "energie",
  "VNS / Ökopunkte": "vns",
  "Bauland-Beratung": "bauland",
  Lohnunternehmer: "lohnunternehmer",
  Verkaufen: "verkauf",
  Verpachten: "verpachtung",
};

const NACH_BERATUNGSTHEMA: Record<string, AntwortThema> = {
  "Wert meiner Fläche (Bewertung)": "bewertung",
  "Verkaufen oder verpachten – was passt besser?": "vergleich",
  "Energiepacht (Solar/Wind)": "energie",
  "Vertragsnaturschutz / Ökopunkte": "vns",
  "Bauland / Bebauung": "bauland",
  "Wald und Forst": "wald",
  "Bewirtschaftung / Lohnunternehmer": "lohnunternehmer",
};

/** Stichworte der freien Nachricht — nur, wenn das Anliegen im Formular nichts Genaueres sagt („Allgemein“). Reihenfolge = Vorrang. */
const STICHWORTE: [RegExp, AntwortThema][] = [
  [/verkauf|veräußer/i, "verkauf"],
  [/\bwert\b|bewert|was .{0,30}(bringt|wert)/i, "bewertung"],
  [/\bverpachten\b|zu verpachten|zur pacht (geben|anbieten)/i, "verpachtung"],
  [/solar|photovoltaik|\bpv\b|windkraft|windrad|windenergie/i, "energie"],
  [/ökopunkt|oekopunkt|vertragsnaturschutz|\bvns\b|ausgleichsfläche|ökokonto/i, "vns"],
  [/bauland|bebau|baugrund|bauplatz/i, "bauland"],
  [/lohnunternehm|\bmähen\b|\bmahd\b|heckenpflege/i, "lohnunternehmer"],
];

const VERPACHTET = /verpachtet|pächter|pachtvertrag/i;
/** Hinweise auf Belastungen im Boden — dann nie nur den Bodenrichtwert nennen. */
const ALTLAST = /altlast|kontamin|belastet|belastung|kampfmittel|sprengplatz|bodenverunreinig|verdachtsfläche/i;

/** Flächentyp aus der Nachricht, wenn das Formular „Sonstiges“ sagt („Spargelfeld“ → Acker). */
const TYP_STICHWORTE: [RegExp, FlaechenTyp][] = [
  [/spargel|acker|getreide|\bmais|weizen|gerste|roggen|raps|kartoffel|rüben|gemüse|erdbeer/i, "ackerland"],
  [/wiese|grünland|weide|\bheu\b|mähwiese/i, "gruenland"],
  [/\bwald\b|forst|holzbestand|fichte|buche|eiche|aufforst/i, "wald"],
  [/bauland|bauplatz|baugrund|bebaubar/i, "bauland"],
];

const TYP_NAME: Record<FlaechenTyp, string> = { ackerland: "Ackerland", gruenland: "Grünland", wald: "Wald", bauland: "Bauland" };

function wertTyp(flaechentyp: string): FlaechenTyp | null {
  if (flaechentyp === "Ackerland") return "ackerland";
  if (flaechentyp === "Wiese / Grünland") return "gruenland";
  if (flaechentyp === "Wald / Forst") return "wald";
  if (flaechentyp === "Bauland") return "bauland";
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

const ALIAS: [RegExp, string][] = [
  [/(^|[^a-z])bad meinberg([^a-z]|$)/, "horn-bad-meinberg"],
  [/(^|[^a-z])horn([^a-z]|$)/, "horn-bad-meinberg"],
  [/(^|[^a-z])(schieder|schwalenberg)([^a-z]|$)/, "schieder-schwalenberg"],
  [/(^|[^a-z])salzuflen([^a-z]|$)/, "bad-salzuflen"],
];

/** Lipper Gemeinde im Ortstext — ganze Wörter („Hanglage“ ist nicht Lage), längste Namen zuerst. */
function gemeindeAus(ort: string): City | null {
  const o = norm(ort);
  if (!o) return null;
  for (const c of [...CITIES].sort((a, b) => b.name.length - a.name.length)) {
    const n = norm(c.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(o)) return c;
  }
  for (const [re, slug] of ALIAS) if (re.test(o)) return CITIES.find((c) => c.slug === slug) ?? null;
  return null;
}

const euro2 = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euroRund = (n: number) => (Math.round(n / 1000) * 1000).toLocaleString("de-DE");
const qm = (ha: number) => Math.round(ha * 10_000).toLocaleString("de-DE");

type Wert = { satz: string; kurz: string; hint: string | null };

/** Wertindikation wie im Bewertungstool; Bauland nach dem Bodenrichtwert der Gemeinde (mittlere Lage). */
function wertindikation(typ: FlaechenTyp, ha: number | null, city: City | null): Wert | null {
  if (typ === "bauland") {
    if (!city) return null;
    const w = city.baulandMittlereLage;
    const gesamt = ha != null && ha > 0 && ha <= 1 ? ` Für Ihre rund ${qm(ha)} m² wären das bei mittlerer Lage etwa ${euroRund(w * ha * 10_000)} €.` : "";
    return {
      satz: `Wohnbauland in mittlerer Lage liegt ${city.display} laut Grundstücksmarktbericht Kreis Lippe 2026 bei rund ${w} € je m² (Bodenrichtwert).${gesamt}`,
      kurz: `Bauland mittlere Lage ${city.name}: ${w} €/m²${gesamt ? ` · ≈ ${euroRund(w * ha! * 10_000)} €` : ""}`,
      hint: null,
    };
  }
  if (ha == null || ha <= 0) return null;
  const r = valuate({ typ, groesseHa: ha, gemeinde: city?.name.toLowerCase() });
  const [a, b] = r.perM2Range;
  const qmZahl = ha * 10_000;
  return {
    satz: `${TYP_NAME[typ]} ${city ? city.display : "im Kreis Lippe"} liegt nach unserer Auswertung des Grundstücksmarktberichts Kreis Lippe 2026 derzeit bei etwa ${euro2(a)} bis ${euro2(b)} € je m². Für Ihre rund ${qm(ha)} m² ergibt das grob ${euroRund(a * qmZahl)} bis ${euroRund(b * qmZahl)} €.`,
    kurz: `${euro2(a)}–${euro2(b)} €/m² · ${euroRund(a * qmZahl)}–${euroRund(b * qmZahl)} €`,
    hint: r.hint,
  };
}

const datumTag = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

/** Wertindikation aus dem amtlichen Bodenrichtwert am Flurstück (BORIS NRW) — genauer als der Kreisdurchschnitt. */
function wertAusBrw(k: KatasterDaten): Wert | null {
  const f = k.flurstueck;
  const b = k.brw;
  if (!f || !b || !f.flaecheM2) return null;
  const ga = b.gutachterausschuss.replace(/^Der\s+/, "") || "Gutachterausschuss für Grundstückswerte";
  const artText = b.art === "forstwirtschaft" ? "Waldflächen (Boden ohne Aufwuchs)" : b.art === "wohnbau" ? "Wohnbauland" : "landwirtschaftliche Flächen";
  const gesamt = b.wert * f.flaecheM2;
  return {
    satz: `Der amtliche Bodenrichtwert für ${artText} in Ihrer Lage liegt bei ${euro2(b.wert)} € je m² (Stichtag ${datumTag(b.stichtag)}, ${ga}). Für Ihr Flurstück ${f.gemarkung}, Flur ${f.flur}, Flurstück ${f.nummer} mit amtlich ${qm(f.flaecheM2 / 10_000)} m² ergibt das rechnerisch rund ${euroRund(gesamt)} €.${b.art === "forstwirtschaft" ? " Der Wert des Holzbestands kommt hinzu." : ""}`,
    kurz: `Bodenrichtwert ${euro2(b.wert)} €/m² (${datumTag(b.stichtag)}) · amtlich ${qm(f.flaecheM2 / 10_000)} m² · ≈ ${euroRund(gesamt)} €`,
    hint: null,
  };
}

/** Was den Wert innerhalb der Spanne bestimmt und was wir dafür noch wissen möchten. */
function genauer(typ: FlaechenTyp, hatFlurstueck: boolean): { faktoren: string; nachfrage: string } {
  const flst = hatFlurstueck ? "" : "das Flurstück und ";
  switch (typ) {
    case "ackerland":
      return { faktoren: "der Bodengüte (Ackerzahl), dem Zuschnitt und der Zufahrt", nachfrage: hatFlurstueck ? "die Ackerzahl, falls Sie sie kennen" : "das Flurstück und – falls bekannt – die Ackerzahl" };
    case "gruenland":
      return { faktoren: "der Bewirtschaftbarkeit, einer möglichen Hanglage und Schutzgebietsauflagen", nachfrage: `${flst}die heutige Nutzung (Mahd oder Weide)` };
    case "wald":
      return { faktoren: "Baumarten, Alter und Zustand des Bestands sowie der Erschließung", nachfrage: `${flst}Angaben zum Bestand (Baumarten, Alter, Schäden)` };
    default:
      return { faktoren: "der genauen Lage, dem Zuschnitt und der Bebaubarkeit", nachfrage: hatFlurstueck ? "die genaue Adresse" : "die genaue Adresse oder das Flurstück" };
  }
}

function aufzaehlen(teile: string[]): string {
  return teile.length <= 1 ? (teile[0] ?? "") : `${teile.slice(0, -1).join(", ")} und ${teile.at(-1)}`;
}

function oderListe(teile: string[]): string {
  return teile.length <= 1 ? (teile[0] ?? "") : `${teile.slice(0, -1).join(", ")} oder ${teile.at(-1)}`;
}

const AUSWAHL_NAME: Record<RueckmeldungArt, string> = {
  verkaufen: "Verkauf",
  verpachten: "Verpachtung",
  suche: "„Ich suche weiter“",
  beratung: "eine Beratung",
  "kein-interesse": "„kein Interesse“",
};

const EINLEITUNG: Record<AntwortThema, string> = {
  bewertung: "vielen Dank für Ihre Anfrage zur Bewertung Ihrer Fläche.",
  verkauf: "vielen Dank für Ihre Anfrage – Sie möchten Ihre Fläche verkaufen.",
  verpachtung: "vielen Dank für Ihre Anfrage – Sie möchten Ihre Fläche verpachten.",
  vergleich: "vielen Dank für Ihre Anfrage – Sie überlegen, ob ein Verkauf oder eine Verpachtung besser passt.",
  energie: "vielen Dank für Ihr Interesse an einer Energiepacht (Solar oder Wind).",
  vns: "vielen Dank für Ihre Anfrage zu Vertragsnaturschutz und Ökopunkten.",
  bauland: "vielen Dank für Ihre Anfrage zur Bauland-Beratung.",
  wald: "vielen Dank für Ihre Anfrage zu Ihrem Wald.",
  lohnunternehmer: "vielen Dank für Ihre Anfrage – Sie suchen einen Lohnunternehmer.",
  allgemein: "vielen Dank für Ihre Nachricht.",
};

const BETREFF: Record<AntwortThema, string> = {
  bewertung: "Ihre Bewertungsanfrage bei Lippe Forst",
  verkauf: "Ihre Fläche bei Lippe Forst – Verkauf",
  verpachtung: "Ihre Fläche bei Lippe Forst – Verpachtung",
  vergleich: "Verkauf oder Verpachtung – Ihre Anfrage bei Lippe Forst",
  energie: "Ihre Anfrage zur Energiepacht (Solar/Wind)",
  vns: "Ihre Anfrage zu Vertragsnaturschutz und Ökopunkten",
  bauland: "Ihre Anfrage zur Bauland-Beratung",
  wald: "Ihre Anfrage zu Ihrem Wald",
  lohnunternehmer: "Ihre Anfrage nach einem Lohnunternehmer",
  allgemein: "Ihre Anfrage bei Lippe Forst",
};

const VERMITTLUNG = "Möchten Sie die Fläche verkaufen oder verpachten? Wir finden auf Wunsch einen passenden Käufer oder Pächter – für Sie als Eigentümer kostenlos.";

/**
 * Das fertige Antwortschreiben zu einer Anfrage (ohne Rückmeldung) bzw. zu einem
 * Beratungswunsch aus der Nachfass-Antwort (`rueckmeldung`). null ohne gültige E-Mail-Adresse.
 */
export function antwortEntwurf(opts: { lead: LeadView; kunde: M.KundeRecord | null; basis: string; rueckmeldung?: Rueckmeldung | null }): AntwortEntwurf | null {
  const { lead: l, kunde, basis } = opts;
  const r = opts.rueckmeldung?.art === "beratung" ? opts.rueckmeldung : null;
  const an = (kunde?.email || T.wert(l.email)).toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(an)) return null;

  const intent = T.wert(l.intent);
  const nachricht = T.wert(l.message);
  const hinweise: string[] = [];

  let thema: AntwortThema = r ? (NACH_BERATUNGSTHEMA[r.thema ?? ""] ?? "allgemein") : (NACH_ANLIEGEN[intent] ?? "allgemein");
  if (!r && thema === "allgemein" && nachricht) {
    const treffer = STICHWORTE.find(([re]) => re.test(nachricht));
    if (treffer) {
      thema = treffer[1];
      hinweise.push(`Anliegen „${intent || "—"}“, die Nachricht spricht aber von ${THEMA_NAME[thema]} — der Entwurf geht darauf ein.`);
    }
  }

  // Größe (Übersteuerung der Verwaltung zählt), Gemeinde, Flächentyp.
  const g = l.groesseWert;
  const ha = g.minHa != null && g.maxHa != null ? (g.minHa + g.maxHa) / 2 : (g.minHa ?? g.maxHa);
  const groesseRoh = T.wert(l.groesse);
  if (groesseRoh && g.unsicher && ha != null) hinweise.push(`Größe unsicher gelesen: „${groesseRoh}“ → ${formatGroesse(g)} — bitte prüfen.`);
  const ortText = l.ortText || T.wert(l.ort);
  const city = gemeindeAus(ortText);
  const k = l.meta.kataster ?? null;
  const fs = k?.flurstueck ?? null;
  // In Lippe? Das Kataster weiß es genau, sonst der Ortsname.
  const inLippe = fs ? fs.kreis === "Lippe" : Boolean(city);
  if (fs && fs.kreis !== "Lippe") hinweise.push(`Lage im Kreis ${fs.kreis || "?"} (${fs.gemeinde}) — außerhalb des Kreises Lippe; der Entwurf sagt nichts zur Vermittlung zu.`);
  else if (!fs && ortText && !city) hinweise.push(`„${ortText}“ keiner Lipper Gemeinde zugeordnet — keine Lipper Durchschnittswerte im Entwurf.`);
  if (k?.hinweis && T.wert(l.flurstueck)) hinweise.push(`Kataster: ${k.hinweis}`);
  // Flächentyp: Formular, sonst Nachricht („Spargelfeld“), sonst amtliche Nutzung.
  let typ = wertTyp(l.typ);
  if (!typ) {
    const ausNachricht = TYP_STICHWORTE.find(([re]) => re.test(nachricht))?.[1] ?? null;
    const ausKataster = fs ? (/wald|gehölz|forst/i.test(fs.nutzung) ? "wald" : /wohn/i.test(fs.nutzung) ? "bauland" : /landwirtschaft|acker|grünland/i.test(fs.nutzung) ? "ackerland" : null) : null;
    typ = ausNachricht ?? ausKataster;
    if (typ) hinweise.push(`Flächentyp im Formular „${l.typ}“ — ${ausNachricht ? "aus der Nachricht" : "aus dem Kataster"} als ${TYP_NAME[typ]} gelesen.`);
  }
  const hatFlurstueck = Boolean(T.wert(l.flurstueck));
  const verpachtet = VERPACHTET.test(nachricht);
  const altlast = ALTLAST.test(nachricht);
  if (altlast) hinweise.push("Die Nachricht nennt Altlasten bzw. Belastungen — der Wert kann deutlich unter dem Bodenrichtwert liegen; der Entwurf weist darauf hin.");
  const vnsQuelle = /vns|oekopunkt|ökopunkt/i.test(T.wert(l.source));

  const mitWert = thema === "bewertung" || thema === "verkauf" || thema === "vergleich" || thema === "wald" || thema === "bauland";
  const wTyp = thema === "wald" ? "wald" : thema === "bauland" ? "bauland" : typ;
  // Vorrang: amtlicher Bodenrichtwert am Flurstück; sonst (nur in Lippe) der Durchschnitt aus dem Grundstücksmarktbericht.
  const w = !mitWert ? null : (k ? wertAusBrw(k) : null) ?? (wTyp && inLippe ? wertindikation(wTyp, ha ?? null, city) : null);
  /** Wert aus dem amtlichen Bodenrichtwert (ein Wert statt einer Spanne). */
  const amtlich = Boolean(w?.kurz.startsWith("Bodenrichtwert"));

  const nf = genauer(wTyp ?? "ackerland", hatFlurstueck);
  const koerper: string[] = [];
  switch (thema) {
    case "bewertung": {
      if (w && (amtlich || wTyp !== "bauland")) {
        koerper.push(`Unsere erste Wertindikation: ${w.satz}`, "");
        if (w.hint) koerper.push(w.hint, "");
        koerper.push(
          amtlich
            ? `Innerhalb der Richtwertzone hängt der Preis vor allem von ${nf.faktoren} ab. Die Indikation ist kostenlos und unverbindlich und ersetzt kein Verkehrswertgutachten.`
            : `Wo genau Ihre Fläche in dieser Spanne liegt, hängt vor allem von ${nf.faktoren} ab. Nennen Sie uns gern ${nf.nachfrage} – dann grenzen wir den Wert genauer ein. Die Indikation ist kostenlos und unverbindlich und ersetzt kein Verkehrswertgutachten.`,
        );
      } else if (w) {
        koerper.push(w.satz, "", `Je nach Lage im Ort, Zuschnitt und Bebaubarkeit sind deutliche Abweichungen möglich. Nennen Sie uns gern ${nf.nachfrage} – dann prüfen wir den Bodenrichtwert für Ihre Lage.`);
      } else if (typ && ha != null && ortText) {
        koerper.push(
          `Wir sehen uns den amtlichen Bodenrichtwert für Ihre Lage an und melden uns mit einer ersten Einschätzung.${hatFlurstueck ? "" : " Nennen Sie uns dafür gern das Flurstück (Gemarkung, Flur und Nummer) – dann wird sie genauer."}`,
        );
      } else {
        const fehlt = [
          ...(typ ? [] : ["die Art der Fläche (Acker, Grünland, Wald oder Bauland)"]),
          ...(ha != null || typ === "bauland" ? [] : ["die ungefähre Größe"]),
          ...(ortText ? [] : ["die Lage (Ort bzw. Gemarkung)"]),
        ];
        koerper.push(
          `Für eine erste Wertindikation brauchen wir noch ${aufzaehlen(fehlt.length ? fehlt : ["ein paar Angaben zur Fläche"])}. Eine kurze Antwort genügt – wir melden uns dann mit einer Einschätzung auf Basis der amtlichen Bodenrichtwerte, kostenlos und unverbindlich.`,
        );
      }
      if (altlast) {
        koerper.push(
          "",
          `${/kataster/i.test(nachricht) ? "Ihren Hinweis auf das Altlastenkataster" : "Ihren Hinweis auf mögliche Belastungen"} berücksichtigen wir: Ob und wie stark das den Wert mindert, hängt davon ab, ob Untersuchungen vorliegen und ob die Nutzung eingeschränkt ist. Wenn Sie Unterlagen dazu haben – etwa einen Auszug aus dem Kataster oder ein Bodengutachten –, sehen wir sie uns gern an.`,
        );
      }
      if (vnsQuelle) {
        koerper.push(
          "",
          "Sie sind über unsere Seite zu Vertragsnaturschutz und Ökopunkten zu uns gekommen: Für Flächen mit eingeschränkter Nutzung kann auch eine ökologische Aufwertung – etwa als Ausgleichsfläche mit Ökopunkten – eine Möglichkeit sein. Das prüfen wir auf Wunsch gern mit.",
        );
      }
      koerper.push("", inLippe ? VERMITTLUNG : "Gern besprechen wir mit Ihnen auch die nächsten Schritte – ob Verkauf, Verpachtung oder eine andere Nutzung.");
      break;
    }
    case "verkauf":
      koerper.push(
        `Dabei unterstützen wir Sie gern: Wir stellen Ihre Fläche passenden Käufern vor – für Sie als Eigentümer kostenlos.${verpachtet ? " Eine laufende Verpachtung ist dabei kein Hindernis – der Pachtvertrag geht beim Verkauf auf den Käufer über." : ""}`,
      );
      if (w) koerper.push("", `Zur ersten Orientierung: ${w.satz} ${amtlich ? "Innerhalb der Richtwertzone" : "Wo Ihre Fläche innerhalb dieser Spanne liegt,"} hängt ${amtlich ? "der Preis " : ""}vor allem von ${nf.faktoren} ab.`);
      koerper.push(
        "",
        r
          ? "Damit wir Ihre Fläche Interessenten vorstellen dürfen, schließen wir mit Ihnen online eine kurze, kostenlose Vereinbarung – antworten Sie einfach kurz, dann schicken wir Ihnen den Zugang."
          : "Damit wir Ihre Fläche Interessenten vorstellen dürfen, schließen wir mit Ihnen online eine kurze, kostenlose Vereinbarung. Wählen Sie dazu über Ihren persönlichen Link unten „Ja, ich möchte verkaufen“ – dann schicken wir Ihnen den Zugang.",
      );
      break;
    case "verpachtung":
      koerper.push(
        "Dabei unterstützen wir Sie gern: Wir vermitteln zuverlässige Pächter aus der Region – für Sie als Eigentümer kostenlos.",
        "",
        r
          ? "Damit wir Ihre Fläche Interessenten vorstellen dürfen, schließen wir mit Ihnen online eine kurze, kostenlose Vereinbarung – antworten Sie einfach kurz, dann schicken wir Ihnen den Zugang."
          : "Damit wir Ihre Fläche Interessenten vorstellen dürfen, schließen wir mit Ihnen online eine kurze, kostenlose Vereinbarung. Wählen Sie dazu über Ihren persönlichen Link unten „Ja, ich möchte verpachten“ – dann schicken wir Ihnen den Zugang.",
      );
      break;
    case "vergleich":
      koerper.push("Beides vermitteln wir – für Sie als Eigentümer kostenlos. Beim Verkauf erhalten Sie einmalig den Kaufpreis; bei der Verpachtung bleibt die Fläche in Ihrem Eigentum und bringt laufende Pachteinnahmen.");
      if (w) koerper.push("", `Zur Orientierung beim Verkauf: ${w.satz}`);
      koerper.push("", "Schreiben Sie uns gern kurz, was Ihnen wichtiger ist – ein einmaliger Erlös oder regelmäßige Einnahmen –, dann empfehlen wir Ihnen den passenden Weg.");
      break;
    case "energie": {
      const fehlt = [...(hatFlurstueck || ortText ? [] : ["die Lage (Gemarkung, Flur, Flurstück)"]), ...(ha != null ? [] : ["die ungefähre Größe"])];
      koerper.push(
        "Solarpark-Pachten liegen bei 2.500–4.500 € je Hektar und Jahr, Windstandorte zahlen fünf- bis sechsstellige Jahrespachten. Ob Ihre Fläche in Frage kommt, hängt vor allem von Größe, Lage, Netzanschluss und der planungsrechtlichen Einordnung ab.",
        "",
        `Wir prüfen das kostenlos und holen auf Wunsch mehrere Angebote ein. ${fehlt.length ? `Dafür bräuchten wir noch ${aufzaehlen(fehlt)}.` : "Mit Ihren Angaben sehen wir uns die Fläche an und melden uns mit einer ersten Einschätzung."}`,
      );
      break;
    }
    case "vns": {
      const fehlt = [...(hatFlurstueck ? [] : ["die Lage (Gemarkung, Flur, Flurstück)"]), ...(ha != null ? [] : ["die Größe"]), "die heutige Nutzung der Fläche"];
      koerper.push(
        "Vertragsnaturschutz NRW, Ökokonto und Ausgleichsflächen: Wir beraten Sie bei Antrag, Bewertung und Vermarktung – gerade extensive oder schwer bewirtschaftbare Flächen lassen sich so oft besser nutzen.",
        "",
        `Für eine erste Einschätzung bräuchten wir noch ${aufzaehlen(fehlt)}.`,
      );
      break;
    }
    case "bauland":
      koerper.push("Ob und wie eine Fläche bebaut werden darf, hängt vom Planungsrecht ab – etwa davon, ob ein Bebauungsplan besteht oder die Fläche im Innen- oder Außenbereich liegt. Wir sehen uns die Lage an und sagen Ihnen, welche Wege es gibt.");
      if (w) koerper.push("", w.satz);
      koerper.push("", hatFlurstueck ? "Mit Ihren Angaben prüfen wir die Lage und melden uns." : "Nennen Sie uns dafür bitte die genaue Adresse oder das Flurstück.");
      break;
    case "wald":
      koerper.push("Rund um Ihren Wald beraten wir zu Verkauf, Verpachtung und Bewertung und vermitteln auf Wunsch Forstarbeiten.");
      if (w) koerper.push("", `Zur Orientierung: ${w.satz}`, ...(w.hint ? ["", w.hint] : []));
      koerper.push("", "Für eine genauere Einschätzung helfen uns Angaben zum Bestand – Baumarten, Alter und mögliche Schäden.");
      break;
    case "lohnunternehmer":
      koerper.push(
        "Wir vermitteln verlässliche Lohnunternehmer aus dem Kreis Lippe für Mahd, Heuwerbung, Heckenpflege, Forstarbeit und alles, was rund um die Fläche anfällt.",
        "",
        "Damit wir den passenden Betrieb finden: Um welche Arbeiten geht es, wo liegt die Fläche, wie groß ist sie, und bis wann sollen die Arbeiten erledigt sein?",
      );
      break;
    default:
      koerper.push("Damit wir Ihnen gezielt helfen können: Worum geht es Ihnen genau – um einen Verkauf, eine Verpachtung, eine Bewertung oder eine Beratung zu Ihrer Fläche?");
  }

  const name = kunde?.stammdaten?.name || T.wert(l.name);
  const einleitung = r
    ? `vielen Dank für Ihre Rückmeldung – Sie wünschen eine Beratung${r.thema && r.thema !== "Etwas anderes" ? ` zum Thema „${r.thema}“` : ""}.${r.text ? ` Sie schrieben: „${r.text.replace(/\s+/g, " ").trim().slice(0, 400)}“` : ""}`
    : EINLEITUNG[thema];
  const auswahl = oderListe(antwortOptionen(antwortGruppe(l.rolle), l.art).map((a) => AUSWAHL_NAME[a]));
  const text = [
    name ? `Guten Tag ${name},` : "Guten Tag,",
    "",
    einleitung,
    "",
    ...koerper,
    "",
    ...(r
      ? ["Eine kurze Antwort auf diese E-Mail genügt."]
      : [`Am schnellsten antworten Sie über Ihren persönlichen Link – dort wählen Sie ${auswahl}:`, antwortLink(l.id, basis), "Oder antworten Sie einfach auf diese E-Mail."]),
    "",
    ...anfrageBezug(l),
    "",
    GRUSS,
  ].join("\n");

  const erkannt = [
    THEMA_NAME[thema],
    typ ? TYP_NAME[typ] : l.typ && l.typ !== "Sonstiges" ? l.typ : "",
    fs ? `amtlich ${qm(fs.flaecheM2 / 10_000)} m² (${fs.nutzung})` : ha != null ? formatGroesse(g) : "",
    fs ? `${fs.gemeinde}${fs.kreis && fs.kreis !== "Lippe" ? `, Kreis ${fs.kreis}` : ""}` : (city?.name ?? ""),
    verpachtet ? "derzeit verpachtet" : "",
    altlast ? "Altlasten-Hinweis" : "",
  ].filter(Boolean);

  return {
    thema,
    themaName: THEMA_NAME[thema],
    erkannt,
    hinweise,
    wert: w?.kurz ?? null,
    an,
    betreff: r ? "Ihre Beratungsanfrage bei Lippe Forst" : thema === "bewertung" && w ? "Ihre Wertindikation von Lippe Forst" : BETREFF[thema],
    text,
  };
}
