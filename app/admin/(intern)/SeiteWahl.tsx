"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { seiteSchaltenAktion } from "../actions";

const QUELLEN = ["telefonisch", "per E-Mail", "schriftlich", "im Kundenbereich"];

type Props = {
  id: string;
  /** „Fläche“ (Angebot) oder „Suchauftrag“ (Gesuch) — nur für die Texte. */
  was: "Fläche" | "Suchauftrag";
  /** In der Verwaltung als öffentlich geführt (auch wenn eine Lücke es von der Seite fernhält). Fehlt die Einwilligung, fragt der Schalter beim Öffentlich-Machen, wie sie erteilt wurde. */
  online: boolean;
  /** Warum der Schalter gesperrt ist (z. B. vergeben, Direktankauf) — leer = frei. */
  gesperrt: string | null;
};

/** Dropdown „Nicht öffentlich / Öffentlich“ in der Anfragen-Liste: schaltet die Fläche bzw. das Gesuch sofort auf die Website oder davon herunter. */
export default function SeiteWahl({ id, was, online, gesperrt }: Props) {
  const router = useRouter();
  const [laeuft, starten] = useTransition();
  const [frage, setFrage] = useState(false);
  const [quelle, setQuelle] = useState(QUELLEN[0]);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const person = was === "Suchauftrag" ? "der Suchende" : "der Eigentümer";

  function schalten(ziel: "oeffentlich" | "nicht", wie?: string) {
    setMeldung(null);
    starten(async () => {
      const r = await seiteSchaltenAktion(id, ziel, wie);
      if (r.einwilligungNoetig) {
        setFrage(true);
        return;
      }
      setFrage(false);
      setMeldung({ ok: r.ok, text: r.meldung });
      router.refresh();
    });
  }

  return (
    <div className="lfa-seitewahl">
      <select
        value={online ? "oeffentlich" : "nicht"}
        disabled={laeuft || Boolean(gesperrt)}
        className="field-select lfa-seitewahl-feld"
        onChange={(e) => (e.target.value === "oeffentlich" ? schalten("oeffentlich") : schalten("nicht"))}
        title={
          gesperrt
            ? `Nicht schaltbar: ${gesperrt}`
            : online
              ? `${was} steht anonym auf lippeforst.de. „Nicht öffentlich“ nimmt sie sofort von der Seite.`
              : `${was} ist nicht auf der Seite. „Öffentlich“ zeigt sie sofort anonym auf lippeforst.de — nur mit Einwilligung ${person === "der Suchende" ? "des Suchenden" : "des Eigentümers"}.`
        }
        aria-label={`${was} auf der Seite`}
      >
        <option value="nicht">Nicht öffentlich</option>
        <option value="oeffentlich">Öffentlich</option>
      </select>
      {frage && (
        <div className="lfa-seitewahl-frage" role="group" aria-label="Einwilligung erfassen">
          <span className="lfa-klein">Keine Einwilligung erfasst — wie hat {person} eingewilligt?</span>
          <select value={quelle} onChange={(e) => setQuelle(e.target.value)} className="field-select lfa-seitewahl-feld" title="Wie die Einwilligung in die anonyme Veröffentlichung erteilt wurde — wird mit Datum und Namen erfasst">
            {QUELLEN.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <div className="lfa-knopfreihe">
            <button type="button" disabled={laeuft} className="lfa-knopf lfa-knopf-klein" onClick={() => schalten("oeffentlich", quelle)} title="Einwilligung erfassen und sofort anonym auf lippeforst.de zeigen">
              Einwilligung liegt vor — öffentlich machen
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" onClick={() => setFrage(false)} title="Nichts ändern">
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {meldung && (
        <span className={`lfa-klein ${meldung.ok ? "" : "lfa-seitewahl-fehler"}`} role="status">
          {meldung.text}
        </span>
      )}
    </div>
  );
}
