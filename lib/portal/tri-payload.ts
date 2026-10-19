import type { LeadMeta, LeadView } from "@/lib/admin/model";

/**
 * Was bei der Übergabe einer Fläche an die Verwaltung von TR Immobilien mitgeht (reine Funktion, ohne Speicher —
 * Gegenstück: `leadAusLippeForst` in tr-immobilien.com). Nie dabei: interne Notizen, Verlauf, Verträge, Börsen-Texte.
 */
export function triPayload(l: LeadView, meta: LeadMeta | undefined, am: string, von: string) {
  const k = meta?.kataster;
  const echt = (v: string) => (v !== "—" ? v : "");
  return {
    quelle: "lippe-forst" as const,
    externeId: l.id,
    receivedAt: l.receivedAt,
    intent: echt(l.intent),
    art: l.art ?? undefined,
    flaechentyp: l.typ,
    groesse: echt(l.groesse),
    ort: l.ortText,
    flurstueck: echt(l.flurstueck),
    message: echt(l.message),
    name: echt(l.name),
    phone: echt(l.phone),
    email: echt(l.email),
    weg: meta?.weg,
    kataster: k?.flurstueck
      ? {
          gemarkung: k.flurstueck.gemarkung,
          gemeinde: k.flurstueck.gemeinde,
          kreis: k.flurstueck.kreis,
          flur: k.flurstueck.flur,
          nummer: k.flurstueck.nummer,
          flaecheM2: k.flurstueck.flaecheM2,
          nutzung: k.flurstueck.nutzung,
          lage: k.flurstueck.lage,
          brwWert: k.brw?.wert,
          brwStichtag: k.brw?.stichtag,
        }
      : undefined,
    einverstaendnis: { am, von },
  };
}
