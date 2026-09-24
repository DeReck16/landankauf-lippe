"use client";

import { useState } from "react";
import { dankeGesehenAktion } from "./actions";

/**
 * Danke nach dem Abschluss mit der freiwilligen Bitte um eine Google-Bewertung.
 * Ohne Anreiz, ohne Vorgaben zu Sternen oder Inhalt — und ohne Gutschein
 * (der wird getrennt davon mitgeteilt).
 */
export default function DankeDialog({ kundeId, vorgang, url, art }: { kundeId: string; vorgang: string; url: string; art: "pacht" | "kauf" }) {
  const [offen, setOffen] = useState(true);
  if (!offen) return null;

  function schliessen() {
    setOffen(false);
    const fd = new FormData();
    fd.set("k", kundeId);
    fd.set("key", vorgang);
    dankeGesehenAktion(fd).catch(() => undefined);
  }

  return (
    <div className="lfk-dialog-hintergrund" role="dialog" aria-modal="true" aria-labelledby="danke-titel">
      <div className="lfk-dialog">
        <h2 id="danke-titel">Vielen Dank!</h2>
        <p>
          Ihr {art === "kauf" ? "Flächenkauf" : "Pachtvertrag"} ist abgeschlossen — schön, dass wir helfen konnten.
        </p>
        <p>
          Wenn Sie mögen, freuen wir uns über eine ehrliche Bewertung Ihrer Erfahrung bei Google. Das ist selbstverständlich freiwillig.
        </p>
        <div className="lfk-knopfreihe">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary lfk-knopf-klein"
            onClick={schliessen}
            title="Öffnet die Bewertungsseite von Lippe Forst bei Google in einem neuen Tab"
          >
            Bei Google bewerten
          </a>
          <button type="button" className="btn-secondary lfk-knopf-klein" onClick={schliessen} title="Schließt diesen Hinweis — er erscheint nicht wieder">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
