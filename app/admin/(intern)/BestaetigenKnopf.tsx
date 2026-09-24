"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Absende-Knopf mit Sicherheitsabfrage (z. B. Freigabe, Sperre, Vorlage freigeben).
 * Die Abfrage erscheint direkt im Formular statt als Browser-Dialog: window.confirm
 * wird von manchen Browsern unterdrückt oder bleibt unsichtbar hinter dem Fenster —
 * dann „hängt“ der Knopf. Erst „Ja, …“ schickt das Formular ab.
 */
export default function BestaetigenKnopf({
  children,
  frage,
  tipp,
  className = "lfa-knopf lfa-knopf-klein",
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  frage: string;
  tipp: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const [fragen, setFragen] = useState(false);
  const { pending } = useFormStatus();
  // Nach dem Absenden (pending → fertig) wieder den normalen Knopf zeigen.
  const [warPending, setWarPending] = useState(false);
  if (pending !== warPending) {
    setWarPending(pending);
    if (!pending) setFragen(false);
  }

  if (fragen) {
    return (
      <span className="lfa-bestaetigen" role="alertdialog" aria-label="Sicherheitsabfrage">
        <span className="lfa-bestaetigen-frage">{frage}</span>
        <button type="submit" className="lfa-knopf lfa-knopf-klein" name={name} value={value} disabled={pending} title={tipp}>
          {pending ? "Wird ausgeführt …" : <>Ja – {children}</>}
        </button>
        <button
          type="button"
          className="lfa-knopf lfa-knopf-leise lfa-knopf-klein"
          disabled={pending}
          onClick={() => setFragen(false)}
          title="Nichts ausführen, zurück"
        >
          Nein, zurück
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={tipp}
      disabled={disabled || pending}
      onClick={(e) => {
        // Pflichtfelder (z. B. das Häkchen „geprüft“) gleich hier melden, nicht erst nach dem „Ja“.
        const form = e.currentTarget.form;
        if (form && !form.reportValidity()) return;
        setFragen(true);
      }}
    >
      {children}
    </button>
  );
}
