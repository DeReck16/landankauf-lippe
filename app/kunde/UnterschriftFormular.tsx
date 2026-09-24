"use client";

import { startTransition, useActionState } from "react";
import type { ErklaerungDef } from "@/lib/portal/erklaerungen";
import type { UnterschriftState } from "./actions";

/**
 * Online-Unterschrift: Erklärungen einzeln anhaken, Namen eingeben, Knopf mit
 * eindeutiger Beschriftung (bei Zahlungspflicht „Zahlungspflichtig …“,
 * § 312j Abs. 3 BGB). Die Zusammenfassung steht unmittelbar über dem Knopf.
 */
export default function UnterschriftFormular({
  aktion,
  hidden,
  erklaerungen,
  nameErwartet,
  knopf,
  knopfTipp,
  zusammenfassung,
  vorKnopf,
}: {
  aktion: (prev: UnterschriftState, fd: FormData) => Promise<UnterschriftState>;
  hidden: Record<string, string>;
  erklaerungen: ErklaerungDef[];
  nameErwartet: string;
  knopf: string;
  knopfTipp: string;
  zusammenfassung?: React.ReactNode;
  vorKnopf?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<UnterschriftState, FormData>(aktion, { status: "idle" });
  const fehlt = new Set(state.fehlt ?? []);
  return (
    <form
      className="lfk-form"
      onSubmit={(ev) => {
        // Selbst abschicken statt <form action>: React würde das Formular sonst nach
        // jeder Antwort zurücksetzen — bei einem Fehler wären Haken und Name weg.
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {Object.entries(hidden).map(([n, v]) => (
        <input key={n} type="hidden" name={n} value={v} />
      ))}
      <div className="lfk-form" role="group" aria-label="Erklärungen">
        {erklaerungen.map((e) => (
          <label key={e.id} className={`lfk-check ${e.pflicht ? "" : "lfk-check-frei"} ${fehlt.has(e.id) ? "lfk-check-fehlt" : ""}`} title={e.tipp}>
            <input type="checkbox" name={`e_${e.id}`} value="1" required={e.pflicht} />
            <span>{e.text}</span>
          </label>
        ))}
      </div>
      {zusammenfassung}
      <div className="lfk-unterschrift">
        <label className="field-label" htmlFor="unterschrift-name">
          Unterschrift: Ihr vollständiger Name
        </label>
        <input
          id="unterschrift-name"
          name="name"
          required
          autoComplete="name"
          placeholder={nameErwartet}
          className="field-input"
          title={`Geben Sie Ihren Namen genau so ein wie in Ihren Angaben („${nameErwartet}“). Er steht dann im Unterschriftsprotokoll am Ende des Vertrags.`}
        />
        {vorKnopf}
        {state.status === "fehler" && (
          <p className="lfk-hinweis lfk-hinweis-fehler" role="alert" style={{ margin: 0 }}>
            {state.text}
          </p>
        )}
        <div className="lfk-knopfreihe">
          <button type="submit" className="btn-primary" disabled={pending} title={knopfTipp}>
            {pending ? "Wird gespeichert …" : knopf}
          </button>
        </div>
      </div>
    </form>
  );
}
