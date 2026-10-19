// Eckdaten, die für ein Angebot bzw. einen Suchauftrag auf die Seite kommen würden — und was daran noch fehlt.
// Gemeinsame Grundlage für den Schalter „Öffentlich“ (Server und Anzeige), damit Vorschau und Veröffentlichung nie
// auseinanderlaufen. Es geht immer nur um Eckdaten: Flächentyp, ungefähre Größe, grobe Lage — nie Name, Kontakt, Flurstück.

import { boerseLuecken, oeffentlicheLage, sucheLuecken } from "@/lib/boerse-regeln";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { grobeLage } from "./matching";
import type { BoerseMeta, LeadView, Zustand } from "./model";

export type Eckdaten = { typ: string; groesseHa: number | null; lage: string };

/** Eckdaten: schon Gespeichertes zuerst, sonst aus der Anfrage vorgeschlagen (Typ, auf halbe Hektar gerundete Größe, „Raum <Gemeinde>“). */
export function eckdatenFuer(l: LeadView, b: BoerseMeta | undefined, orte: Zustand["orte"]): Eckdaten {
  const typ = b?.typ || ((FLAECHENTYPEN as readonly string[]).includes(l.typ) ? l.typ : "Sonstiges");
  const ha = l.groesseWert.minHa ?? l.groesseWert.maxHa;
  const groesseHa = b?.groesseHa ?? (ha != null && ha > 0 ? Math.max(0.5, Math.round(ha * 2) / 2) : null);
  if (b?.lage && oeffentlicheLage(b.lage)) return { typ, groesseHa, lage: b.lage };
  const gemeinde = oeffentlicheLage(grobeLage(l, orte));
  return { typ, groesseHa, lage: gemeinde ? `Raum ${gemeinde}` : "" };
}

/**
 * Was der Veröffentlichung noch im Weg steht — ohne die Einwilligung (die wird getrennt abgefragt): fehlende
 * Eckdaten, erledigte Anfrage, Direktankauf oder eine verräterische Angabe (Name, Adresse, Telefon, Flurstück).
 */
export function fehlendeEckdaten(l: LeadView, b: BoerseMeta | undefined, orte: Zustand["orte"]): string[] {
  const e = eckdatenFuer(l, b, orte);
  const probe: BoerseMeta = {
    code: b?.code ?? "—",
    ...e,
    text: b?.text ?? "",
    ...(b?.details ? { details: b.details } : {}),
    einwilligung: b?.einwilligung ?? { am: "", quelle: "", von: "" },
    online: false,
  };
  return (l.rolle === "gesuch" ? sucheLuecken : boerseLuecken)(probe, l);
}
