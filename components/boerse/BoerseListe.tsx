"use client";

import { useState } from "react";
import Link from "next/link";
import { artText, filterOptionen, filtereGruppen, type BoerseFilter, type KartenDaten } from "@/lib/boerse-regeln";
import BoerseKarte from "./BoerseKarte";

function Wahl({ aktiv, sperre, label, anzahl, tipp, onClick }: { aktiv: boolean; sperre?: boolean; label: string; anzahl: number; tipp: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sperre}
      aria-pressed={aktiv}
      title={tipp}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        aktiv
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
          : "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)] enabled:hover:bg-[color:var(--color-brand-soft)]"
      }`}
    >
      {label}
      <span className={aktiv ? "text-white/80" : "text-[color:var(--color-muted)]"}>{anzahl}</span>
    </button>
  );
}

/**
 * Angebote der Flächenbörse als Karten mit Filterleiste (Kauf/Pacht und Flächentyp). Gefiltert wird im Browser,
 * die Seite selbst bleibt statisch (ISR). Die Leiste erscheint nur, wenn es etwas zum Auswählen gibt.
 */
export default function BoerseListe({ gruppen }: { gruppen: KartenDaten[][] }) {
  const [filter, setFilter] = useState<BoerseFilter>({ art: "", typ: "" });
  const gesamt = filterOptionen(gruppen, { art: "", typ: "" });
  const zeigeArt = gesamt.arten.every((a) => a.anzahl > 0);
  const zeigeTyp = gesamt.typen.length > 1;
  const { arten, typen } = filterOptionen(gruppen, filter);
  const sichtbar = filtereGruppen(gruppen, filter);
  const aktiv = Boolean(filter.art || filter.typ);
  const zuruecksetzen = () => setFilter({ art: "", typ: "" });

  return (
    <>
      {(zeigeArt || zeigeTyp) && (
        <div className="mt-8 flex flex-col gap-4" role="group" aria-label="Angebote filtern">
          {zeigeArt && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-1">Art</span>
              <Wahl aktiv={!filter.art} label="Alle" anzahl={filtereGruppen(gruppen, { ...filter, art: "" }).length} tipp="Kauf- und Pachtangebote zeigen" onClick={() => setFilter({ ...filter, art: "" })} />
              {arten.map((a) => (
                <Wahl
                  key={a.wert}
                  aktiv={filter.art === a.wert}
                  sperre={a.anzahl === 0 && filter.art !== a.wert}
                  label={artText(a.wert).eyebrow}
                  anzahl={a.anzahl}
                  tipp={a.anzahl === 0 ? "Keine Fläche mit dieser Auswahl" : a.wert === "pacht" ? "Nur Flächen zur Pacht zeigen" : "Nur Flächen zum Kauf zeigen"}
                  onClick={() => setFilter({ ...filter, art: a.wert })}
                />
              ))}
            </div>
          )}
          {zeigeTyp && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-1">Flächentyp</span>
              <Wahl aktiv={!filter.typ} label="Alle" anzahl={filtereGruppen(gruppen, { ...filter, typ: "" }).length} tipp="Alle Flächentypen zeigen" onClick={() => setFilter({ ...filter, typ: "" })} />
              {typen.map((t) => (
                <Wahl
                  key={t.wert}
                  aktiv={filter.typ === t.wert}
                  sperre={t.anzahl === 0 && filter.typ !== t.wert}
                  label={t.wert}
                  anzahl={t.anzahl}
                  tipp={t.anzahl === 0 ? "Keine Fläche mit dieser Auswahl" : `Nur ${t.wert} zeigen`}
                  onClick={() => setFilter({ ...filter, typ: t.wert })}
                />
              ))}
            </div>
          )}
          {aktiv && (
            <p className="text-sm text-[color:var(--color-ink-soft)]" aria-live="polite">
              {sichtbar.length} von {gruppen.length} {gruppen.length === 1 ? "Angebot" : "Angeboten"}
              {" · "}
              <button type="button" onClick={zuruecksetzen} className="underline" title="Zeigt wieder alle Angebote">
                Filter zurücksetzen
              </button>
            </p>
          )}
        </div>
      )}

      {sichtbar.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sichtbar.map((g) => (
            <BoerseKarte key={g[0].code} a={g[0]} teile={g} />
          ))}
        </div>
      ) : (
        <div className="mt-8 card">
          <h3 className="font-serif text-2xl">Dazu gibt es gerade keine Fläche.</h3>
          <p className="mt-2 text-[color:var(--color-ink-soft)]">Ändern Sie die Auswahl oder hinterlegen Sie einen Suchauftrag — wir melden uns, sobald eine passende Fläche angeboten wird.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={zuruecksetzen} className="btn-secondary" title="Zeigt wieder alle Angebote">
              Filter zurücksetzen
            </button>
            <Link href="#suchauftrag" className="btn-primary" title="Zum Formular für den Suchauftrag springen">
              Suchauftrag hinterlegen
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
