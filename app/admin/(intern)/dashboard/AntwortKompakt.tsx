"use client";

import { useState } from "react";
import type { AntwortEntwurf } from "@/lib/portal/anfrage-typen";
import AntwortFreigabe from "./AntwortFreigabe";

// Aufgabenzeile: ein Knopf „Antwort prüfen & senden“ klappt das fertige Antwortschreiben
// mit „Freigeben & senden“ / „Text anpassen“ direkt in der Zeile auf.

export default function AntwortKompakt({ id, e, test, ziel, archiv }: { id: string; e: AntwortEntwurf; test: boolean; ziel: string; archiv: boolean }) {
  const [offen, setOffen] = useState(false);
  if (!offen) {
    return (
      <button type="button" className="lfa-knopf lfa-anfrage-knopf" onClick={() => setOffen(true)} title={`Zeigt die fertige Antwort (${e.themaName}) mit Betreff und Text — dann „Freigeben & senden“ oder „Text anpassen“`}>
        Antwort prüfen &amp; senden
      </button>
    );
  }
  return (
    <div className="lfa-aufgabe-offen">
      <AntwortFreigabe id={id} e={e} test={test} ziel={ziel} archiv={archiv} />
      <button type="button" className="lfa-link-knopf" onClick={() => setOffen(false)} title="Antwort wieder zuklappen — es geht nichts raus">
        Zuklappen
      </button>
    </div>
  );
}
