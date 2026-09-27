"use client";

import { useState, useTransition } from "react";
import type { AssistentState } from "../../assistent-actions";
import { ergebnisSetzen } from "../ergebnisse";

// Sammel-Knopf im Dashboard (z. B. „Alle 4 Einladungen senden“, „3 fällige Erinnerungen senden“):
// fragt in der Zeile nach, zeigt die Empfänger und führt dann jeden Eintrag einzeln aus — der
// Server prüft jeden Eintrag frisch (Signatur) und überspringt, was sich geändert hat.

export default function SammelKnopf({
  aktion,
  eintraege,
  knopf,
  tipp,
  frage,
  liste,
  ziel,
  test,
  klasse = "lfa-knopf lfa-anfrage-knopf",
}: {
  aktion: (fd: FormData) => Promise<AssistentState>;
  /** Werte für das Feld „eintrag“ (je Eintrag einer). */
  eintraege: string[];
  knopf: string;
  tipp: string;
  frage: string;
  /** Anzeige in der Rückfrage: je Eintrag eine Zeile (Empfänger). */
  liste: string[];
  ziel: string;
  test: boolean;
  klasse?: string;
}) {
  const [fragen, setFragen] = useState(false);
  const [pending, starten] = useTransition();
  if (!fragen) {
    return (
      <button type="button" className={klasse} title={tipp} disabled={pending || eintraege.length === 0} onClick={() => setFragen(true)}>
        {knopf}
      </button>
    );
  }
  return (
    <div className="lfa-assistent-frage lfa-anfrage-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
      <strong>{frage}</strong>
      <ul className="lfa-assistent-liste">
        {liste.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p className="lfa-klein" style={{ margin: 0 }}>
        Jede E-Mail geht einzeln raus und steht danach im Verlauf. Hat sich bei einem Eintrag inzwischen etwas geändert, wird er übersprungen.
        {test ? " Testmodus: Es wird nichts verschickt, nur protokolliert." : ""}
      </p>
      <div className="lfa-knopfreihe">
        <button
          type="button"
          className="lfa-knopf lfa-anfrage-knopf"
          disabled={pending}
          title={`Führt jetzt aus: ${knopf}`}
          onClick={() =>
            starten(async () => {
              const fd = new FormData();
              for (const e of eintraege) fd.append("eintrag", e);
              ergebnisSetzen(ziel, await aktion(fd));
              setFragen(false);
            })
          }
        >
          {pending ? "Wird ausgeführt …" : `Ja – ${knopf}`}
        </button>
        <button type="button" className="lfa-knopf lfa-knopf-leise lfa-anfrage-knopf" disabled={pending} onClick={() => setFragen(false)} title="Nichts ausführen, zurück">
          Nein, zurück
        </button>
      </div>
    </div>
  );
}
