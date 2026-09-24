"use client";

import { useEffect, useRef } from "react";
import { gesehenAktion } from "../portal-actions";

/**
 * Markiert die angezeigten Einträge als „gesehen“ — erst im Browser, also nur,
 * wenn die Seite wirklich angesehen wird (nicht beim Vorladen von Links), und erst
 * nach 1,2 Sekunden. Als erledigt gilt es erst, wenn das Speichern geklappt hat;
 * bei einem Fehler versucht es der nächste Aufruf erneut. Die aktuelle Ansicht
 * pulsiert weiter; beim nächsten Aufruf nicht mehr.
 */
export default function GesehenMarker({ keys }: { keys: string[] }) {
  const gespeichert = useRef("");
  const kennung = keys.join(",");
  useEffect(() => {
    if (!kennung || gespeichert.current === kennung) return;
    const t = setTimeout(() => {
      gesehenAktion(kennung.split(","))
        .then(() => {
          gespeichert.current = kennung;
        })
        .catch(() => {
          // Nicht gespeichert — beim nächsten Anzeigen erneut versuchen.
        });
    }, 1200);
    return () => clearTimeout(t);
  }, [kennung]);
  return null;
}
