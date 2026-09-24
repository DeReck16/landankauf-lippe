"use client";

import { useRef, useState } from "react";

/** Vorschlagstext, frei bearbeitbar, mit Knopf zum Kopieren in die Zwischenablage. */
export default function KopierText({ titel, text, tipp }: { titel: string; text: string; tipp: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    const wert = ref.current?.value ?? text;
    try {
      await navigator.clipboard.writeText(wert);
    } catch {
      ref.current?.select();
      document.execCommand("copy");
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }

  return (
    <div>
      <div className="lfa-knopfreihe" style={{ justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <span className="field-label" style={{ margin: 0 }}>{titel}</span>
        <button type="button" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" onClick={kopieren} title={tipp}>
          {kopiert ? "Kopiert ✓" : "Kopieren"}
        </button>
      </div>
      <textarea
        ref={ref}
        defaultValue={text}
        className="field-textarea"
        title="Vorschlag — vor dem Kopieren frei anpassbar. Wird nirgends gespeichert und nie automatisch verschickt."
      />
    </div>
  );
}
