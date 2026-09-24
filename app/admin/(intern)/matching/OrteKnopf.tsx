"use client";

import { useActionState } from "react";
import { alleOrteNachschlagen, type OrteState } from "../../actions";

export default function OrteKnopf() {
  const [state, action, pending] = useActionState<OrteState, FormData>(alleOrteNachschlagen, {});
  return (
    <form action={action} className="lfa-knopfreihe">
      <button
        type="submit"
        className="lfa-knopf lfa-knopf-klein"
        disabled={pending}
        title="Schlägt alle noch unbekannten Orte bei OpenStreetMap nach (etwa 1 Ort pro Sekunde, höchstens 25 Sekunden pro Klick). Nur Ortsnamen werden übermittelt, keine Personendaten."
      >
        {pending ? "Orte werden nachgeschlagen …" : "Fehlende Orte nachschlagen"}
      </button>
      {state.text && <span className="lfa-klein">{state.text}</span>}
    </form>
  );
}
