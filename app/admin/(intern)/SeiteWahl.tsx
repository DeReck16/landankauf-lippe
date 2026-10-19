"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SeiteFormular } from "@/lib/boerse";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { seiteSchaltenAktion } from "../actions";

const QUELLEN = ["telefonisch", "per E-Mail", "schriftlich", "im Kundenbereich"];

type Props = {
  id: string;
  /** „Fläche“ (Angebot) oder „Suchauftrag“ (Gesuch) — nur für die Texte. */
  was: "Fläche" | "Suchauftrag";
  /** In der Verwaltung als öffentlich geführt (auch wenn eine Lücke es von der Seite fernhält). */
  online: boolean;
  /** Warum der Schalter gesperrt ist (z. B. vergeben, Direktankauf) — leer = frei. */
  gesperrt: string | null;
};

/**
 * Dropdown „Nicht öffentlich / Öffentlich“ in der Anfragen-Liste. „Öffentlich“ veröffentlicht sofort, wenn Einwilligung und
 * Eckdaten stehen. Fehlt etwas, öffnet sich direkt hier ein kleines Formular mit dem Vorschlag: Flächentyp, Größe, grobe Lage
 * (und wie die Einwilligung erteilt wurde) — ergänzen, „Veröffentlichen“, fertig. Es erscheinen immer nur diese Eckdaten.
 */
export default function SeiteWahl({ id, was, online, gesperrt }: Props) {
  const router = useRouter();
  const [laeuft, starten] = useTransition();
  const [form, setForm] = useState<SeiteFormular | null>(null);
  const [typ, setTyp] = useState("");
  const [groesse, setGroesse] = useState("");
  const [lage, setLage] = useState("");
  const [quelle, setQuelle] = useState(QUELLEN[0]);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const gesuch = was === "Suchauftrag";

  function ausfuellen(f: SeiteFormular) {
    setForm(f);
    setTyp(f.typ);
    setGroesse(f.groesseHa != null ? String(f.groesseHa).replace(".", ",") : "");
    setLage(f.lage);
  }

  function schalten(ziel: "oeffentlich" | "nicht", opt?: Parameters<typeof seiteSchaltenAktion>[2]) {
    setMeldung(null);
    starten(async () => {
      const r = await seiteSchaltenAktion(id, ziel, opt);
      if (r.formular) {
        ausfuellen(r.formular);
        if (opt) setMeldung({ ok: false, text: r.meldung });
        return;
      }
      setForm(null);
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
        onChange={(e) => {
          if (e.target.value === "oeffentlich") schalten("oeffentlich");
          else {
            setForm(null);
            schalten("nicht");
          }
        }}
        title={
          gesperrt
            ? `Nicht schaltbar: ${gesperrt}`
            : online
              ? `${was} steht anonym auf lippeforst.de. „Nicht öffentlich“ nimmt sie sofort von der Seite.`
              : `${was} ist nicht auf der Seite. „Öffentlich“ zeigt sie sofort anonym auf lippeforst.de — nur mit Einwilligung ${gesuch ? "des Suchenden" : "des Eigentümers"}. Fehlt etwas, ergänzen Sie es direkt dort.`
        }
        aria-label={`${was} auf der Seite`}
      >
        <option value="nicht">Nicht öffentlich</option>
        <option value="oeffentlich">Öffentlich</option>
      </select>

      {form && (
        <form
          className="lfa-seitewahl-frage"
          aria-label="Eckdaten und Einwilligung"
          onSubmit={(e) => {
            e.preventDefault();
            schalten("oeffentlich", { ...(form.einwilligungNoetig ? { quelle } : {}), angaben: { typ, groesse, lage } });
          }}
        >
          <span className="lfa-klein">
            <strong>Nur diese Eckdaten erscheinen</strong> — nie Name, Kontakt oder Flurstück.
          </span>
          <label>
            Flächentyp
            <select value={typ} onChange={(e) => setTyp(e.target.value)} className="field-select lfa-seitewahl-feld" title="Flächentyp, wie er öffentlich erscheint">
              {FLAECHENTYPEN.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            {gesuch ? "Gesuchte Größe in ha (optional)" : "Ungefähre Größe in ha"}
            <input value={groesse} onChange={(e) => setGroesse(e.target.value)} inputMode="decimal" placeholder="z. B. 5" maxLength={12} className="field-input lfa-seitewahl-eingabe" title="Öffentlich gerundet („ca. … ha“) — damit die Fläche nicht erkennbar wird" />
          </label>
          <label>
            {gesuch ? "Grober Suchraum" : "Grobe Lage"}
            <input value={lage} onChange={(e) => setLage(e.target.value)} placeholder="z. B. Raum Lemgo" maxLength={80} className="field-input lfa-seitewahl-eingabe" title="Nur Gemeinde oder Raum — keine Straße, kein Flurname, kein Flurstück" />
          </label>
          {form.einwilligungNoetig && (
            <label>
              Einwilligung liegt vor — wie erteilt?
              <select value={quelle} onChange={(e) => setQuelle(e.target.value)} className="field-select lfa-seitewahl-feld" title="Wie die Einwilligung in die anonyme Veröffentlichung erteilt wurde — wird mit Datum und Namen erfasst">
                {QUELLEN.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.luecken.length > 0 && <span className="lfa-klein lfa-seitewahl-fehler">{form.luecken.join(" · ")}</span>}
          <div className="lfa-knopfreihe">
            <button type="submit" disabled={laeuft} className="lfa-knopf lfa-knopf-klein" title="Eckdaten speichern, Einwilligung erfassen (falls gefragt) und sofort anonym auf lippeforst.de zeigen">
              {laeuft ? "…" : "Veröffentlichen"}
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" onClick={() => setForm(null)} title="Nichts ändern">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {meldung && (
        <span className={`lfa-klein ${meldung.ok ? "" : "lfa-seitewahl-fehler"}`} role="status">
          {meldung.text}
        </span>
      )}
    </div>
  );
}
