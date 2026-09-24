"use client";

import { useEffect } from "react";

/**
 * Entfernt die Rückmeldung (?m=…&mt=…) aus der Adresse, sobald sie angezeigt ist —
 * nach dem Neuladen erscheint sie dann nicht erneut (Next.js übernimmt
 * window.history.replaceState in den Router).
 */
export default function AdresseAufraeumen() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("m") && !url.searchParams.has("mt")) return;
    url.searchParams.delete("m");
    url.searchParams.delete("mt");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  return null;
}
