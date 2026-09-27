"use client";

import { useEffect, useRef } from "react";
import { gesehenAktion } from "../portal-actions";

/**
 * Wie GesehenMarker, aber erst, wenn der umgebende Abschnitt (details) aufgeklappt ist und
 * 1,2 Sekunden offen bleibt — eingeklappte Einträge gelten nicht als gesehen.
 */
export default function GesehenBeimAufklappen({ keys }: { keys: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const gespeichert = useRef("");
  const kennung = keys.join(",");
  useEffect(() => {
    const details = ref.current?.closest("details");
    if (!details || !kennung) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const pruefen = () => {
      if (t) clearTimeout(t);
      if (!details.open || gespeichert.current === kennung) return;
      t = setTimeout(() => {
        gesehenAktion(kennung.split(","))
          .then(() => {
            gespeichert.current = kennung;
          })
          .catch(() => {
            // beim nächsten Aufklappen erneut
          });
      }, 1200);
    };
    pruefen();
    details.addEventListener("toggle", pruefen);
    return () => {
      details.removeEventListener("toggle", pruefen);
      if (t) clearTimeout(t);
    };
  }, [kennung]);
  return <span ref={ref} hidden />;
}
