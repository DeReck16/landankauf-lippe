"use client";

import { useActionState, useRef, useState } from "react";
import { mailSendenAktion, type MailState } from "../portal-actions";

export type EntwurfDaten = {
  id: string;
  zweck: string;
  rolle?: string;
  kundeId: string;
  paarKey?: string;
  titel: string;
  an: string;
  betreff: string;
  text: string;
  tipp: string;
  wirkung: string;
  gesendetAm?: string;
  faellig?: boolean;
  gesperrt?: string;
};

function datumZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

/**
 * E-Mail-Entwurf: Empfänger, Betreff und Text sind bearbeitbar. Drei Wege:
 * Senden (über lippeforst.de, erst nach Sicherheitsabfrage), Mailprogramm, Kopieren.
 */
export default function MailEntwurf({ e, offen }: { e: EntwurfDaten; offen?: boolean }) {
  const [state, action, pending] = useActionState<MailState, FormData>(mailSendenAktion, { status: "idle" });
  const [fragen, setFragen] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const an = useRef<HTMLInputElement>(null);
  const betreff = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const gesendet = state.status === "ok" ? state.am : e.gesendetAm;
  const gesperrt = Boolean(e.gesperrt);

  function werte() {
    return { an: an.current?.value ?? e.an, betreff: betreff.current?.value ?? e.betreff, text: text.current?.value ?? e.text };
  }

  function mailprogramm() {
    const w = werte();
    window.location.href = `mailto:${w.an.trim()}?subject=${encodeURIComponent(w.betreff)}&body=${encodeURIComponent(w.text)}`;
  }

  async function kopieren() {
    const w = werte();
    const inhalt = `An: ${w.an}\nBetreff: ${w.betreff}\n\n${w.text}`;
    try {
      await navigator.clipboard.writeText(inhalt);
    } catch {
      text.current?.select();
      document.execCommand("copy");
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }

  return (
    <details className={`lfa-entwurf ${e.faellig && !gesendet ? "lfa-entwurf-faellig" : ""}`} open={offen}>
      <summary title={e.tipp}>
        {e.faellig && !gesendet && <span className="lfa-puls" aria-label="jetzt dran" title="Dieser Schritt ist jetzt dran" />}
        <span className="lfa-entwurf-titel">{e.titel}</span>
        {gesendet ? (
          <span className="lfa-badge lfa-badge-ok" title="Zuletzt mit diesem Zweck gesendet">gesendet {datumZeit(gesendet)}</span>
        ) : gesperrt ? (
          <span className="lfa-badge lfa-badge-keine" title={e.gesperrt}>noch nicht möglich</span>
        ) : null}
      </summary>
      <form action={action} className="lfa-entwurf-form" onSubmit={() => setFragen(null)}>
        <input type="hidden" name="zweck" value={e.zweck} />
        <input type="hidden" name="kunde" value={e.kundeId} />
        {e.paarKey && <input type="hidden" name="key" value={e.paarKey} />}
        {e.rolle && <input type="hidden" name="rolle" value={e.rolle} />}
        {gesperrt && <p className="lfa-hinweis" style={{ margin: 0 }}>{e.gesperrt}</p>}
        <label>
          <span className="field-label">An</span>
          <input ref={an} name="an" type="email" defaultValue={e.an} required className="field-input" title="Empfänger — aus der Anfrage vorbelegt. Nur eine Adresse. Eine Kopie geht automatisch (Bcc) an die Verwaltung." />
        </label>
        <label>
          <span className="field-label">Betreff</span>
          <input ref={betreff} name="betreff" defaultValue={e.betreff} required className="field-input" title="Betreff — vor dem Senden frei änderbar" />
        </label>
        <label>
          <span className="field-label">Text</span>
          <textarea ref={text} name="text" defaultValue={e.text} required className="field-textarea lfa-entwurf-text" title="Text — vor dem Senden frei änderbar. Gespeichert wird genau der gesendete Text." />
        </label>
        {fragen !== null ? (
          <div className="lfa-hinweis lfa-hinweis-frage" role="alertdialog" aria-label="Senden bestätigen">
            <p style={{ margin: "0 0 0.5rem" }}>
              Jetzt wirklich an <strong>{fragen}</strong> senden? Absender ist lippeforst.de, Antworten gehen ins Anfragenpostfach, eine Kopie an die Verwaltung.
            </p>
            <div className="lfa-knopfreihe">
              <button type="submit" className="lfa-knopf lfa-knopf-klein" disabled={pending} title={`Sendet die E-Mail jetzt über lippeforst.de. ${e.wirkung}`}>
                {pending ? "Wird gesendet …" : "Ja, jetzt senden"}
              </button>
              <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" onClick={() => setFragen(null)} title="Nichts senden, zurück zum Entwurf">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="lfa-knopfreihe">
            <button
              type="button"
              className="lfa-knopf lfa-knopf-klein"
              disabled={gesperrt || pending}
              onClick={() => {
                if (an.current?.reportValidity() && betreff.current?.reportValidity() && text.current?.reportValidity()) setFragen(an.current.value || e.an);
              }}
              title={gesperrt ? e.gesperrt : `Fragt noch einmal nach und sendet dann über lippeforst.de (Kopie an die Verwaltung). ${e.wirkung}`}
            >
              Senden …
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" disabled={gesperrt} onClick={mailprogramm} title="Öffnet Ihr Mailprogramm mit Empfänger, Betreff und Text — gesendet wird dort; im Verlauf wird das NICHT gespeichert">
              Im Mailprogramm öffnen
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" onClick={kopieren} title="Kopiert Empfänger, Betreff und Text in die Zwischenablage — z. B. für WhatsApp oder ein anderes Postfach">
              {kopiert ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>
        )}
        {state.status !== "idle" && (
          <p className={`lfa-hinweis ${state.status === "ok" ? "lfa-hinweis-ok" : "lfa-hinweis-fehler"}`} style={{ margin: 0 }} role="status">
            {state.text}
          </p>
        )}
      </form>
    </details>
  );
}
