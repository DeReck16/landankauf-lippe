"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { AntwortEntwurf } from "@/lib/portal/anfrage-typen";
import { anfrageStatusAktion, antwortSendenAktion } from "../../assistent-actions";
import { ergebnisSetzen } from "../ergebnisse";
import { EinKlick } from "./EinKlick";

// Antwortentwurf zur Freigabe (Dashboard „Zur Freigabe“, lib/portal/antwort.ts): zeigt,
// was das System aus der Anfrage gelesen hat, und das fertige Antwortschreiben. Ein
// Klick auf „Freigeben & senden“ fragt direkt in der Zeile nach und sendet genau den
// gezeigten Text; „Text anpassen“ macht Betreff und Text vorher änderbar. Zweitrangig:
// „Ohne Mail als beantwortet“ (z. B. schon telefoniert) und bei neuen Anfragen „Archiv (Test/Spam)“.

export default function AntwortFreigabe({
  id,
  e,
  test,
  ziel,
  archiv,
}: {
  id: string;
  e: AntwortEntwurf;
  test: boolean;
  /** Abschnitt, über dem die Rückmeldung erscheint („anfragen“ bzw. „rueckmeldungen“). */
  ziel: string;
  /** Neue Anfrage: zusätzlich „Archiv (Test/Spam)“ (bei Tickets nicht sinnvoll). */
  archiv: boolean;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [fragen, setFragen] = useState(false);
  const [betreff, setBetreff] = useState(e.betreff);
  const [text, setText] = useState(e.text);
  const [pending, starten] = useTransition();
  const geaendert = betreff !== e.betreff || text !== e.text;

  function senden() {
    starten(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("betreff", betreff);
      fd.set("text", text);
      ergebnisSetzen(ziel, await antwortSendenAktion(fd));
      setFragen(false);
    });
  }

  return (
    <div className="lfa-antwort">
      <div className="lfa-antwort-analyse" title="Das hat das System aus der Anfrage gelesen — daraus ist der Entwurf entstanden">
        <span className="lfa-klein">Erkannt:</span>
        {e.erkannt.map((x) => (
          <span key={x} className="lfa-badge lfa-badge-keine">
            {x}
          </span>
        ))}
        {e.wert && (
          <span className="lfa-badge lfa-badge-ok" title="Wertindikation nach Grundstücksmarktbericht Kreis Lippe 2026 (wie das Bewertungstool der Website)">
            Wert: {e.wert}
          </span>
        )}
      </div>
      {e.hinweise.map((h) => (
        <div key={h} className="lfa-klein lfa-dash-warnung">
          {h}
        </div>
      ))}

      {bearbeiten ? (
        <div className="lfa-antwort-edit">
          <label>
            <span className="field-label">Betreff</span>
            <input value={betreff} onChange={(ev) => setBetreff(ev.target.value)} disabled={pending} maxLength={200} className="field-input" title="Betreff der Antwort — änderbar" />
          </label>
          <label>
            <span className="field-label">Text</span>
            <textarea value={text} onChange={(ev) => setText(ev.target.value)} disabled={pending} className="field-textarea lfa-antwort-textarea" title="Text der Antwort — änderbar; gesendet wird genau dieser Text" />
          </label>
        </div>
      ) : (
        <details className="lfa-antwort-vorschau" open>
          <summary title="Den fertigen Antworttext ein- oder ausklappen">
            an {e.an} — Betreff „{betreff}“{geaendert ? " (angepasst)" : ""}
          </summary>
          <div className="lfa-mailtext lfa-antwort-text">{text}</div>
        </details>
      )}

      {fragen ? (
        <div className="lfa-assistent-frage lfa-anfrage-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
          <strong>
            Antwort jetzt an {e.an} senden{geaendert ? " (mit Ihren Änderungen)" : ""}?
          </strong>
          <ul className="lfa-assistent-liste">
            <li>E-Mail über lippeforst.de, Antworten gehen ins Anfragenpostfach, eine Kopie (Bcc) an die Verwaltung.</li>
            <li>Der Status wird „Beantwortet“ — die Anfrage verschwindet aus „Zur Freigabe“; der Text steht im Verlauf der Anfrage.</li>
            {test && <li>Testmodus: Es wird nichts verschickt, nur protokolliert.</li>}
          </ul>
          <div className="lfa-knopfreihe">
            <button type="button" className="lfa-knopf lfa-anfrage-knopf" disabled={pending} onClick={senden} title="Sendet die Antwort jetzt über lippeforst.de">
              {pending ? "Wird gesendet …" : "Ja – Antwort senden"}
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-anfrage-knopf" disabled={pending} onClick={() => setFragen(false)} title="Nichts senden, zurück">
              Nein, zurück
            </button>
          </div>
        </div>
      ) : (
        <div className="lfa-knopfreihe lfa-anfrage-knoepfe">
          <button
            type="button"
            className="lfa-knopf lfa-anfrage-knopf"
            disabled={pending || !betreff.trim() || !text.trim()}
            onClick={() => setFragen(true)}
            title={`Fragt noch einmal nach und sendet dann diese Antwort an ${e.an}`}
          >
            {geaendert ? "Angepasst freigeben & senden" : "Freigeben & senden"}
          </button>
          {bearbeiten ? (
            <button type="button" className="lfa-knopf lfa-knopf-hell lfa-anfrage-knopf" disabled={pending} onClick={() => setBearbeiten(false)} title="Bearbeiten beenden — Ihre Änderungen bleiben erhalten und werden so gesendet">
              Fertig mit Anpassen
            </button>
          ) : (
            <button type="button" className="lfa-knopf lfa-knopf-hell lfa-anfrage-knopf" disabled={pending} onClick={() => setBearbeiten(true)} title="Betreff und Text vor dem Senden ändern">
              Text anpassen
            </button>
          )}
          {geaendert && (
            <button
              type="button"
              className="lfa-link-knopf"
              disabled={pending}
              onClick={() => {
                setBetreff(e.betreff);
                setText(e.text);
              }}
              title="Ihre Änderungen verwerfen und den ursprünglichen Entwurf wiederherstellen"
            >
              Entwurf wiederherstellen
            </button>
          )}
          <EinKlick
            aktion={anfrageStatusAktion}
            werte={{ id, status: "beantwortet" }}
            ziel={ziel}
            klasse="lfa-link-knopf"
            knopf="Ohne Mail als beantwortet"
            tipp="Schon anders geantwortet (z. B. per Telefon oder eigener E-Mail)? Setzt den Status auf „Beantwortet“ — es geht keine E-Mail raus."
          />
          {archiv && (
            <EinKlick
              aktion={anfrageStatusAktion}
              werte={{ id, status: "archiv" }}
              ziel={ziel}
              klasse="lfa-link-knopf"
              knopf="Archiv (Test/Spam)"
              tipp="Test, Spam oder Dublette — archivieren: nicht mehr im Dashboard, nicht im Matching und nicht beim Nachfassen. Es geht keine E-Mail raus; in der Anfrage jederzeit zurückholbar."
            />
          )}
          <Link href={`/admin/anfrage/${id}`} className="lfa-link-knopf lfa-anfrage-oeffnen" title="Anfrage öffnen: alle Angaben, Nachricht, Verlauf">
            Anfrage öffnen
          </Link>
        </div>
      )}
    </div>
  );
}
