"use client";

import { useEffect, useRef } from "react";
import { gesehenAktion } from "../portal-actions";

/**
 * Markiert die angezeigten Einträge als „gesehen“ — erst im Browser, also nur,
 * wenn die Seite wirklich angesehen wird (nicht beim Vorladen von Links).
 * Die aktuelle Ansicht pulsiert weiter; beim nächsten Aufruf nicht mehr.
 */
export default function GesehenMarker({ keys }: { keys: string[] }) {
  const erledigt = useRef("");
  useEffect(() => {
    const kennung = keys.join(",");
    if (!kennung || erledigt.current === kennung) return;
    erledigt.current = kennung;
    const t = setTimeout(() => {
      gesehenAktion(keys).catch(() => {
        erledigt.current = "";
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [keys]);
  return null;
}
