"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { seiteMassenAktion } from "../actions";
import { leere, useAuswahl, waehleViele } from "./sammel";

const QUELLEN = ["telefonisch", "per E-Mail", "schriftlich", "im Kundenbereich"];

export type SammelZeile = {
  id: string;
  name: string;
  /** Die Eckdaten, die öffentlich erscheinen würden (Anliegen, Typ, ungefähre Größe, grobe Lage) — keine Namen. */
  kurz: string;
  einwilligung: boolean;
  /** Was an den Eckdaten fehlt oder verräterisch ist — leer = kann online gehen. */
  fehlt: string[];
};

/**
 * „Ausgewählte veröffentlichen“ über der Anfragen-Liste: zeigt, wie viele der Ausgewählten gleich online gehen, wie viele eine
 * Einwilligung brauchen und wie viele wegen fehlender Eckdaten übersprungen werden. Veröffentlicht werden immer nur Eckdaten.
 */
export default function SammelLeiste({ zeilen }: { zeilen: SammelZeile[] }) {
  const router = useRouter();
  const auswahl = useAuswahl();
  const [laeuft, starten] = useTransition();
  const [offen, setOffen] = useState(false);
  const [quelle, setQuelle] = useState(QUELLEN[0]);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [ergebnis, setErgebnis] = useState<string[] | null>(null);

  const bereit = zeilen.filter((z) => z.einwilligung && z.fehlt.length === 0);
  const gewaehlt = zeilen.filter((z) => auswahl.has(z.id));
  const sofort = gewaehlt.filter((z) => z.einwilligung && z.fehlt.length === 0);
  const ohneEinwilligung = gewaehlt.filter((z) => !z.einwilligung && z.fehlt.length === 0);
  const unvollstaendig = gewaehlt.filter((z) => z.fehlt.length > 0);
  const ziel = [...sofort, ...(bestaetigt ? ohneEinwilligung : [])];

  if (zeilen.length === 0 && !ergebnis) return null;

  function los() {
    starten(async () => {
      const r = await seiteMassenAktion(ziel.map((z) => z.id), ohneEinwilligung.length && bestaetigt ? quelle : undefined);
      const namen = new Map(zeilen.map((z) => [z.id, z.name]));
      const ok = r.filter((x) => x.ok).length;
      setErgebnis([`${ok} von ${r.length} sind jetzt öffentlich.`, ...r.filter((x) => !x.ok).map((x) => `${namen.get(x.id) ?? x.id}: ${x.meldung}`)]);
      leere();
      setOffen(false);
      setBestaetigt(false);
      router.refresh();
    });
  }

  return (
    <div className="lfa-panel lfa-sammelleiste">
      <div className="lfa-knopfreihe">
        <strong>Sammel-Veröffentlichung</strong>
        <span className="lfa-klein">
          {gewaehlt.length === 0 ? "Zeilen mit dem Häkchen auswählen — oder alle, die bereit sind:" : `${gewaehlt.length} ausgewählt`}
        </span>
        {bereit.length > 0 && (
          <button type="button" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" onClick={() => waehleViele(bereit.map((z) => z.id))} title="Wählt alle Zeilen, bei denen Einwilligung und Eckdaten vollständig sind und nur der Klick fehlt">
            Alle bereiten auswählen ({bereit.length})
          </button>
        )}
        {gewaehlt.length > 0 && (
          <>
            <button type="button" className="lfa-knopf lfa-knopf-klein" onClick={() => setOffen(true)} title="Zeigt, was veröffentlicht wird — erst der nächste Klick veröffentlicht wirklich">
              Ausgewählte veröffentlichen …
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" onClick={() => { leere(); setOffen(false); }} title="Alle Häkchen entfernen">
              Auswahl aufheben
            </button>
          </>
        )}
      </div>

      {offen && gewaehlt.length > 0 && (
        <div className="lfa-sammelfeld" role="group" aria-label="Sammel-Veröffentlichung bestätigen">
          <p className="lfa-klein">
            <strong>Es erscheinen nur Eckdaten</strong> — Flächentyp, ungefähre Größe, grobe Lage; nie Name, Kontakt oder Flurstück.
          </p>
          <Gruppe titel={`${sofort.length} gehen sofort online (Einwilligung und Eckdaten vollständig)`} zeilen={sofort} />
          {ohneEinwilligung.length > 0 && (
            <>
              <Gruppe titel={`${ohneEinwilligung.length} ohne erfasste Einwilligung`} zeilen={ohneEinwilligung} />
              <label className="lfa-check" title="Nur ankreuzen, wenn die Einwilligung dieser Eigentümer bzw. Suchenden wirklich vorliegt — sie wird mit Datum und Namen erfasst">
                <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} /> Einwilligung liegt für diese {ohneEinwilligung.length} vor — erteilt:
              </label>
              <select value={quelle} onChange={(e) => setQuelle(e.target.value)} disabled={!bestaetigt} className="field-select lfa-seitewahl-feld" title="Wie die Einwilligung erteilt wurde">
                {QUELLEN.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </>
          )}
          <Gruppe titel={`${unvollstaendig.length} werden übersprungen — Eckdaten unvollständig (einzeln über „Öffentlich“ ergänzen)`} zeilen={unvollstaendig} grund />
          <div className="lfa-knopfreihe">
            <button type="button" disabled={laeuft || ziel.length === 0} className="lfa-knopf" onClick={los} title="Macht die aufgeführten Zeilen sofort öffentlich — immer nur mit den Eckdaten">
              {laeuft ? "Veröffentliche …" : `Jetzt ${ziel.length} veröffentlichen`}
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" onClick={() => setOffen(false)} title="Nichts veröffentlichen">
              Zurück
            </button>
          </div>
        </div>
      )}

      {ergebnis && (
        <ul className="lfa-klein lfa-sammelergebnis" role="status">
          {ergebnis.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Gruppe({ titel, zeilen, grund = false }: { titel: string; zeilen: SammelZeile[]; grund?: boolean }) {
  if (zeilen.length === 0) return null;
  return (
    <details className="lfa-details" open={zeilen.length <= 3}>
      <summary>{titel}</summary>
      <ul className="lfa-klein lfa-sammelliste">
        {zeilen.map((z) => (
          <li key={z.id}>
            <strong>{z.name}</strong> — {z.kurz}
            {grund && <span className="lfa-seitewahl-fehler"> · {z.fehlt.join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
