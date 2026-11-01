"use client";

import { useActionState, useState } from "react";
import { zugangAnlegenAktion, type ZugangState } from "./api-zugang-actions";

type RechtInfo = { schluessel: string; text: string };

const LAUFZEITEN = [
  { tage: 30, label: "30 Tage" },
  { tage: 90, label: "90 Tage" },
  { tage: 180, label: "180 Tage" },
  { tage: 365, label: "1 Jahr" },
  { tage: 730, label: "2 Jahre (Höchstwert)" },
];

/** Neuen API-Zugang anlegen; der Schlüssel erscheint genau einmal — mit „Als Datei speichern“, ohne ihn abtippen zu müssen. */
export default function ZugangFormular({ rechte, basisUrl }: { rechte: RechtInfo[]; basisUrl: string }) {
  const [state, action, pending] = useActionState<ZugangState, FormData>(zugangAnlegenAktion, { status: "idle" });
  const [kopiert, setKopiert] = useState(false);

  if (state.status === "ok" && state.schluessel) {
    const schluessel = state.schluessel;
    const speichern = () => {
      const inhalt = `# Lippe Forst – API-Zugang „${state.name}“ (geheim, nicht weitergeben)\nLF_API_URL=${basisUrl}\nLF_API_SCHLUESSEL=${schluessel}\n`;
      const url = URL.createObjectURL(new Blob([inhalt], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "lippeforst-api.env";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    return (
      <div className="lfa-hinweis lfa-hinweis-frage" role="status">
        <strong>Zugang „{state.name}“ ist angelegt.</strong> Der Schlüssel wird nur jetzt angezeigt und ist danach nirgends mehr lesbar. Bitte sofort
        speichern; geht er verloren, wird der Zugang gesperrt und ein neuer angelegt.
        <div className="lfa-linkzeile" style={{ marginTop: "0.6rem" }}>
          <input readOnly value={schluessel} className="field-input" aria-label="API-Schlüssel" onFocus={(e) => e.currentTarget.select()} title="Der Schlüssel — nur einmal sichtbar. Wie ein Passwort behandeln." />
          <button
            type="button"
            className="lfa-knopf lfa-knopf-klein"
            title="Kopiert den Schlüssel in die Zwischenablage"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(schluessel);
                setKopiert(true);
              } catch {
                setKopiert(false);
              }
            }}
          >
            {kopiert ? "Kopiert" : "Kopieren"}
          </button>
          <button type="button" className="lfa-knopf lfa-knopf-klein lfa-knopf-hell" onClick={speichern} title="Speichert eine Datei „lippeforst-api.env“ mit Adresse und Schlüssel — praktisch, um den Zugang an Claude oder ein Skript zu geben, ohne den Schlüssel abzutippen">
            Als Datei speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action}>
      <label className="field-label" htmlFor="zugang-name">Name des Zugangs</label>
      <input id="zugang-name" name="name" required minLength={3} maxLength={60} className="field-input" placeholder="z. B. Tagesbearbeitung (Claude)" title="Wofür ist der Zugang? Der Name steht im Protokoll bei jeder Änderung („API: …“). 3 bis 60 Zeichen, nicht doppelt." />
      <fieldset style={{ border: 0, padding: 0, margin: "0.9rem 0 0" }}>
        <legend className="field-label">Rechte</legend>
        {rechte.map((r) => (
          <label key={r.schluessel} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", margin: "0.3rem 0" }} title={r.text}>
            <input type="checkbox" name="recht" value={r.schluessel} defaultChecked={r.schluessel === "board:lesen"} style={{ marginTop: "0.25rem" }} />
            <span>
              <code>{r.schluessel}</code> <span className="lfa-klein">— {r.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="field-label" htmlFor="zugang-tage" style={{ marginTop: "0.9rem", display: "block" }}>Gültig</label>
      <select id="zugang-tage" name="tage" defaultValue="365" className="field-select" title="Danach ist der Zugang ungültig; ein neuer wird angelegt. Gesperrt werden kann jederzeit.">
        {LAUFZEITEN.map((l) => (
          <option key={l.tage} value={l.tage}>{l.label}</option>
        ))}
      </select>
      {state.status === "fehler" && <p className="lfa-hinweis lfa-hinweis-fehler" style={{ marginTop: "0.75rem" }}>{state.text}</p>}
      <button type="submit" className="lfa-knopf" disabled={pending} style={{ marginTop: "1rem" }} title="Legt den Zugang an und zeigt den Schlüssel einmalig an. Es geht keine E-Mail raus.">
        Zugang anlegen
      </button>
    </form>
  );
}
