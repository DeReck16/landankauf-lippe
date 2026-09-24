"use client";

import { useEffect } from "react";

/**
 * Harte Grenze zwischen öffentlicher Website und den internen Bereichen
 * (/kunde, /admin): Ein Link über diese Grenze lädt die Seite vollständig neu,
 * statt clientseitig zu navigieren. Sonst bliebe das auf der Website geladene
 * Google Analytics im Dokument und zählte über seine History-Erkennung auch
 * Seiten des Kundenbereichs mit — auch nach „Zurück“ im Browser. Mit vollem
 * Seitenwechsel liegen beide Bereiche in getrennten Dokumenten.
 */
const INTERN = /^\/(kunde|admin)(\/|$)/;

export default function BereichsGrenze() {
  useEffect(() => {
    const beiKlick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const ziel = new URL(a.href, window.location.href);
      if (ziel.origin !== window.location.origin) return;
      if (INTERN.test(ziel.pathname) === INTERN.test(window.location.pathname)) return;
      // Next.js' <Link> bekommt den Klick nicht zu sehen → der Browser lädt die Zielseite normal.
      e.stopPropagation();
    };
    // Fenster, Einfangphase: läuft vor React (Wurzel = document) und damit vor jedem <Link>.
    window.addEventListener("click", beiKlick, true);
    return () => window.removeEventListener("click", beiKlick, true);
  }, []);
  return null;
}
