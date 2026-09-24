"use client";

import { useState } from "react";

export type FlaecheEingabe = { gemarkung: string; flur: string; flurstueck: string; groesseHa: number | null; nutzung: string };

const LEER: FlaecheEingabe = { gemarkung: "", flur: "", flurstueck: "", groesseHa: null, nutzung: "" };

function haText(v: number | null): string {
  return v == null ? "" : String(v).replace(".", ",");
}

/**
 * Flurstücke erfassen (Gemarkung, Flur, Flurstück, Größe, Nutzung) — Zeilen
 * hinzufügen und entfernen. Felder heißen f_gemarkung, f_flur, … (mehrfach).
 * Stile: app/vertrag.css (Präfix lfd-).
 */
export default function FlaechenEditor({ start, nutzungVorschlag = "" }: { start: FlaecheEingabe[]; nutzungVorschlag?: string }) {
  const [zeilen, setZeilen] = useState<(FlaecheEingabe & { k: number })[]>(
    (start.length ? start : [{ ...LEER, nutzung: nutzungVorschlag }]).map((f, i) => ({ ...f, k: i })),
  );
  const [naechste, setNaechste] = useState(zeilen.length);

  return (
    <div className="lfd-flaechen">
      <div className="lfd-flaechen-kopf" aria-hidden>
        <span>Gemarkung</span>
        <span>Flur</span>
        <span>Flurstück</span>
        <span>Größe (ha)</span>
        <span>Nutzung</span>
        <span />
      </div>
      {zeilen.map((z, i) => (
        <div key={z.k} className="lfd-flaechen-zeile">
          <input name="f_gemarkung" defaultValue={z.gemarkung} placeholder="Gemarkung" aria-label={`Gemarkung, Zeile ${i + 1}`} className="field-input" title="Gemarkung laut Grundbuch oder Grundsteuerbescheid, z. B. „Westorf“" />
          <input name="f_flur" defaultValue={z.flur} placeholder="Flur" aria-label={`Flur, Zeile ${i + 1}`} className="field-input" title="Flurnummer, z. B. „3“" />
          <input name="f_flurstueck" defaultValue={z.flurstueck} placeholder="Flurstück" aria-label={`Flurstück, Zeile ${i + 1}`} className="field-input" title="Flurstücksnummer, z. B. „112/4“" />
          <input name="f_ha" defaultValue={haText(z.groesseHa)} placeholder="z. B. 2,35" inputMode="decimal" aria-label={`Größe in Hektar, Zeile ${i + 1}`} className="field-input" title="Größe in Hektar (Komma erlaubt): 1 ha = 10.000 m²" />
          <input name="f_nutzung" defaultValue={z.nutzung} placeholder="Acker, Grünland …" aria-label={`Nutzung, Zeile ${i + 1}`} className="field-input" title="Nutzungsart, z. B. Acker, Grünland, Wald" />
          <button
            type="button"
            className="lfd-flaechen-weg"
            onClick={() => setZeilen((alt) => (alt.length > 1 ? alt.filter((x) => x.k !== z.k) : alt))}
            disabled={zeilen.length <= 1}
            title="Diese Zeile entfernen (die letzte Zeile bleibt stehen)"
            aria-label={`Zeile ${i + 1} entfernen`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="lfd-flaechen-plus"
        onClick={() => {
          setZeilen((alt) => [...alt, { ...LEER, nutzung: nutzungVorschlag, k: naechste }]);
          setNaechste((n) => n + 1);
        }}
        disabled={zeilen.length >= 40}
        title="Weiteres Flurstück hinzufügen"
      >
        + weiteres Flurstück
      </button>
    </div>
  );
}
