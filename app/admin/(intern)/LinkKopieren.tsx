"use client";

import { useRef, useState } from "react";

/** Persönlichen Link anzeigen und kopieren (z. B. zum Einfügen in eine eigene Mail oder WhatsApp). */
export default function LinkKopieren({ link, tipp }: { link: string; tipp: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [kopiert, setKopiert] = useState(false);
  async function kopieren() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      ref.current?.select();
      document.execCommand("copy");
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }
  return (
    <div className="lfa-linkzeile">
      <input ref={ref} readOnly value={link} className="field-input" title="Persönlicher Link — nur an diesen Kunden weitergeben" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" onClick={kopieren} title={tipp}>
        {kopiert ? "Kopiert ✓" : "Link kopieren"}
      </button>
    </div>
  );
}
