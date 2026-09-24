"use client";

import { startTransition, useActionState } from "react";
import { anmeldelinkAktion, type AnmeldeState } from "./actions";

export default function AnmeldeFormular() {
  const [state, action, pending] = useActionState<AnmeldeState, FormData>(anmeldelinkAktion, { status: "idle" });
  if (state.status === "gesendet") {
    return (
      <p className="lfk-hinweis lfk-hinweis-ok" role="status">
        {state.text} Bitte schauen Sie in Ihr Postfach — auch in den Spam-Ordner.
      </p>
    );
  }
  return (
    <form
      className="lfk-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <label className="field-label" htmlFor="kunde-email">
        Ihre E-Mail-Adresse
      </label>
      <input
        id="kunde-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="field-input"
        title="Die Adresse, mit der Sie bei Lippe Forst angefragt haben. Aus Sicherheitsgründen zeigen wir nicht an, ob es dazu einen Kundenbereich gibt."
      />
      {state.status === "fehler" && <p className="lfk-hinweis lfk-hinweis-fehler" style={{ margin: 0 }}>{state.text}</p>}
      <div className="lfk-knopfreihe">
        <button type="submit" className="btn-primary" disabled={pending} title="Schickt einen Einmal-Link an diese Adresse (20 Minuten gültig)">
          {pending ? "Wird gesendet …" : "Anmeldelink senden"}
        </button>
      </div>
    </form>
  );
}
