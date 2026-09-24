"use client";

import { useActionState } from "react";
import { anmeldelinkAnfordern, type AnmeldeState } from "./actions";

export default function AnmeldeFormular({ weiter }: { weiter?: string }) {
  const [state, action, pending] = useActionState<AnmeldeState, FormData>(anmeldelinkAnfordern, { status: "idle" });

  if (state.status === "gesendet") {
    return (
      <div className="lfa-hinweis lfa-hinweis-ok" role="status">
        {state.text} Bitte das Postfach prüfen — auch den Spam-Ordner.
      </div>
    );
  }

  return (
    <form action={action}>
      {weiter && <input type="hidden" name="weiter" value={weiter} />}
      <label className="field-label" htmlFor="email">E-Mail-Adresse</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        className="field-input"
        title="Nur freigeschaltete Adressen bekommen einen Link. Aus Sicherheitsgründen zeigt die Seite nicht an, ob eine Adresse freigeschaltet ist."
      />
      {state.status === "fehler" && (
        <p className="lfa-hinweis lfa-hinweis-fehler" style={{ marginTop: "0.75rem" }}>{state.text}</p>
      )}
      <button
        type="submit"
        className="lfa-knopf"
        disabled={pending}
        style={{ marginTop: "1rem", width: "100%" }}
        title="Schickt einen Einmal-Link an diese Adresse. Der Link gilt 20 Minuten; höchstens ein Link pro Minute."
      >
        {pending ? "Wird gesendet …" : "Anmeldelink senden"}
      </button>
    </form>
  );
}
